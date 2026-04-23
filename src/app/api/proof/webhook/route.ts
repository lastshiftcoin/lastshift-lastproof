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
import { verifyAndRecordPayment, type PaymentVerificationRow } from "@/lib/payment-verification";

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
    let payMatched = 0;
    let payVerified = 0;
    let payFailed = 0;

    for (const txData of transactions) {
      const tx = txData as { signature?: string };
      if (!tx.signature) continue;

      // Try to match against queued proof_verification
      const { data: proofRow } = await db
        .from("proof_verifications")
        .select("id, signature, pubkey, path, token, work_item_id, profile_id, attempt_number, comment, session_opened_at")
        .eq("signature", tx.signature)
        .in("status", ["queued", "processing"])
        .single();

      if (proofRow) {
        matched++;

        await db
          .from("proof_verifications")
          .update({ status: "processing" })
          .eq("id", proofRow.id);

        const result = await verifyAndRecordProof(proofRow as VerificationRow);

        if (result.ok) {
          await db
            .from("proof_verifications")
            .update({
              status: "verified",
              proof_id: result.proofId,
              processed_at: new Date().toISOString(),
            })
            .eq("id", proofRow.id);
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
            .eq("id", proofRow.id);
          failed++;
        }

        await db.from("pending_webhook_sigs").delete().eq("signature", tx.signature);
        continue;
      }

      // Try to match against queued payment_verification
      const { data: payRow } = await db
        .from("payment_verifications")
        .select("id, signature, pubkey, kind, token, profile_id, ref_id, attempt_number, session_opened_at")
        .eq("signature", tx.signature)
        .in("status", ["queued", "processing"])
        .single();

      if (payRow) {
        payMatched++;

        await db
          .from("payment_verifications")
          .update({ status: "processing" })
          .eq("id", payRow.id);

        const result = await verifyAndRecordPayment(payRow as PaymentVerificationRow);

        if (result.ok) {
          await db
            .from("payment_verifications")
            .update({
              status: "verified",
              payment_id: result.paymentId,
              processed_at: new Date().toISOString(),
            })
            .eq("id", payRow.id);
          payVerified++;
        } else {
          await db
            .from("payment_verifications")
            .update({
              status: "failed",
              failure_check: result.check,
              failure_detail: result.detail,
              processed_at: new Date().toISOString(),
            })
            .eq("id", payRow.id);
          payFailed++;
        }

        await db.from("pending_webhook_sigs").delete().eq("signature", tx.signature);
        continue;
      }

      // No match in either table — cache for later
      await db
        .from("pending_webhook_sigs")
        .upsert(
          { signature: tx.signature, received_at: new Date().toISOString() },
          { onConflict: "signature" },
        );
      cached++;
    }

    console.log(
      `[proof/webhook] proofs: ${matched} matched, ${verified} verified, ${failed} failed | payments: ${payMatched} matched, ${payVerified} verified, ${payFailed} failed | ${cached} cached`,
    );

    return json({ ok: true, matched, verified, failed, payMatched, payVerified, payFailed, cached });
  } catch (err) {
    console.error("[proof/webhook] error:", err);
    return json({ ok: true });
  }
}
