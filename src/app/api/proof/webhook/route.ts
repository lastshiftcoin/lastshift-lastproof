/**
 * POST /api/proof/webhook
 *
 * Helius webhook receiver — PRIMARY verification path for proof flow V3.
 * Fires within 1-5 seconds of a TX hitting the treasury wallet.
 *
 * Key insight: Helius fires when the TX hits the chain, which is BEFORE
 * the user pastes and submits the signature. So the webhook often arrives
 * before the queue row exists. We store unmatched signatures in a
 * pending_webhook_sigs table. When the user submits, the verify-tx route
 * checks this table and processes immediately instead of waiting for cron.
 *
 * Auth: same HELIUS_WEBHOOK_SECRET as the payments webhook.
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
  const auth = verifyHeliusRequest(req);
  if (!auth.ok) {
    return json({ error: "unauthorized", reason: auth.reason }, 401);
  }

  try {
    const body = await req.json();
    const transactions: unknown[] = Array.isArray(body) ? body : [body];

    const db = supabaseService();
    let matched = 0;
    let verified = 0;
    let failed = 0;
    let cached = 0;

    for (const txData of transactions) {
      const tx = txData as { signature?: string };
      if (!tx.signature) continue;

      // Try to match against queued proof_verification
      const { data: row } = await db
        .from("proof_verifications")
        .select("id, signature, pubkey, path, token, work_item_id, profile_id, attempt_number, comment, session_opened_at")
        .eq("signature", tx.signature)
        .in("status", ["queued", "processing"])
        .single();

      if (!row) {
        // No queue row yet — user hasn't submitted. Cache the signature
        // so verify-tx can process immediately when the user submits.
        await db
          .from("pending_webhook_sigs")
          .upsert(
            { signature: tx.signature, received_at: new Date().toISOString() },
            { onConflict: "signature" },
          );
        cached++;
        continue;
      }

      matched++;

      await db
        .from("proof_verifications")
        .update({ status: "processing" })
        .eq("id", row.id);

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

      // Clean up cached sig if it was there
      await db.from("pending_webhook_sigs").delete().eq("signature", tx.signature);
    }

    console.log(
      `[proof/webhook] ${matched} matched, ${verified} verified, ${failed} failed, ${cached} cached`,
    );

    return json({ ok: true, matched, verified, failed, cached });
  } catch (err) {
    console.error("[proof/webhook] error:", err);
    return json({ ok: true });
  }
}
