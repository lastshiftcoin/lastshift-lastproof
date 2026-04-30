/**
 * Subscription state machine + rollover math.
 *
 * Pure functions. Zero I/O. Callers (webhook handler, cron, profile reads)
 * pass in `now` + current `expiresAt`, get back the derived state and, for
 * the payment path, the new `expiresAt`.
 *
 * State rules (locked — see plan + docs/TERMINAL-CONTRACT.md):
 *
 *   none     → expiresAt is null (never paid, never in EA)
 *   expired  → expiresAt <= now
 *   warning  → expiresAt is within 3 days of now
 *   active   → expiresAt more than 3 days in the future
 *
 * Rollover rules on payment:
 *
 *   none / expired       → newExpiresAt = now + 30d
 *   active / warning     → newExpiresAt = currentExpiresAt + 30d   (stacks)
 *
 * EA publish (first publish while firstFiveThousand === true):
 *
 *   newExpiresAt = null             (free forever — no expiry on EA)
 *   lastPaymentAt = null            (charge-free)
 *   isPaid = true                   (set explicitly; not derived from expiry)
 *
 * NOTE: As of 2026-04-30 the First-5,000 program is "free forever." EA
 * profiles never expire. This module's `deriveState` returns "none" for
 * `expiresAt = null`, so the cron at `/api/subscription/cron` MUST guard
 * EA rows (`isEarlyAdopter && !subscriptionExpiresAt`) before flipping
 * isPaid. Don't conflate Terminal's `subscriptionStatus` with LASTPROOF's
 * subscription window — LASTPROOF owns the paid-subscriber 30-day window;
 * Terminal owns EA eligibility (firstFiveThousand boolean).
 */

export type SubscriptionState = "none" | "active" | "warning" | "expired";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const WARNING_THRESHOLD_DAYS = 3;
export const SUBSCRIPTION_PERIOD_DAYS = 30;

export interface DeriveInput {
  /** ISO string or null. */
  expiresAt: string | null;
  /** Optional clock injection for tests. Defaults to Date.now(). */
  now?: Date;
}

export function deriveState({ expiresAt, now = new Date() }: DeriveInput): SubscriptionState {
  if (!expiresAt) return "none";
  const exp = new Date(expiresAt).getTime();
  const nowMs = now.getTime();
  if (exp <= nowMs) return "expired";
  if (exp - nowMs <= WARNING_THRESHOLD_DAYS * MS_PER_DAY) return "warning";
  return "active";
}

export function isPaidNow({ expiresAt, now = new Date() }: DeriveInput): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > now.getTime();
}

/**
 * Compute the new `expiresAt` after a confirmed subscription payment.
 * Stacks on top of any existing unexpired window; resets from `now` if
 * expired or never paid.
 */
export function rolloverOnPayment(input: DeriveInput): string {
  const state = deriveState(input);
  const now = input.now ?? new Date();
  const thirtyDaysMs = SUBSCRIPTION_PERIOD_DAYS * MS_PER_DAY;

  if (state === "none" || state === "expired") {
    return new Date(now.getTime() + thirtyDaysMs).toISOString();
  }
  // active or warning → stack from current expiry
  const current = new Date(input.expiresAt as string).getTime();
  return new Date(current + thirtyDaysMs).toISOString();
}

/**
 * Days remaining until expiry. Negative if expired, 0 if within one day.
 * Rounded DOWN — "2.9 days" reads as 2, matching UI countdown conventions.
 */
export function daysRemaining({ expiresAt, now = new Date() }: DeriveInput): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.floor(ms / MS_PER_DAY);
}
