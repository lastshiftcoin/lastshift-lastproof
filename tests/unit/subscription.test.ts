/**
 * Subscription state machine + rollover tests — locks the 30-day period,
 * the warning threshold, rollover stacking, and EA publish window.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveState,
  isPaidNow,
  rolloverOnPayment,
  eaPublishExpiry,
  daysRemaining,
  MS_PER_DAY,
  SUBSCRIPTION_PERIOD_DAYS,
  WARNING_THRESHOLD_DAYS,
} from "../../src/lib/subscription";

const now = new Date("2026-04-10T12:00:00Z");

function future(days: number): string {
  return new Date(now.getTime() + days * MS_PER_DAY).toISOString();
}

function past(days: number): string {
  return new Date(now.getTime() - days * MS_PER_DAY).toISOString();
}

// ─── constants ─────────────────────────────────────────────────────────────

test("subscription: period is 30 days (not yearly)", () => {
  assert.equal(SUBSCRIPTION_PERIOD_DAYS, 30);
});

test("subscription: warning threshold is 3 days", () => {
  assert.equal(WARNING_THRESHOLD_DAYS, 3);
});

// ─── deriveState() ─────────────────────────────────────────────────────────

test("subscription: null expiresAt → 'none'", () => {
  assert.equal(deriveState({ expiresAt: null, now }), "none");
});

test("subscription: expired date → 'expired'", () => {
  assert.equal(deriveState({ expiresAt: past(1), now }), "expired");
});

test("subscription: exactly now → 'expired' (boundary: <= now)", () => {
  assert.equal(deriveState({ expiresAt: now.toISOString(), now }), "expired");
});

test("subscription: 1 day left → 'warning'", () => {
  assert.equal(deriveState({ expiresAt: future(1), now }), "warning");
});

test("subscription: 3 days left → 'warning' (boundary: <= 3 days)", () => {
  assert.equal(deriveState({ expiresAt: future(3), now }), "warning");
});

test("subscription: 4 days left → 'active'", () => {
  assert.equal(deriveState({ expiresAt: future(4), now }), "active");
});

test("subscription: 30 days left → 'active'", () => {
  assert.equal(deriveState({ expiresAt: future(30), now }), "active");
});

// ─── isPaidNow() ───────────────────────────────────────────────────────────

test("subscription: isPaidNow true when active", () => {
  assert.equal(isPaidNow({ expiresAt: future(10), now }), true);
});

test("subscription: isPaidNow true when in warning", () => {
  assert.equal(isPaidNow({ expiresAt: future(2), now }), true);
});

test("subscription: isPaidNow false when expired", () => {
  assert.equal(isPaidNow({ expiresAt: past(1), now }), false);
});

test("subscription: isPaidNow false when null", () => {
  assert.equal(isPaidNow({ expiresAt: null, now }), false);
});

// ─── rolloverOnPayment() ───────────────────────────────────────────────────

test("subscription: rollover from none → now + 30d", () => {
  const result = rolloverOnPayment({ expiresAt: null, now });
  const expected = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString();
  assert.equal(result, expected);
});

test("subscription: rollover from expired → now + 30d (resets, no stacking)", () => {
  const result = rolloverOnPayment({ expiresAt: past(5), now });
  const expected = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString();
  assert.equal(result, expected);
});

test("subscription: rollover from active → current expiry + 30d (stacks)", () => {
  const currentExpiry = future(15); // 15 days left
  const result = rolloverOnPayment({ expiresAt: currentExpiry, now });
  const expected = new Date(
    new Date(currentExpiry).getTime() + 30 * MS_PER_DAY,
  ).toISOString();
  assert.equal(result, expected);
});

test("subscription: rollover from warning → current expiry + 30d (stacks)", () => {
  const currentExpiry = future(2); // 2 days left, in warning
  const result = rolloverOnPayment({ expiresAt: currentExpiry, now });
  const expected = new Date(
    new Date(currentExpiry).getTime() + 30 * MS_PER_DAY,
  ).toISOString();
  assert.equal(result, expected);
});

test("subscription: double-pay stacks to 60 days from first expiry", () => {
  const first = rolloverOnPayment({ expiresAt: null, now });
  const second = rolloverOnPayment({ expiresAt: first, now });
  const expected = new Date(now.getTime() + 60 * MS_PER_DAY).toISOString();
  assert.equal(second, expected);
});

// ─── eaPublishExpiry() ─────────────────────────────────────────────────────

test("subscription: EA publish expiry is Grid launch + 30 days", () => {
  // Grid launch: 2026-05-08, +30d = 2026-06-07
  const expected = new Date("2026-06-07T00:00:00Z").toISOString();
  assert.equal(eaPublishExpiry(), expected);
});

// ─── daysRemaining() ───────────────────────────────────────────────────────

test("subscription: daysRemaining for 10 days out", () => {
  assert.equal(daysRemaining({ expiresAt: future(10), now }), 10);
});

test("subscription: daysRemaining rounds DOWN (2.9 → 2)", () => {
  // 2.9 days from now
  const almostThree = new Date(now.getTime() + 2.9 * MS_PER_DAY).toISOString();
  assert.equal(daysRemaining({ expiresAt: almostThree, now }), 2);
});

test("subscription: daysRemaining negative when expired", () => {
  assert.ok(daysRemaining({ expiresAt: past(5), now }) < 0);
});

test("subscription: daysRemaining 0 for null", () => {
  assert.equal(daysRemaining({ expiresAt: null, now }), 0);
});
