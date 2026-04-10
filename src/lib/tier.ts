/**
 * Tier computation — pure function, zero I/O.
 *
 * Tier system (LOCKED to wireframes — see CLAUDE.md):
 *
 *   TIER 1 · NEW         — paid + published, 0+ proofs
 *   TIER 2 · VERIFIED    — 10+ proofs
 *   TIER 3 · EXPERIENCED — 25+ proofs
 *   TIER 4 · LEGEND      — 50+ proofs
 *
 * Pure proof count, no age gates, no dispute gates. Thresholds match
 * `lastproof-profile-public.html` trust-tier bar tick labels:
 *   0+ NEW · 10+ VERIFIED · 25+ EXPERIENCED · 50+ LEGEND
 *
 * The internal sentinel `5` is returned for unpaid/unpublished profiles
 * to mark "not on the tier ladder at all." It is NEVER rendered as a
 * word — the free-variant wireframe branches on it upstream and strips
 * the tier UI entirely. Treat `5` as a null-ish "unlisted" value.
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
  /** Lifetime confirmed proofs owned by this profile. */
  proofsConfirmed: number;
  /**
   * Reserved for future use — currently ignored. Wireframe-canonical
   * tier math has no dispute gate. Kept on the interface so we don't
   * have to thread a new signature when/if it comes back.
   */
  disputesLost?: number;
  /** Reserved for future use — currently ignored. */
  accountAgeDays?: number;
}

/** Wireframe-canonical thresholds. Locked. */
export const TIER_THRESHOLDS = {
  verifiedProofs: 10,
  experiencedProofs: 25,
  legendProofs: 50,
} as const;

export function computeTier(input: TierInputs): Tier {
  // Not on the ladder at all — free-variant renders for these.
  if (!input.isPaid || !input.isPublished) return 5;

  const { proofsConfirmed } = input;

  if (proofsConfirmed >= TIER_THRESHOLDS.legendProofs) return 4;
  if (proofsConfirmed >= TIER_THRESHOLDS.experiencedProofs) return 3;
  if (proofsConfirmed >= TIER_THRESHOLDS.verifiedProofs) return 2;
  return 1;
}

export const TIER_LABEL: Record<Tier, string> = {
  1: "NEW",
  2: "VERIFIED",
  3: "EXPERIENCED",
  4: "LEGEND",
  5: "UNLISTED", // internal only — never shown in UI
};

/**
 * Canonical "TIER N · NAME" render helper. Use this everywhere a tier
 * label appears in the UI so we can't drift from the pairing rule.
 * Returns null for tier 5 (unlisted) so callers can branch cleanly.
 */
export function formatTierLabel(tier: Tier): string | null {
  if (tier === 5) return null;
  return `TIER ${tier} · ${TIER_LABEL[tier]}`;
}

/**
 * Canonical profile variant resolver — the single source of truth for which
 * layout a profile renders (free / public / legend).
 *
 * Rules (locked):
 *   1. tier === 5 (unpaid OR unpublished)   → "free"
 *      → Data is preserved across lapses. When the user re-subscribes and
 *        proofsConfirmed is unchanged, computeTier() lifts them straight
 *        back to their previous tier (1–4) and the variant flips back to
 *        "public" or "legend" automatically.
 *   2. isEarlyAdopter (first 5,000 operators) → "legend"
 *      → Keeps the 5K founder badge on the avatar and swaps the footer
 *        CTA for the purple/orange FOMO strip.
 *   3. otherwise                            → "public"
 *
 * Call this everywhere the rendered variant is chosen — the projector,
 * the /@handle route, any future API response, any test. Never reimplement
 * this ladder inline. If the rule changes, it changes here and propagates.
 */
export type ProfileVariantKind = "public" | "legend" | "free";

export interface DeriveVariantInput {
  tier: Tier;
  isEarlyAdopter: boolean;
}

export function deriveProfileVariant(
  input: DeriveVariantInput,
): ProfileVariantKind {
  if (input.tier === 5) return "free";
  if (input.isEarlyAdopter) return "legend";
  return "public";
}
