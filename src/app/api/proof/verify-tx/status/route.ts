/**
 * GET /api/proof/verify-tx/status?id={verification_id}
 *
 * Poll endpoint for paste-verify flow. Returns current verification
 * status + queue position if still waiting.
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
    .select("id, status, failure_check, failure_detail, attempt_number, proof_id, processed_at, created_at")
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

  // If verified, fetch the Solscan URL for the proof
  let solscan_url: string | null = null;
  if (row.status === "verified" && row.proof_id) {
    const { data: proof } = await db
      .from("proofs")
      .select("tx_signature")
      .eq("id", row.proof_id)
      .single();
    if (proof?.tx_signature) {
      solscan_url = `https://solscan.io/tx/${proof.tx_signature}`;
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
  });
}
