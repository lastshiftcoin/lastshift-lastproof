/**
 * Ambassador payout tier calculation.
 *
 * Rolling 7-day referral counts determine weekly payout:
 *   0–10  → $0
 *   11–25 → $5
 *   26–50 → $10
 *   51+   → $15
 *   100+  → $15 + $20 bonus = $35
 */

export interface PayoutTier {
  label: string;
  payoutUsd: number;
}

export function computePayoutTier(count: number): PayoutTier {
  if (count >= 100) return { label: "100+", payoutUsd: 35 };
  if (count >= 51) return { label: "51+", payoutUsd: 15 };
  if (count >= 26) return { label: "26–50", payoutUsd: 10 };
  if (count >= 11) return { label: "11–25", payoutUsd: 5 };
  return { label: "0–10", payoutUsd: 0 };
}
