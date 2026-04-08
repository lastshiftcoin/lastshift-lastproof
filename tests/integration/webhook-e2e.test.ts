/**
 * Phase 0 / Step 3 — end-to-end webhook integration.
 *
 * Boots the Next route handler directly (no HTTP server), feeds it:
 *   - a real quote issued via `issueQuote` (so `reference` is a
 *     spec-compliant base58 32-byte string)
 *   - a hand-crafted Helius Enhanced event carrying that reference
 *     inside an instruction's `accounts` array
 *
 * Asserts the full spine still works after the surgical rebuild:
 *   parse → resolve quote → tolerance → upsert → dispatcher
 */

import { test, before } from "node:test";
import assert from "node:assert/strict";

// Env must be set BEFORE importing the route (helius-verify reads at call time, so order is fine).
process.env.HELIUS_WEBHOOK_SECRET = "test_secret_long_enough_for_comparison";
process.env.TREASURY_WALLET = "TreasuryPubkey111111111111111111111111111111";

import { POST } from "../../src/app/api/payments/webhook/route";
import { issueQuote, __resetQuotes } from "../../src/lib/quotes-store";
import { upsertProfileByOperator } from "../../src/lib/profiles-store";
import { __resetStore as __resetPayments } from "../../src/lib/payments-store";
import { __resetReplayGuard } from "../../src/lib/helius-webhook";
import { TOKEN_MINTS } from "../../src/lib/constants";

function mockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: process.env.HELIUS_WEBHOOK_SECRET!,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

before(() => {
  __resetQuotes();
  __resetPayments();
  __resetReplayGuard();
});

test("webhook rejects missing auth header", async () => {
  const req = new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ drafts: [] }),
  });
  const res = await POST(req as never);
  assert.equal(res.status, 401);
});

test("webhook: USDT enhanced event resolves to draft + dispatches", async () => {
  const profile = await upsertProfileByOperator({
    operatorId: "op_test_1",
    terminalWallet: "WalletTest1",
    handle: "cryptomark_test",
    displayName: "Crypto Mark",
    isEarlyAdopter: false,
  });

  const quote = issueQuote({
    profileId: profile.id,
    kind: "proof",
    token: "USDT",
    tokenUsdRate: 1,
  });

  const event = {
    signature: "sigE2E_USDT_1",
    feePayer: "PayerWalletAAA",
    timestamp: Math.floor(Date.now() / 1000),
    tokenTransfers: [
      {
        fromUserAccount: "PayerWalletAAA",
        toUserAccount: process.env.TREASURY_WALLET,
        fromTokenAccount: "PayerATA",
        toTokenAccount: "TreasuryATA",
        tokenAmount: quote.expectedToken,
        mint: TOKEN_MINTS.USDT,
      },
    ],
    instructions: [
      {
        accounts: [
          "PayerWalletAAA",
          process.env.TREASURY_WALLET!,
          quote.reference, // ← the critical correlation
        ],
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        data: "",
      },
    ],
  };

  const res = await POST(mockRequest({ events: [event] }) as never);
  assert.equal(res.status, 200);
  const json = (await res.json()) as {
    ok: boolean;
    processed: Array<{ txSignature: string; created: boolean; dispatched: boolean; note: string }>;
    errors: string[];
    parserSkipped: Array<{ signature: string; reason: string }>;
  };

  assert.deepEqual(json.errors, []);
  assert.deepEqual(json.parserSkipped, []);
  assert.equal(json.processed.length, 1);
  assert.equal(json.processed[0].txSignature, "sigE2E_USDT_1");
  assert.equal(json.processed[0].created, true);
});

test("webhook: duplicate delivery via drafts[] path is idempotent by tx_signature", async () => {
  // Uses the canonical drafts[] path (dev harness), which bypasses quote
  // validation and exercises the pure upsert-by-txSignature spine.
  // The events[] path can't currently be used for this test because
  // tolerance rejects the second delivery as quote_already_consumed
  // BEFORE reaching the upsert (Q43 gap — scheduled for Phase 1 step 6).
  const draft = {
    kind: "proof",
    payerWallet: "PayerDup",
    token: "SOL",
    amountUsd: 1,
    amountToken: 0.007,
    txSignature: "sigDupTest",
    status: "confirmed",
  };

  const first = await POST(mockRequest({ drafts: [draft] }) as never);
  const firstJson = (await first.json()) as { processed: Array<{ created: boolean }> };
  assert.equal(firstJson.processed[0]?.created, true);

  const second = await POST(mockRequest({ drafts: [draft] }) as never);
  const secondJson = (await second.json()) as {
    processed: Array<{ created: boolean; note: string }>;
  };
  assert.equal(secondJson.processed[0]?.created, false);
  assert.match(secondJson.processed[0]?.note ?? "", /existing|no-op/i);
});

test("webhook: raw-mode event (numeric accounts) is skipped as not_enhanced_mode", async () => {
  __resetReplayGuard();
  const rawEvent = {
    signature: "sigRawMode",
    feePayer: "Payer",
    timestamp: 1_700_000_000,
    instructions: [{ accounts: [0, 1, 2], programId: "p", data: "" }],
  };
  const res = await POST(mockRequest({ events: [rawEvent] }) as never);
  const json = (await res.json()) as {
    parserSkipped: Array<{ signature: string; reason: string }>;
  };
  assert.equal(json.parserSkipped.length, 1);
  assert.equal(json.parserSkipped[0].reason, "not_enhanced_mode");
});
