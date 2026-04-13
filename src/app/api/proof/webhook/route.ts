/**
 * POST /api/proof/webhook
 *
 * Helius webhook receiver — PRIMARY verification path for proof flow V3.
 * Fires within 1-5 seconds of a TX hitting the treasury wallet.
 *
 * Flow:
 *   1. Helius sends enhanced TX data when treasury receives a transfer
 *   2. We extract the TX signature from the webhook payload
 *   3. Match against queued proof_verifications rows
 *   4. Run full verification pipeline (shared with cron fallback)
 *   5. Update row status to "verified" or "failed"
 *
 * Auth: same HELIUS_WEBHOOK_SECRET as the payments webhook.
 * Both endpoints watch the same treasury address.
 */

import { supabaseService } from "@/lib/db/client";
import { verifyHeliusRequest } from "@/lib/helius-verify";
import { verifyAndRecordProof, type VerificationRow } from "@/lib/proof-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // ─── Auth — same secret as payments webhook ───────────────────────
  const auth = verifyHeliusRequest(req);
  if (!auth.ok) {
    return json({ error: "unauthorized", reason: auth.reason }, 401);
  }

  try {
    const body = await req.json();

    // Helius sends an array of enhanced transactions
    const transactions: unknown[] = Array.isArray(body) ? body : [body];

    const db = supabaseService();
    let matched = 0;
    let verified = 0;
    let failed = 0;

    for (const txData of transactions) {
      const tx = txData as {
        signature?: string;
        type?: string;
        description?: string;
      };

      if (!tx.signature) continue;

      // Find matching queued proof_verification
      const { data: row } = await db
        .from("proof_verifications")
        .select("id, signature, pubkey, path, token, work_item_id, profile_id, attempt_number, comment, session_opened_at")
        .eq("signature", tx.signature)
        .in("status", ["queued", "processing"])
        .single();

      if (!row) continue; // No matching queue entry — ignore this TX
      matched++;

      // Mark as processing
      await db
        .from("proof_verifications")
        .update({ status: "processing" })
        .eq("id", row.id);

      // Run shared verification pipeline
      const result = await verifyAndRecordProof(row as VerificationRow);

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
      `[proof/webhook] processed: ${matched} matched, ${verified} verified, ${failed} failed`,
    );

    return json({ ok: true, matched, verified, failed });
  } catch (err) {
    console.error("[proof/webhook] error:", err);
    return json({ ok: true }); // Always 200 to prevent Helius retries on our errors
  }
}
