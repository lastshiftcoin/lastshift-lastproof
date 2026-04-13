/**
 * POST /api/payment/paste-verify
 *
 * Submit a transaction signature for payment verification (mint, subscription, handle_change).
 * Mirrors /api/proof/verify-tx but for payments.
 *
 * Returns immediately with a verification_id for polling.
 */

import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { readSession } from "@/lib/session";
import { verifyAndRecordPayment, type PaymentVerificationRow } from "@/lib/payment-verification";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paymentLimiter = createRateLimiter({ window: 60_000, max: 5 });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_KINDS = new Set(["subscription", "mint", "handle_change"]);
const VALID_TOKENS = new Set(["LASTSHFT", "SOL", "USDT"]);

/**
 * Extract a Solana signature from various explorer URLs or raw base58 string.
 */
function parseSolscanInput(input: string): string | null {
  const trimmed = input.trim();

  const solscanMatch = trimmed.match(/solscan\.io\/tx\/([A-Za-z1-9]{43,90})/);
  if (solscanMatch) return solscanMatch[1];

  const explorerMatch = trimmed.match(/explorer\.solana\.com\/tx\/([A-Za-z1-9]{43,90})/);
  if (explorerMatch) return explorerMatch[1];

  const fmMatch = trimmed.match(/solana\.fm\/tx\/([A-Za-z1-9]{43,90})/);
  if (fmMatch) return fmMatch[1];

  const xrayMatch = trimmed.match(/xray\.helius\.xyz\/tx\/([A-Za-z1-9]{43,90})/);
  if (xrayMatch) return xrayMatch[1];

  if (/^[A-HJ-NP-Za-km-z1-9]{43,90}$/.test(trimmed)) return trimmed;

  return null;
}

export async function POST(req: NextRequest) {
  const rl = paymentLimiter.check(getClientIp(req));
  if (!rl.ok) return json({ ok: false, error: "rate_limited", detail: "Too many requests." }, 429);

  try {
    const session = await readSession();
    if (!session) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      signature?: string;
      kind?: string;
      token?: string;
      profile_id?: string;
      ref_id?: string;
      session_id?: string;
      deep?: boolean;
    };

    if (!body.signature || !body.kind || !body.token || !body.session_id) {
      return json({ ok: false, error: "missing required fields" }, 400);
    }

    if (!VALID_KINDS.has(body.kind)) {
      return json({ ok: false, error: "invalid kind" }, 400);
    }
    if (!VALID_TOKENS.has(body.token)) {
      return json({ ok: false, error: "invalid token" }, 400);
    }

    const signature = parseSolscanInput(body.signature);
    if (!signature) {
      return json({ ok: false, error: "invalid signature format — paste a Solscan URL or transaction signature" }, 400);
    }

    const db = supabaseService();

    // ─── Silent duplicate: signature already in payments → fake success ──
    const { data: existingPayment } = await db
      .from("payments")
      .select("id, payer_wallet")
      .eq("tx_signature", signature)
      .limit(1)
      .single();

    if (existingPayment) {
      return json({
        ok: true,
        verification_id: null,
        status: "verified",
        payment_id: existingPayment.id,
        silent_duplicate: true,
      });
    }

    // ─── Validate session_id against payment_sessions table ─────────
    const { data: paymentSession } = await db
      .from("payment_sessions")
      .select("id, opened_at")
      .eq("id", body.session_id)
      .single();

    if (!paymentSession) {
      return json({ ok: false, error: "invalid or expired session" }, 400);
    }

    // ─── Check if already queued/processing in payment_verifications ─
    const { data: existingVerification } = await db
      .from("payment_verifications")
      .select("id, status, failure_check, failure_detail, payment_id")
      .eq("signature", signature)
      .limit(1)
      .single();

    if (existingVerification) {
      if (existingVerification.status === "verified") {
        return json({
          ok: true,
          verification_id: existingVerification.id,
          status: "verified",
          payment_id: existingVerification.payment_id,
        });
      }
      if (existingVerification.status === "failed") {
        const newAttempt = body.deep ? 2 : 1;
        await db
          .from("payment_verifications")
          .update({
            status: "queued",
            failure_check: null,
            failure_detail: null,
            attempt_number: newAttempt,
            processed_at: null,
            session_id: paymentSession.id,
            session_opened_at: paymentSession.opened_at,
          })
          .eq("id", existingVerification.id);

        return json({
          ok: true,
          verification_id: existingVerification.id,
          status: "queued",
        });
      }
      return json({
        ok: true,
        verification_id: existingVerification.id,
        status: existingVerification.status,
      });
    }

    // ─── Resolve profile_id if not provided ──────────────────────────
    let resolvedProfileId: string = body.profile_id ?? "";
    if (!resolvedProfileId) {
      const { resolveProfileFromSession } = await import("@/lib/auth/resolve-profile");
      const resolved = await resolveProfileFromSession();
      if (!resolved) {
        return json({ ok: false, error: "profile_not_found" }, 404);
      }
      resolvedProfileId = resolved.profile.id;
    }

    // ─── Insert new verification into queue ──────────────────────────
    const { data: row, error: insertErr } = await db
      .from("payment_verifications")
      .insert({
        signature,
        pubkey: null,
        kind: body.kind,
        token: body.token,
        profile_id: resolvedProfileId,
        ref_id: body.ref_id ?? null,
        status: "queued",
        attempt_number: body.deep ? 2 : 1,
        session_id: paymentSession.id,
        session_opened_at: paymentSession.opened_at,
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: raced } = await db
          .from("payment_verifications")
          .select("id, status")
          .eq("signature", signature)
          .single();
        if (raced) {
          return json({ ok: true, verification_id: raced.id, status: raced.status });
        }
      }
      console.error("[payment/paste-verify] insert failed:", insertErr.message);
      return json({ ok: false, error: "queue_failed" }, 500);
    }

    // ─── Check webhook cache: if Helius already saw this TX, process now ─
    const { data: cached } = await db
      .from("pending_webhook_sigs")
      .select("signature")
      .eq("signature", signature)
      .maybeSingle();

    if (cached) {
      console.log("[payment/paste-verify] webhook cache hit — processing immediately");
      await db.from("pending_webhook_sigs").delete().eq("signature", signature);

      const pvRow: PaymentVerificationRow = {
        id: row.id,
        signature,
        pubkey: null,
        kind: body.kind as PaymentVerificationRow["kind"],
        token: body.token,
        profile_id: resolvedProfileId,
        ref_id: body.ref_id ?? null,
        attempt_number: body.deep ? 2 : 1,
        session_opened_at: paymentSession.opened_at,
      };

      await db.from("payment_verifications").update({ status: "processing" }).eq("id", row.id);
      const result = await verifyAndRecordPayment(pvRow);

      if (result.ok) {
        await db.from("payment_verifications").update({
          status: "verified",
          payment_id: result.paymentId,
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);
        return json({
          ok: true,
          verification_id: row.id,
          status: "verified",
          payment_id: result.paymentId,
          sender_wallet: result.extractedSender,
        });
      } else {
        await db.from("payment_verifications").update({
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
    console.error("[payment/paste-verify] unexpected error:", err);
    return json({ ok: false, error: "unknown" }, 500);
  }
}
