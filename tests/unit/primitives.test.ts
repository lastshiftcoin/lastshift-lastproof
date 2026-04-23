/**
 * Phase 0 / Step 2 — unit tests for the on-chain boundary primitives.
 *
 * Runner: node:test via tsx. No external test framework.
 * Run with: `npm test` (see package.json "test" script).
 *
 * These tests lock the spec into code so future refactors can't silently
 * regress the Solana Pay / Helius / wallet-policy contracts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { encodeBase58, decodeBase58, generateReferenceBase58 } from "../../src/lib/base58";
import { buildTransferRequestUri, formatAmount } from "../../src/lib/solana-pay";
import { classifyWallet, isAllowlisted } from "../../src/lib/wallet-policy";
import {
  isEnhancedEvent,
  markSeen,
  collectReferencedKeys,
  __resetReplayGuard,
  type HeliusEnhancedEvent,
} from "../../src/lib/helius-webhook";

// ─── base58 ─────────────────────────────────────────────────────────────────

test("base58: encodes empty to empty", () => {
  assert.equal(encodeBase58(new Uint8Array()), "");
});

test("base58: known vector — single zero byte is '1'", () => {
  assert.equal(encodeBase58(new Uint8Array([0])), "1");
});

test("base58: known vector — 0x00 0x00 0x01 is '112'", () => {
  assert.equal(encodeBase58(new Uint8Array([0, 0, 1])), "112");
});

test("base58: round-trips 32 random bytes", () => {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = (i * 7 + 3) & 0xff;
  const enc = encodeBase58(bytes);
  const dec = decodeBase58(enc);
  assert.deepEqual(Array.from(dec), Array.from(bytes));
});

test("base58: generateReferenceBase58 is non-empty, uniqueish, decodes to 32 bytes", () => {
  const a = generateReferenceBase58();
  const b = generateReferenceBase58();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32 && a.length <= 44); // typical base58 length for 32 bytes
  assert.equal(decodeBase58(a).length, 32);
});

test("base58: rejects invalid char on decode", () => {
  assert.throws(() => decodeBase58("0OIl"), /invalid base58 char/);
});

// ─── solana-pay URI ─────────────────────────────────────────────────────────

test("formatAmount: plain decimal, trims trailing zeros", () => {
  assert.equal(formatAmount(1.25, 6), "1.25");
  assert.equal(formatAmount(1, 6), "1");
  assert.equal(formatAmount(0.1, 6), "0.1");
});

test("formatAmount: rejects NaN / Infinity / negative", () => {
  assert.throws(() => formatAmount(NaN, 6));
  assert.throws(() => formatAmount(Infinity, 6));
  assert.throws(() => formatAmount(-1, 6));
});

test("buildTransferRequestUri: SOL path omits spl-token", () => {
  const uri = buildTransferRequestUri({
    recipient: "TreasuryPubkey111111111111111111111111111111",
    amount: "0.5",
    token: "SOL",
    references: ["RefOne1111111111111111111111111111111111111"],
  });
  assert.ok(uri.startsWith("solana:TreasuryPubkey111111111111111111111111111111?"));
  assert.ok(uri.includes("amount=0.5"));
  assert.ok(!uri.includes("spl-token="));
  assert.ok(uri.includes("reference=RefOne1111111111111111111111111111111111111"));
});

test("buildTransferRequestUri: SPL path includes mint", () => {
  const uri = buildTransferRequestUri({
    recipient: "TreasuryPubkey111111111111111111111111111111",
    amount: "1.25",
    token: "USDT",
    references: ["RefOne"],
  });
  assert.ok(uri.includes("spl-token=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"));
});

test("buildTransferRequestUri: repeated reference preserves order and count", () => {
  const uri = buildTransferRequestUri({
    recipient: "Treasury",
    amount: "1",
    token: "SOL",
    references: ["RefA", "RefB", "RefC"],
  });
  // URLSearchParams.toString appends each value separately.
  const refs = uri.split("&").filter((p) => p.startsWith("reference=") || p.includes("?reference="));
  assert.equal(refs.length, 3);
  assert.ok(uri.indexOf("RefA") < uri.indexOf("RefB"));
  assert.ok(uri.indexOf("RefB") < uri.indexOf("RefC"));
});

test("buildTransferRequestUri: requires at least one reference", () => {
  assert.throws(() =>
    buildTransferRequestUri({
      recipient: "Treasury",
      amount: "1",
      token: "SOL",
      references: [],
    }),
  );
});

test("buildTransferRequestUri: url-encodes label/message/memo", () => {
  const uri = buildTransferRequestUri({
    recipient: "Treasury",
    amount: "1",
    token: "SOL",
    references: ["R"],
    label: "LAST PROOF",
    memo: "order #42",
  });
  assert.ok(uri.includes("label=LAST+PROOF") || uri.includes("label=LAST%20PROOF"));
  assert.ok(uri.includes("memo=order+%2342") || uri.includes("memo=order%20%2342"));
});

// ─── wallet-policy ──────────────────────────────────────────────────────────

test("classifyWallet: Phantom is allowed", () => {
  const c = classifyWallet("Phantom");
  assert.equal(c.tier, "allowed");
  assert.equal(c.canonical, "phantom");
  assert.equal(c.supportsTransferRequestUri, true);
});

test("classifyWallet: Solflare is allowed", () => {
  assert.equal(classifyWallet("Solflare").tier, "allowed");
});

test("classifyWallet: Jupiter Mobile is allowed (no Transfer Request URI)", () => {
  const c = classifyWallet("Jupiter Mobile");
  assert.equal(c.tier, "allowed");
  assert.equal(c.supportsTransferRequestUri, false);
});

test("classifyWallet: Binance App is allowed", () => {
  const c = classifyWallet("Binance Wallet");
  assert.equal(c.tier, "allowed");
  assert.equal(c.canonical, "binance");
});

test("classifyWallet: unknown wallet is blocked", () => {
  const c = classifyWallet("RandomWallet");
  assert.equal(c.tier, "blocked");
  assert.equal(c.reason, "wallet_not_on_allowlist");
});

test("classifyWallet: null is blocked with no_wallet_connected", () => {
  const c = classifyWallet(null);
  assert.equal(c.tier, "blocked");
  assert.equal(c.reason, "no_wallet_connected");
});

test("isAllowlisted: verified and unverified are allowed; blocked is not", () => {
  assert.equal(isAllowlisted("Phantom"), true);
  assert.equal(isAllowlisted("Jupiter Mobile"), true);
  assert.equal(isAllowlisted("RandomWallet"), false);
});

// ─── helius-webhook ─────────────────────────────────────────────────────────

const enhancedFixture: HeliusEnhancedEvent = {
  signature: "sigEnhanced1",
  feePayer: "Payer1",
  timestamp: 1_700_000_000,
  instructions: [
    {
      accounts: ["Payer1", "Treasury", "RefPubkey"],
      programId: "11111111111111111111111111111111",
      data: "",
      innerInstructions: [
        { accounts: ["NestedRef"], programId: "P", data: "" },
      ],
    },
  ],
};

test("isEnhancedEvent: accepts valid enhanced event", () => {
  assert.equal(isEnhancedEvent(enhancedFixture), true);
});

test("isEnhancedEvent: rejects raw-mode numeric accounts", () => {
  const raw = {
    signature: "s",
    feePayer: "f",
    timestamp: 1,
    instructions: [{ accounts: [0, 1, 2], programId: "p", data: "" }],
  };
  assert.equal(isEnhancedEvent(raw), false);
});

test("isEnhancedEvent: rejects missing required fields", () => {
  assert.equal(isEnhancedEvent({ signature: "s" }), false);
  assert.equal(isEnhancedEvent(null), false);
});

test("collectReferencedKeys: includes inner instruction accounts", () => {
  const keys = collectReferencedKeys(enhancedFixture);
  assert.ok(keys.has("Payer1"));
  assert.ok(keys.has("Treasury"));
  assert.ok(keys.has("RefPubkey"));
  assert.ok(keys.has("NestedRef"));
});

test("markSeen: first call true, second call false", () => {
  __resetReplayGuard();
  assert.equal(markSeen("sigA"), true);
  assert.equal(markSeen("sigA"), false);
  assert.equal(markSeen("sigB"), true);
});
