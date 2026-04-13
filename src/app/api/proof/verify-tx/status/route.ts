/**
 * GET /api/proof/verify-tx/status?id={verification_id}
 *
 * Poll endpoint for paste-verify flow. V3 additions:
 *   - sender_pubkey: extracted sender wallet (from proof_verifications.pubkey after extraction)
 *   - comment: user comment from Screen 4
 *   - proof_data: full proof details for receipt screen (on verified)
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
    .from("proof_verifications")
    .select("id, status, failure_check, failure_detail, attempt_number, proof_id, processed_at, created_at, pubkey, comment, path, token, work_item_id, profile_id")
    .eq("id", id)
    .single();

  if (error || !row) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  // If still queued, return queue position
  let queue_position: number | null = null;
  if (row.status === "queued") {
    const { count } = await db
      .from("proof_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .lt("created_at", row.created_at);
    queue_position = (count ?? 0) + 1;
  }

  // If verified, fetch full proof data for receipt screen
  let solscan_url: string | null = null;
  let proof_data: Record<string, unknown> | null = null;
  if (row.status === "verified" && row.proof_id) {
    const { data: proof } = await db
      .from("proofs")
      .select("id, tx_signature, payer_wallet, note, kind, created_at, work_item_id")
      .eq("id", row.proof_id)
      .single();

    if (proof?.tx_signature) {
      solscan_url = `https://solscan.io/tx/${proof.tx_signature}`;
    }

    if (proof) {
      // Get work item details for receipt
      const { data: workItem } = await db
        .from("work_items")
        .select("ticker, role")
        .eq("id", proof.work_item_id)
        .single();

      // Get profile handle for receipt
      const { data: profile } = await db
        .from("profiles")
        .select("handle")
        .eq("id", row.profile_id)
        .single();

      // Get proof count for tier display
      const { count: proofCount } = await db
        .from("proofs")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", row.profile_id)
        .in("kind", ["proof", "dev_verification"]);

      proof_data = {
        proof_id: proof.id,
        tx_signature: proof.tx_signature,
        sender_wallet: proof.payer_wallet,
        comment: proof.note,
        kind: proof.kind,
        token: row.token,
        path: row.path,
        created_at: proof.created_at,
        work_item_ticker: workItem?.ticker ?? null,
        work_item_role: workItem?.role ?? null,
        handle: profile?.handle ?? null,
        proof_count: proofCount ?? 0,
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
    proof_id: row.proof_id,
    queue_position,
    solscan_url,
    sender_pubkey: row.pubkey,
    comment: row.comment,
    proof_data,
  });
}
