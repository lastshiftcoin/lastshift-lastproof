/**
 * Pricing logic tests — locks the pricing table, discount rules, and
 * tolerance math into unit tests so nothing silently regresses.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BASE_PRICES_USD,
  LASTSHFT_DISCOUNT,
  priceFor,
  toleranceForUsd,
  quoteTtlSec,
  type PaymentKindPriced,
  type PaymentToken,
} from "../../src/lib/pricing";

// ─── Base price table ──────────────────────────────────────────────────────

test("pricing: base prices match spec", () => {
  assert.equal(BASE_PRICES_USD.proof, 1.0);
  assert.equal(BASE_PRICES_USD.dev_verification, 5.0);
  assert.equal(BASE_PRICES_USD.subscription, 10.0);
  assert.equal(BASE_PRICES_USD.handle_change, 100.0);
  assert.equal(BASE_PRICES_USD.mint, 1.0);
});

test("pricing: LASTSHFT discount is 40%", () => {
  assert.equal(LASTSHFT_DISCOUNT, 0.4);
});

// ─── priceFor() ────────────────────────────────────────────────────────────

test("priceFor: SOL returns base price", () => {
  assert.equal(priceFor("proof", "SOL"), 1.0);
  assert.equal(priceFor("subscription", "SOL"), 10.0);
  assert.equal(priceFor("handle_change", "SOL"), 100.0);
});

test("priceFor: USDT returns base price", () => {
  assert.equal(priceFor("proof", "USDT"), 1.0);
  assert.equal(priceFor("dev_verification", "USDT"), 5.0);
});

test("priceFor: LASTSHFT applies 40% discount", () => {
  assert.equal(priceFor("proof", "LASTSHFT"), 0.6);
  assert.equal(priceFor("dev_verification", "LASTSHFT"), 3.0);
  assert.equal(priceFor("subscription", "LASTSHFT"), 6.0);
  assert.equal(priceFor("handle_change", "LASTSHFT"), 60.0);
  assert.equal(priceFor("mint", "LASTSHFT"), 0.6);
});

test("priceFor: all 5 kinds × 3 tokens produce positive numbers", () => {
  const kinds: PaymentKindPriced[] = [
    "proof",
    "dev_verification",
    "subscription",
    "handle_change",
    "mint",
  ];
  const tokens: PaymentToken[] = ["LASTSHFT", "SOL", "USDT"];
  for (const k of kinds) {
    for (const t of tokens) {
      const p = priceFor(k, t);
      assert.ok(p > 0, `${k}/${t} should be positive, got ${p}`);
      assert.ok(Number.isFinite(p), `${k}/${t} should be finite`);
    }
  }
});

// ─── toleranceForUsd() ─────────────────────────────────────────────────────

test("toleranceForUsd: uses 2% for large amounts", () => {
  // $10 → 2% = $0.20, which is above the $0.05 floor
  assert.equal(toleranceForUsd(10), 0.2);
});

test("toleranceForUsd: uses $0.05 floor for small amounts", () => {
  // $1 → 2% = $0.02, but floor is $0.05
  assert.equal(toleranceForUsd(1), 0.05);
});

test("toleranceForUsd: zero amount returns floor", () => {
  assert.equal(toleranceForUsd(0), 0.05);
});

// ─── quoteTtlSec() ─────────────────────────────────────────────────────────

test("quoteTtlSec: USDT is 300s (5 min stablecoin window)", () => {
  assert.equal(quoteTtlSec("USDT"), 300);
});

test("quoteTtlSec: SOL is 60s (volatile)", () => {
  assert.equal(quoteTtlSec("SOL"), 60);
});

test("quoteTtlSec: LASTSHFT is 60s (volatile)", () => {
  assert.equal(quoteTtlSec("LASTSHFT"), 60);
});
