/**
 * GET /api/payment/paste-verify/status?id={verification_id}
 *
 * Poll endpoint for payment paste-verify flow.
 * Returns verification status + payment details on success.
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

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return json({ ok: false, error: "missing id" }, 400);
  }

  const db = supabaseService();

  const { data: row, error } = await db
    .from("payment_verifications")
    .select("id, status, failure_check, failure_detail, attempt_number, payment_id, processed_at, created_at, pubkey, kind, token, profile_id, ref_id")
    .eq("id", id)
    .single();

  if (error || !row) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  // Queue position if still queued
  let queue_position: number | null = null;
  if (row.status === "queued") {
    const { count } = await db
      .from("payment_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .lt("created_at", row.created_at);
    queue_position = (count ?? 0) + 1;
  }

  // Payment details on verified
  let solscan_url: string | null = null;
  let payment_data: Record<string, unknown> | null = null;

  if (row.status === "verified" && row.payment_id) {
    const { data: payment } = await db
      .from("payments")
      .select("id, tx_signature, payer_wallet, kind, token, amount_usd, amount_token, status, created_at, confirmed_at")
      .eq("id", row.payment_id)
      .single();

    if (payment?.tx_signature) {
      solscan_url = `https://solscan.io/tx/${payment.tx_signature}`;
    }

    if (payment) {
      const { data: profile } = await db
        .from("profiles")
        .select("handle")
        .eq("id", row.profile_id)
        .single();

      payment_data = {
        payment_id: payment.id,
        tx_signature: payment.tx_signature,
        sender_wallet: payment.payer_wallet,
        kind: payment.kind,
        token: payment.token,
        amount_usd: payment.amount_usd,
        amount_token: payment.amount_token,
        confirmed_at: payment.confirmed_at,
        handle: profile?.handle ?? null,
        ref_id: row.ref_id,
      };
    }
  }

  return json({
    ok: true,
    verification_id: row.id,
    status: row.status,
    failure_check: row.failure_check,
    failure_detail: row.failure_detail,
    attempt_number: row.attempt_number,
    payment_id: row.payment_id,
    queue_position,
    solscan_url,
    sender_pubkey: row.pubkey,
    payment_data,
  });
}
