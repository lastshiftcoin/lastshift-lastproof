/**
 * Tier computation — pure function, zero I/O.
 *
 * Tier system (locked):
 *   T5 — FREE / unlisted (default; never published or not paid)
 *   T1 — NEW         (paid + published, <  T2 proof threshold)
 *   T2 — VERIFIED    (meets verified threshold)
 *   T3 — EXPERIENCED (meets experienced threshold)
 *   T4 — LEGEND      (meets legend threshold)
 *
 * NOTE on thresholds: the numeric cutoffs below are PLACEHOLDERS pinned
 * here so the recalc pipeline wires cleanly. They will be tuned from
 * real Grid telemetry before launch. DO NOT hard-code these numbers in
 * callers — always go through `computeTier`.
 *
 * Inputs are deliberately flat so this function can be called from:
 *   - webhook handler (after a proof confirms)
 *   - cron (nightly global recalc)
 *   - publish route (first classification)
 *   - unit tests (no fixtures needed)
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export interface TierInputs {
  isPaid: boolean;
  isPublished: boolean;
  proofsConfirmed: number; // lifetime confirmed proofs owned by this profile
  disputesLost: number; // lifetime disputes resolved against the profile
  accountAgeDays: number; // days since profile.createdAt
}

/** Placeholder thresholds — tune with real data. */
export const TIER_THRESHOLDS = {
  verifiedProofs: 5,
  experiencedProofs: 25,
  legendProofs: 100,
  legendMinAgeDays: 90,
  maxDisputesLostForLegend: 0,
  maxDisputesLostForExperienced: 1,
} as const;

export function computeTier(input: TierInputs): Tier {
  if (!input.isPaid || !input.isPublished) return 5;

  const {
    proofsConfirmed,
    disputesLost,
    accountAgeDays,
  } = input;

  if (
    proofsConfirmed >= TIER_THRESHOLDS.legendProofs &&
    accountAgeDays >= TIER_THRESHOLDS.legendMinAgeDays &&
    disputesLost <= TIER_THRESHOLDS.maxDisputesLostForLegend
  ) {
    return 4;
  }
  if (
    proofsConfirmed >= TIER_THRESHOLDS.experiencedProofs &&
    disputesLost <= TIER_THRESHOLDS.maxDisputesLostForExperienced
  ) {
    return 3;
  }
  if (proofsConfirmed >= TIER_THRESHOLDS.verifiedProofs) {
    return 2;
  }
  return 1;
}

export const TIER_LABEL: Record<Tier, string> = {
  1: "NEW",
  2: "VERIFIED",
  3: "EXPERIENCED",
  4: "LEGEND",
  5: "FREE",
};
