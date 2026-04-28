/**
 * Ambassador payout calculation — flat-rate model.
 *
 * Replaced the rolling-7-day tier model on 2026-04-26. New model:
 * $0.50 per confirmed referral, paid weekly (every Monday). No tiers,
 * no thresholds. Each referral is tracked as paid/unpaid via
 * `profiles.ambassador_paid_at` so ambassadors see live status per
 * referral on their report.
 *
 * Migration that introduced the per-referral status:
 *   supabase/migrations/0023_ambassador_per_referral_payout.sql
 */

export const RATE_PER_REFERRAL_USD = 0.5;

/**
 * Compute amount owed for a given count of unpaid referrals.
 * Returns USD with 2-decimal precision.
 */
export function computeAmountOwed(unpaidCount: number): number {
  return Math.round(unpaidCount * RATE_PER_REFERRAL_USD * 100) / 100;
}

/**
 * Format an amount as a USD currency string with $ and 2 decimals.
 * `formatUsd(0)` → "$0.00"; `formatUsd(12.5)` → "$12.50".
 */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Render a tx_signature value as a Solscan URL. Accepts either a bare
 * signature or a full Solscan URL (in which case it's returned as-is).
 * Per Kellen's spec, no validation — just pass-through with a sane
 * default scheme.
 */
export function formatSolscanLink(txSignature: string | null): string | null {
  if (!txSignature) return null;
  const t = txSignature.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://solscan.io/tx/${t}`;
}

// ─── Legacy tier compatibility shim ────────────────────────────────────
//
// The old `computePayoutTier(count)` API was used by the report page
// before this rewrite. Keeping a no-op stub so any leftover imports
// don't break the build during the migration. Will be removed once all
// call sites are migrated.

export interface PayoutTier {
  label: string;
  payoutUsd: number;
}

/** @deprecated — use computeAmountOwed(). Kept temporarily for build safety. */
export function computePayoutTier(count: number): PayoutTier {
  return {
    label: count === 1 ? "1 referral" : `${count} referrals`,
    payoutUsd: computeAmountOwed(count),
  };
}
