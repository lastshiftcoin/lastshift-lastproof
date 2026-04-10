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
 *   newExpiresAt = freeSubUntil    (from Terminal validate)
 *   lastPaymentAt = null            (charge-free window)
 *   isPaid = true                   (if freeSubUntil is still in the future)
 *
 * NOTE: LASTPROOF's 30-day timer is NOT the same as Terminal's
 * `subscriptionStatus`. Terminal owns EA / `free_ea` / `active`. LASTPROOF
 * owns the 30-day window and Grid visibility. Do not conflate them.
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
 * EA publish: subscription window ends 30 days after Grid launch.
 *
 * LASTPROOF owns this date — Terminal only tells us whether the user
 * qualifies (firstFiveThousand boolean). The campaign window is a
 * LASTPROOF business rule, not a Terminal concern.
 */
export function eaPublishExpiry(): string {
  // Grid launch: 2026-05-08. EA window: +30 days = 2026-06-07.
  // Hardcoded here to keep this module zero-import. If GRID_LAUNCH_DATE
  // or EA_FREE_WINDOW_DAYS change, update src/lib/constants.ts AND here.
  const GRID_LAUNCH = new Date("2026-05-08T00:00:00Z");
  const EA_WINDOW_DAYS = 30;
  const expiryMs = GRID_LAUNCH.getTime() + EA_WINDOW_DAYS * MS_PER_DAY;
  return new Date(expiryMs).toISOString();
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
