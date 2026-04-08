/**
 * Payments dual-write integration test.
 *
 * Verifies upsert idempotency end-to-end against Supabase: a duplicate
 * tx_signature must NOT raise (the unique constraint catches it and the
 * adapter swallows code 23505), and markConfirmed must transition the
 * row to status=confirmed.
 *
 * Skipped without env, same convention as quotes-dual-write.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_PAYMENTS === "dual";

const reason = !haveEnv
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_PAYMENTS=dual"
  : undefined;

test("payments dual-write: insert + idempotency + confirm", { skip: reason }, async () => {
  const { upsertByTxSignature, markConfirmed, __resetStore } = await import(
    "../../src/lib/payments-store"
  );
  const paymentsDb = await import("../../src/lib/db/payments-adapter");
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  await paymentsDb.__resetPaymentsDb();
  __resetStore();

  // Seed FK chain.
  const { data: op } = await sb
    .from("operators")
    .insert({ terminal_wallet: "WalletPayDual", terminal_id: "SHIFT-PAYT-0001-0001-0001" })
    .select()
    .single();
  const { data: pf } = await sb
    .from("profiles")
    .insert({ operator_id: op!.id, handle: `pay_dual_${Date.now()}` })
    .select()
    .single();

  const tx = `TX_DUAL_${Date.now()}`;

  try {
    const a = upsertByTxSignature({
      kind: "subscription",
      refId: null,
      operatorId: null,
      profileId: pf!.id,
      payerWallet: "PayerXYZ",
      token: "USDT",
      amountUsd: 5,
      amountToken: 5,
      discountApplied: false,
      quoteId: null,
      txSignature: tx,
      status: "pending",
      confirmedAt: null,
    });
    assert.equal(a.created, true);

    // Second call — must be a no-op idempotent return, NOT throw on the
    // unique constraint when the fire-and-forget hits the DB.
    const b = upsertByTxSignature({
      kind: "subscription",
      refId: null,
      operatorId: null,
      profileId: pf!.id,
      payerWallet: "PayerXYZ",
      token: "USDT",
      amountUsd: 5,
      amountToken: 5,
      discountApplied: false,
      quoteId: null,
      txSignature: tx,
      status: "pending",
      confirmedAt: null,
    });
    assert.equal(b.created, false);

    // Let both fire-and-forget inserts settle.
    await new Promise((r) => setTimeout(r, 600));

    const fetched = await paymentsDb.getPaymentByTxSignature(tx);
    assert.ok(fetched, "row exists in Supabase");
    assert.equal(fetched!.status, "pending");

    markConfirmed(tx);
    await new Promise((r) => setTimeout(r, 400));
    const after = await paymentsDb.getPaymentByTxSignature(tx);
    assert.equal(after!.status, "confirmed");
    assert.ok(after!.confirmedAt);
  } finally {
    await paymentsDb.__resetPaymentsDb();
    await sb.from("profiles").delete().eq("id", pf!.id);
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
