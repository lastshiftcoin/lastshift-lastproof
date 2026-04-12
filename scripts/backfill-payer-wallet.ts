/**
 * scripts/backfill-payer-wallet.ts
 *
 * One-time backfill: joins proofs → payments on tx_signature and
 * populates proofs.payer_wallet from payments.payer_wallet.
 *
 * Run AFTER applying migration 0008_proofs_payer_wallet.sql.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/backfill-payer-wallet.ts
 *
 * Safe to re-run — only updates rows where payer_wallet IS NULL.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  // Fetch all proofs missing payer_wallet
  const { data: proofs, error: proofErr } = await sb
    .from("proofs")
    .select("id, tx_signature")
    .is("payer_wallet", null)
    .not("tx_signature", "is", null);

  if (proofErr) {
    console.error("Failed to fetch proofs:", proofErr.message);
    process.exit(1);
  }

  if (!proofs || proofs.length === 0) {
    console.log("No proofs need backfilling.");
    return;
  }

  console.log(`Found ${proofs.length} proofs to backfill.`);

  let updated = 0;
  let skipped = 0;

  for (const proof of proofs) {
    if (!proof.tx_signature) {
      skipped++;
      continue;
    }

    // Look up the payment by tx_signature
    const { data: payment } = await sb
      .from("payments")
      .select("payer_wallet")
      .eq("tx_signature", proof.tx_signature)
      .maybeSingle();

    if (!payment?.payer_wallet) {
      console.log(`  SKIP proof ${proof.id} — no matching payment for tx ${proof.tx_signature}`);
      skipped++;
      continue;
    }

    const { error: updateErr } = await sb
      .from("proofs")
      .update({ payer_wallet: payment.payer_wallet })
      .eq("id", proof.id);

    if (updateErr) {
      console.error(`  FAIL proof ${proof.id}:`, updateErr.message);
      skipped++;
    } else {
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
