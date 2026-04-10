/**
 * Tier computation tests — locks the wireframe-canonical tier thresholds,
 * the T5 sentinel, label formatting, and profile variant derivation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeTier,
  TIER_THRESHOLDS,
  TIER_LABEL,
  formatTierLabel,
  deriveProfileVariant,
  type Tier,
} from "../../src/lib/tier";

// ─── computeTier() ─────────────────────────────────────────────────────────

test("tier: unpaid profile returns T5 sentinel regardless of proofs", () => {
  assert.equal(computeTier({ isPaid: false, isPublished: true, proofsConfirmed: 999 }), 5);
});

test("tier: unpublished profile returns T5 sentinel regardless of proofs", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: false, proofsConfirmed: 999 }), 5);
});

test("tier: 0 proofs → TIER 1 NEW", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 0 }), 1);
});

test("tier: 9 proofs → still TIER 1 NEW", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 9 }), 1);
});

test("tier: 10 proofs → TIER 2 VERIFIED", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 10 }), 2);
});

test("tier: 24 proofs → still TIER 2 VERIFIED", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 24 }), 2);
});

test("tier: 25 proofs → TIER 3 EXPERIENCED", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 25 }), 3);
});

test("tier: 49 proofs → still TIER 3 EXPERIENCED", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 49 }), 3);
});

test("tier: 50 proofs → TIER 4 LEGEND", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 50 }), 4);
});

test("tier: 500 proofs → still TIER 4 LEGEND (no T5+ for high counts)", () => {
  assert.equal(computeTier({ isPaid: true, isPublished: true, proofsConfirmed: 500 }), 4);
});

// ─── thresholds match spec ─────────────────────────────────────────────────

test("tier: thresholds match wireframe spec", () => {
  assert.equal(TIER_THRESHOLDS.verifiedProofs, 10);
  assert.equal(TIER_THRESHOLDS.experiencedProofs, 25);
  assert.equal(TIER_THRESHOLDS.legendProofs, 50);
});

// ─── labels ────────────────────────────────────────────────────────────────

test("tier: label map covers all tiers", () => {
  assert.equal(TIER_LABEL[1], "NEW");
  assert.equal(TIER_LABEL[2], "VERIFIED");
  assert.equal(TIER_LABEL[3], "EXPERIENCED");
  assert.equal(TIER_LABEL[4], "LEGEND");
  assert.equal(TIER_LABEL[5], "UNLISTED");
});

// ─── formatTierLabel() ─────────────────────────────────────────────────────

test("tier: formatTierLabel pairs number with word (§3 rule)", () => {
  assert.equal(formatTierLabel(1), "TIER 1 · NEW");
  assert.equal(formatTierLabel(2), "TIER 2 · VERIFIED");
  assert.equal(formatTierLabel(3), "TIER 3 · EXPERIENCED");
  assert.equal(formatTierLabel(4), "TIER 4 · LEGEND");
});

test("tier: formatTierLabel returns null for T5", () => {
  assert.equal(formatTierLabel(5), null);
});

// ─── deriveProfileVariant() ────────────────────────────────────────────────

test("tier: variant for T5 is 'free' regardless of EA status", () => {
  assert.equal(deriveProfileVariant({ tier: 5, isEarlyAdopter: false }), "free");
  assert.equal(deriveProfileVariant({ tier: 5, isEarlyAdopter: true }), "free");
});

test("tier: variant for paid EA operator is 'legend'", () => {
  assert.equal(deriveProfileVariant({ tier: 1, isEarlyAdopter: true }), "legend");
  assert.equal(deriveProfileVariant({ tier: 4, isEarlyAdopter: true }), "legend");
});

test("tier: variant for paid non-EA operator is 'public'", () => {
  assert.equal(deriveProfileVariant({ tier: 1, isEarlyAdopter: false }), "public");
  assert.equal(deriveProfileVariant({ tier: 4, isEarlyAdopter: false }), "public");
});

// ─── boundary: exact thresholds ────────────────────────────────────────────

test("tier: boundary values are inclusive (≥ not >)", () => {
  const paid = { isPaid: true, isPublished: true };
  // Exactly at each threshold
  assert.equal(computeTier({ ...paid, proofsConfirmed: 10 }), 2);
  assert.equal(computeTier({ ...paid, proofsConfirmed: 25 }), 3);
  assert.equal(computeTier({ ...paid, proofsConfirmed: 50 }), 4);
  // One below each threshold
  assert.equal(computeTier({ ...paid, proofsConfirmed: 9 }), 1);
  assert.equal(computeTier({ ...paid, proofsConfirmed: 24 }), 2);
  assert.equal(computeTier({ ...paid, proofsConfirmed: 49 }), 3);
});
