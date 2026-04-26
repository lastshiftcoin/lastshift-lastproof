/**
 * Pure-function sort engine for the /operators Grid.
 *
 * The 4 locked sort options:
 *   - relevant : tier DESC → proofsConfirmed DESC → isVerified DESC (default)
 *   - trusted  : tier DESC → proofsConfirmed DESC          (no verified tiebreaker)
 *   - high     : feeRange DESC                              ($$$$ first)
 *   - low      : feeRange ASC                               ($ first)
 *
 * Zero I/O. Trivially testable.
 */

import type { GridCardView, GridSort, GridFee } from "./grid-view";

/**
 * Numeric weight for fee bands so we can compare them with > / <.
 * `$` = 1, `$$$$` = 4.
 */
const FEE_WEIGHT: Record<GridFee, number> = {
  $: 1,
  $$: 2,
  $$$: 3,
  $$$$: 4,
};

/**
 * Sort by relevance — the default ordering. Three-key cascade:
 *   1. tier DESC      (T4 first)
 *   2. proofs DESC    (most proofs win within tier)
 *   3. verified DESC  (verified breaks proof-count ties)
 */
function compareRelevant(a: GridCardView, b: GridCardView): number {
  if (a.tier !== b.tier) return b.tier - a.tier;
  if (a.proofsConfirmed !== b.proofsConfirmed) {
    return b.proofsConfirmed - a.proofsConfirmed;
  }
  if (a.isVerified !== b.isVerified) {
    return (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0);
  }
  return 0;
}

/**
 * Most Trusted — pure ladder sort (tier → proofs). No verified tiebreaker.
 * In practice this is nearly identical to `relevant` because tier is a
 * pure function of proof count; differs only on the verified third-tier.
 */
function compareTrusted(a: GridCardView, b: GridCardView): number {
  if (a.tier !== b.tier) return b.tier - a.tier;
  return b.proofsConfirmed - a.proofsConfirmed;
}

/**
 * High Fee — `$$$$` first, then `$$$`, then `$$`, then `$`.
 */
function compareHighFee(a: GridCardView, b: GridCardView): number {
  return FEE_WEIGHT[b.feeRange] - FEE_WEIGHT[a.feeRange];
}

/**
 * Low Fee — `$` first, ascending.
 */
function compareLowFee(a: GridCardView, b: GridCardView): number {
  return FEE_WEIGHT[a.feeRange] - FEE_WEIGHT[b.feeRange];
}

/**
 * Apply the chosen sort to a card array. Returns a new array; does not
 * mutate input.
 */
export function applySort(
  cards: GridCardView[],
  sort: GridSort,
): GridCardView[] {
  const out = [...cards];
  switch (sort) {
    case "relevant":
      return out.sort(compareRelevant);
    case "trusted":
      return out.sort(compareTrusted);
    case "high":
      return out.sort(compareHighFee);
    case "low":
      return out.sort(compareLowFee);
    default:
      return out;
  }
}

export const SORT_LABELS: Record<GridSort, string> = {
  relevant: "Relevant",
  trusted: "Most Trusted",
  high: "$$$$ ↓",
  low: "$ ↑",
};
