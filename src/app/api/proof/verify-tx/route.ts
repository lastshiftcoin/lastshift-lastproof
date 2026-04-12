/**
 * POST /api/proof/verify-tx
 *
 * Submit a transaction signature for verification. Validates input format,
 * checks for duplicate signatures, and queues the verification for the
 * cron consumer to process against Helius RPC.
 *
 * Returns immediately with a verification_id for polling.
 */

import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_PATHS = new Set(["collab", "dev"]);
const VALID_TOKENS = new Set(["LASTSHFT", "SOL", "USDT"]);

/** Extract a Solana signature from a Solscan URL or raw base58 string. */
function parseSolscanInput(input: string): string | null {
  const trimmed = input.trim();
  // Solscan URL: https://solscan.io/tx/{signature} or https://solscan.io/tx/{signature}?cluster=...
  const urlMatch = trimmed.match(
    /solscan\.io\/tx\/([A-Za-z1-9]{80,90})/,
  );
  if (urlMatch) return urlMatch[1];
  // Raw base58 signature (typically 87-88 chars)
  if (/^[A-HJ-NP-Za-km-z1-9]{80,90}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      signature?: string;
      pubkey?: string;
      path?: string;
      token?: string;
      work_item_id?: string;
      profile_id?: string;
      deep?: boolean;
    };

    // Validate required fields
    if (!body.signature || !body.pubkey || !body.path || !body.token || !body.work_item_id) {
      return json({ ok: false, error: "missing required fields" }, 400);
    }

    if (!VALID_PATHS.has(body.path)) {
      return json({ ok: false, error: "invalid path" }, 400);
    }
    if (!VALID_TOKENS.has(body.token)) {
      return json({ ok: false, error: "invalid token" }, 400);
    }

    // Parse Solscan URL or raw signature
    const signature = parseSolscanInput(body.signature);
    if (!signature) {
      return json({ ok: false, error: "invalid signature format — paste a Solscan URL or transaction signature" }, 400);
    }

    const db = supabaseService();

    // Check if signature already used in proofs table (instant dedup)
    const { data: existingProof } = await db
      .from("proofs")
      .select("id")
      .eq("tx_signature", signature)
      .limit(1)
      .single();

    if (existingProof) {
      return json({ ok: false, error: "signature_already_used", detail: "This transaction has already been used for a proof." }, 409);
    }

    // Check if already queued/processing in proof_verifications
    const { data: existingVerification } = await db
      .from("proof_verifications")
      .select("id, status, failure_check, failure_detail, proof_id")
      .eq("signature", signature)
      .limit(1)
      .single();

    if (existingVerification) {
      // If it already verified successfully, return the result
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

    // Derive profile_id from work_item_id if not provided
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

    // Insert new verification into queue
    const { data: row, error: insertErr } = await db
      .from("proof_verifications")
      .insert({
        signature,
        pubkey: body.pubkey,
        path: body.path,
        token: body.token,
        work_item_id: body.work_item_id,
        profile_id: profileId,
        status: "queued",
        attempt_number: body.deep ? 2 : 1,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique constraint violation = race condition, another request queued it
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
