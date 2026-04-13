/**
 * POST /api/proof/verify-tx
 *
 * Submit a transaction signature for verification. V3 changes:
 *   - pubkey removed from required fields (extracted from TX post-verification)
 *   - session_id required (validated against proof_sessions table)
 *   - comment field accepted (optional, max 500 chars server-side)
 *   - Silent duplicate handling: if signature exists in proofs, return
 *     existing proof data as "verified" — scammer sees success
 *   - Expanded parseSolscanInput: solscan, explorer.solana.com, solana.fm, xray.helius.xyz
 *
 * Returns immediately with a verification_id for polling.
 */

import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { verifyAndRecordProof, type VerificationRow } from "@/lib/proof-verification";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ window: 60_000, max: 5 });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_PATHS = new Set(["collab", "dev"]);
const VALID_TOKENS = new Set(["LASTSHFT", "SOL", "USDT"]);

/**
 * Extract a Solana signature from various explorer URLs or raw base58 string.
 * Supports: Solscan, Solana Explorer, solana.fm, xray.helius.xyz, raw base58.
 */
function parseSolscanInput(input: string): string | null {
  const trimmed = input.trim();

  // Solscan URL: https://solscan.io/tx/{signature}
  const solscanMatch = trimmed.match(/solscan\.io\/tx\/([A-Za-z1-9]{43,90})/);
  if (solscanMatch) return solscanMatch[1];

  // Solana Explorer: https://explorer.solana.com/tx/{signature}
  const explorerMatch = trimmed.match(/explorer\.solana\.com\/tx\/([A-Za-z1-9]{43,90})/);
  if (explorerMatch) return explorerMatch[1];

  // solana.fm: https://solana.fm/tx/{signature}
  const fmMatch = trimmed.match(/solana\.fm\/tx\/([A-Za-z1-9]{43,90})/);
  if (fmMatch) return fmMatch[1];

  // xray.helius.xyz: https://xray.helius.xyz/tx/{signature}
  const xrayMatch = trimmed.match(/xray\.helius\.xyz\/tx\/([A-Za-z1-9]{43,90})/);
  if (xrayMatch) return xrayMatch[1];

  // Raw base58 signature (44-88 chars, typical Solana signatures are 87-88)
  if (/^[A-HJ-NP-Za-km-z1-9]{43,90}$/.test(trimmed)) return trimmed;

  return null;
}

export async function POST(req: NextRequest) {
  const rl = limiter.check(getClientIp(req));
  if (!rl.ok) return json({ ok: false, error: "rate_limited", detail: "Too many requests. Try again shortly." }, 429);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      signature?: string;
      path?: string;
      token?: string;
      work_item_id?: string;
      profile_id?: string;
      session_id?: string;
      comment?: string;
      deep?: boolean;
    };

    // Validate required fields (pubkey removed — V3 extracts from TX)
    if (!body.signature || !body.path || !body.token || !body.work_item_id || !body.session_id) {
      return json({ ok: false, error: "missing required fields" }, 400);
    }

    if (!VALID_PATHS.has(body.path)) {
      return json({ ok: false, error: "invalid path" }, 400);
    }
    if (!VALID_TOKENS.has(body.token)) {
      return json({ ok: false, error: "invalid token" }, 400);
    }

    // Parse signature from URL or raw input
    const signature = parseSolscanInput(body.signature);
    if (!signature) {
      return json({ ok: false, error: "invalid signature format — paste a Solscan URL or transaction signature" }, 400);
    }

    // Truncate comment server-side (defense in depth)
    const comment = body.comment ? body.comment.slice(0, 500) : null;

    const db = supabaseService();

    // ─── Silent duplicate: signature already in proofs → fake success ──
    const { data: existingProof } = await db
      .from("proofs")
      .select("id, payer_wallet, tx_signature, note, created_at")
      .eq("tx_signature", signature)
      .limit(1)
      .single();

    if (existingProof) {
      // Scammer sees success. Proof already counted for the real person.
      return json({
        ok: true,
        verification_id: null,
        status: "verified",
        proof_id: existingProof.id,
        silent_duplicate: true,
      });
    }

    // ─── Validate session_id against proof_sessions table ─────────────
    const { data: session } = await db
      .from("proof_sessions")
      .select("id, opened_at")
      .eq("id", body.session_id)
      .single();

    if (!session) {
      return json({ ok: false, error: "invalid or expired session" }, 400);
    }

    // ─── Check if already queued/processing in proof_verifications ────
    const { data: existingVerification } = await db
      .from("proof_verifications")
      .select("id, status, failure_check, failure_detail, proof_id")
      .eq("signature", signature)
      .limit(1)
      .single();

    if (existingVerification) {
      if (existingVerification.status === "verified") {
        return json({
          ok: true,
          verification_id: existingVerification.id,
          status: "verified",
          proof_id: existingVerification.proof_id,
        });
      }
      // If it failed before, allow re-queue with bumped attempt
      if (existingVerification.status === "failed") {
        const newAttempt = body.deep ? 2 : 1;
        const { error: updateErr } = await db
          .from("proof_verifications")
          .update({
            status: "queued",
            failure_check: null,
            failure_detail: null,
            attempt_number: newAttempt,
            processed_at: null,
            comment,
            session_id: session.id,
            session_opened_at: session.opened_at,
          })
          .eq("id", existingVerification.id);

        if (updateErr) {
          console.error("[verify-tx] re-queue failed:", updateErr.message);
          return json({ ok: false, error: "queue_failed" }, 500);
        }
        return json({
          ok: true,
          verification_id: existingVerification.id,
          status: "queued",
        });
      }
      // Already queued or processing — return current status
      return json({
        ok: true,
        verification_id: existingVerification.id,
        status: existingVerification.status,
      });
    }

    // ─── Derive profile_id from work_item_id if not provided ──────────
    let profileId = body.profile_id;
    if (!profileId) {
      const { data: item } = await db
        .from("work_items")
        .select("profile_id")
        .eq("id", body.work_item_id)
        .maybeSingle();
      if (!item?.profile_id) {
        return json({ ok: false, error: "work_item_id not found" }, 404);
      }
      profileId = item.profile_id;
    }

    // ─── Insert new verification into queue ───────────────────────────
    const { data: row, error: insertErr } = await db
      .from("proof_verifications")
      .insert({
        signature,
        pubkey: null,
        path: body.path,
        token: body.token,
        work_item_id: body.work_item_id,
        profile_id: profileId,
        status: "queued",
        attempt_number: body.deep ? 2 : 1,
        comment,
        session_id: session.id,
        session_opened_at: session.opened_at,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique constraint violation = race condition
      if (insertErr.code === "23505") {
        const { data: raced } = await db
          .from("proof_verifications")
          .select("id, status")
          .eq("signature", signature)
          .single();
        if (raced) {
          return json({ ok: true, verification_id: raced.id, status: raced.status });
        }
      }
      console.error("[verify-tx] insert failed:", insertErr.message);
      return json({ ok: false, error: "queue_failed" }, 500);
    }

    // ─── Check webhook cache: if Helius already saw this TX, process now ─
    const { data: cached } = await db
      .from("pending_webhook_sigs")
      .select("signature")
      .eq("signature", signature)
      .maybeSingle();

    if (cached) {
      // Webhook already fired — process immediately instead of waiting for cron
      console.log("[verify-tx] webhook cache hit — processing immediately");
      await db.from("pending_webhook_sigs").delete().eq("signature", signature);

      const pvRow = {
        id: row.id,
        signature,
        pubkey: null,
        path: body.path,
        token: body.token,
        work_item_id: body.work_item_id,
        profile_id: profileId,
        attempt_number: body.deep ? 2 : 1,
        comment,
        session_opened_at: session.opened_at,
      } as VerificationRow;

      await db.from("proof_verifications").update({ status: "processing" }).eq("id", row.id);
      const result = await verifyAndRecordProof(pvRow);

      if (result.ok) {
        await db.from("proof_verifications").update({
          status: "verified",
          proof_id: result.proofId,
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);
        return json({
          ok: true,
          verification_id: row.id,
          status: "verified",
          proof_id: result.proofId,
          sender_wallet: result.extractedSender,
        });
      } else {
        await db.from("proof_verifications").update({
          status: "failed",
          failure_check: result.check,
          failure_detail: result.detail,
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);
      }
    }

    return json({
      ok: true,
      verification_id: row.id,
      status: "queued",
    });
  } catch (err) {
    console.error("[verify-tx] unexpected error:", err);
    return json({ ok: false, error: "unknown" }, 500);
  }
}
