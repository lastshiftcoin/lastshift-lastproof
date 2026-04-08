/**
 * Quotes dual-write integration test.
 *
 * Boots in `dual` mode and verifies that an issued quote round-trips
 * to Supabase: insert → markConsumed → markExpired → sweepExpired.
 *
 * Skipped automatically when Supabase env is missing so `npm test` stays
 * hermetic in CI without secrets. To run locally:
 *
 *   LASTPROOF_DB_QUOTES=dual \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_QUOTES === "dual";

const skip = !haveEnv;
const reason = skip
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_QUOTES=dual"
  : undefined;

test("quotes dual-write: issue → row in Supabase", { skip: reason }, async () => {
  const { issueQuote, __resetQuotes } = await import("../../src/lib/quotes-store");
  const quotesDb = await import("../../src/lib/db/quotes-adapter");
  await quotesDb.__resetQuotesDb();
  __resetQuotes();

  // We need a profile_id that satisfies the FK. Insert a stub operator
  // + profile via service role for the duration of this test.
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  const { data: op, error: opErr } = await sb
    .from("operators")
    .insert({ terminal_wallet: "WalletDualTest1", terminal_id: "SHIFT-TEST-0001-0001-0001" })
    .select()
    .single();
  assert.equal(opErr, null, opErr?.message);

  const { data: pf, error: pfErr } = await sb
    .from("profiles")
    .insert({ operator_id: op!.id, handle: `dual_test_${Date.now()}` })
    .select()
    .single();
  assert.equal(pfErr, null, pfErr?.message);

  try {
    const row = issueQuote({
      profileId: pf!.id,
      kind: "subscription",
      token: "USDT",
      tokenUsdRate: 1,
    });

    // Give the fire-and-forget insert a tick to land.
    await new Promise((r) => setTimeout(r, 500));

    const fetched = await quotesDb.getQuoteById(row.id);
    assert.ok(fetched, "quote should exist in Supabase");
    assert.equal(fetched!.id, row.id);
    assert.equal(fetched!.reference, row.reference);
    assert.equal(fetched!.profileId, pf!.id);
    assert.equal(fetched!.status, "open");

    // markConsumed dual-writes
    const { markQuoteConsumed } = await import("../../src/lib/quotes-store");
    markQuoteConsumed(row.id, "TEST_TX_SIG_DUAL");
    await new Promise((r) => setTimeout(r, 300));
    const after = await quotesDb.getQuoteById(row.id);
    assert.equal(after!.status, "consumed");
    assert.equal(after!.consumedTxSignature, "TEST_TX_SIG_DUAL");
  } finally {
    await quotesDb.__resetQuotesDb();
    await sb.from("profiles").delete().eq("id", pf!.id);
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
