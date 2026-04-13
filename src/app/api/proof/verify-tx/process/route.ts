/**
 * POST /api/proof/verify-tx/process
 *
 * Cron consumer — FALLBACK verification path for proof flow V3.
 * Picks up queued proof verifications every 60 seconds, verifies them
 * against Helius RPC. Catches anything the webhook missed.
 *
 * V3 changes:
 *   - Removed check #2 (sender must match connected pubkey) — user is anonymous
 *   - Shares verification logic with webhook via proof-verification.ts
 *   - Extracts sender from accountKeys[0], writes back to proof_verifications.pubkey
 *   - Adds session timestamp check, self-proof check, dev-path check
 *   - Passes comment through to proofs.note
 *
 * Protected by CRON_SECRET.
 */

import { Connection } from "@solana/web3.js";
import { supabaseService } from "@/lib/db/client";
import { verifyAndRecordProof, RPC_URL, type VerificationRow } from "@/lib/proof-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = supabaseService();
  const start = Date.now();

  const { data: rows, error: fetchErr } = await db
    .from("proof_verifications")
    .select("id, signature, pubkey, path, token, work_item_id, profile_id, attempt_number, comment, session_opened_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr || !rows || rows.length === 0) {
    return json({ processed: 0, ms: Date.now() - start });
  }

  // Mark as processing (claim)
  const ids = rows.map((r: VerificationRow) => r.id);
  await db
    .from("proof_verifications")
    .update({ status: "processing" })
    .in("id", ids);

  const connection = new Connection(RPC_URL, "confirmed");
  let processed = 0;
  let verified = 0;
  let failed = 0;

  for (const row of rows as VerificationRow[]) {
    const result = await verifyAndRecordProof(row, connection);
    processed++;

    if (result.ok) {
      await db
        .from("proof_verifications")
        .update({
          status: "verified",
          proof_id: result.proofId,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      verified++;
    } else {
      await db
        .from("proof_verifications")
        .update({
          status: "failed",
          failure_check: result.check,
          failure_detail: result.detail,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  console.log(
    `[verify-tx/process] batch done: ${processed} processed, ${verified} verified, ${failed} failed, ${Date.now() - start}ms`,
  );

  return json({ processed, verified, failed, ms: Date.now() - start });
}
