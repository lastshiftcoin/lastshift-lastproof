/**
 * Pure-function filter engine for the /operators Grid.
 *
 * Stage 1 consumes the typed mock array; Stage 2 consumes the
 * `getGridList()` projector output. The filter logic is identical
 * either way — the only thing that changes is the input source.
 *
 * Zero I/O. Trivially testable.
 */

import type { GridCardView, GridFilters } from "./grid-view";

/**
 * Single-category filter. Returns true if the card has any category
 * matching the filter's category slug, OR the filter is "all" (no filter).
 */
function matchesCategory(card: GridCardView, category: string): boolean {
  if (category === "all" || !category) return true;
  return card.categories.some((c) => c.slug === category);
}

/**
 * Multi-tier filter. Empty list = no filter.
 */
function matchesTier(card: GridCardView, tiers: number[]): boolean {
  if (tiers.length === 0) return true;
  return tiers.includes(card.tier);
}

/**
 * Multi-fee filter. Empty list = no filter.
 */
function matchesFee(card: GridCardView, fees: string[]): boolean {
  if (fees.length === 0) return true;
  return fees.includes(card.feeRange);
}

/**
 * Multi-language filter. Empty list = no filter. Matches if the card's
 * language string includes any of the selected languages — handles the
 * "EN / DE" multi-language case correctly because we substring-match.
 *
 * The `language` field on GridCardView can be "EN", "EN / DE", "JP / EN",
 * etc. The filter passes a 2-char code like "EN" or "JP".
 */
function matchesLanguage(card: GridCardView, languages: string[]): boolean {
  if (languages.length === 0) return true;
  // Split the card's language string and intersect with filter set.
  const cardLangs = card.language.split(/\s*\/\s*/).map((s) => s.toUpperCase());
  return languages.some((lang) => cardLangs.includes(lang.toUpperCase()));
}

/**
 * Multi-timezone filter. Empty list = no filter.
 *
 * Card.timezone is a short form like "UTC-5" or "UTC+1". Filter values
 * match exactly.
 */
function matchesTimezone(card: GridCardView, timezones: string[]): boolean {
  if (timezones.length === 0) return true;
  return timezones.includes(card.timezone);
}

/**
 * Minimum-proofs filter. 0 = no filter.
 */
function matchesMinProofs(card: GridCardView, minProofs: number): boolean {
  if (minProofs <= 0) return true;
  return card.proofsConfirmed >= minProofs;
}

/**
 * DEV-proofs binary toggle (per Kellen override — not a slider).
 * True = only operators with at least 1 DEV proof.
 */
function matchesDevProofs(card: GridCardView, onlyDevProofs: boolean): boolean {
  if (!onlyDevProofs) return true;
  return card.devProofsConfirmed >= 1;
}

/**
 * Verified toggle. True = only operators with both X + Telegram verified.
 */
function matchesVerified(card: GridCardView, onlyVerified: boolean): boolean {
  if (!onlyVerified) return true;
  return card.isVerified;
}

/**
 * Apply all filters to the card array. Pure function.
 *
 * Order of predicates is irrelevant for correctness, but cheap rejections
 * (single-field comparisons) come first so we short-circuit quickly on
 * non-matching cards.
 */
export function applyFilters(
  cards: GridCardView[],
  filters: GridFilters,
): GridCardView[] {
  return cards.filter(
    (card) =>
      matchesCategory(card, filters.category) &&
      matchesTier(card, filters.tiers) &&
      matchesFee(card, filters.fees) &&
      matchesMinProofs(card, filters.minProofs) &&
      matchesDevProofs(card, filters.onlyDevProofs) &&
      matchesVerified(card, filters.onlyVerified) &&
      matchesLanguage(card, filters.languages) &&
      matchesTimezone(card, filters.timezones),
  );
}

/**
 * True if any filter is active (non-default). Used to show/hide the
 * "Clear all" link in the sidebar.
 */
export function hasActiveFilters(filters: GridFilters): boolean {
  return (
    filters.category !== "all" ||
    filters.tiers.length > 0 ||
    filters.fees.length > 0 ||
    filters.languages.length > 0 ||
    filters.timezones.length > 0 ||
    filters.minProofs > 0 ||
    filters.onlyDevProofs ||
    filters.onlyVerified
  );
}

/**
 * Active-filter chip descriptors for the chip row at the top of the feed.
 * Each entry maps to a removable chip with `× remove`.
 */
export interface ActiveFilterChip {
  /** Stable identifier for keying + remove handler dispatch. */
  id: string;
  /** Display label, e.g. "TIER 2 · VERIFIED" or "Fee: $$". */
  label: string;
  /** Bucket the chip belongs to — drives which slice of state to mutate on remove. */
  kind:
    | "category"
    | "tier"
    | "fee"
    | "language"
    | "timezone"
    | "minProofs"
    | "onlyDevProofs"
    | "onlyVerified";
  /** Bucket-specific value (tier number, fee string, etc.) — used by the remove handler. */
  value?: string | number;
}

const TIER_LABELS: Record<number, string> = {
  1: "TIER 1 · NEW",
  2: "TIER 2 · VERIFIED",
  3: "TIER 3 · EXPERIENCED",
  4: "TIER 4 · LEGEND",
};

/**
 * Compute the active-filter chips from the current filter state. Used to
 * render the chip row above the card list.
 */
export function activeFilterChips(filters: GridFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.category !== "all") {
    chips.push({ id: `cat:${filters.category}`, kind: "category", label: filters.category });
  }
  for (const tier of filters.tiers) {
    chips.push({
      id: `tier:${tier}`,
      kind: "tier",
      value: tier,
      label: TIER_LABELS[tier] ?? `TIER ${tier}`,
    });
  }
  for (const fee of filters.fees) {
    chips.push({ id: `fee:${fee}`, kind: "fee", value: fee, label: `Fee: ${fee}` });
  }
  for (const lang of filters.languages) {
    chips.push({ id: `lang:${lang}`, kind: "language", value: lang, label: lang });
  }
  for (const tz of filters.timezones) {
    chips.push({ id: `tz:${tz}`, kind: "timezone", value: tz, label: tz });
  }
  if (filters.minProofs > 0) {
    chips.push({ id: "minProofs", kind: "minProofs", value: filters.minProofs, label: `${filters.minProofs}+ proofs` });
  }
  if (filters.onlyDevProofs) {
    chips.push({ id: "onlyDevProofs", kind: "onlyDevProofs", label: "Has DEV proofs" });
  }
  if (filters.onlyVerified) {
    chips.push({ id: "onlyVerified", kind: "onlyVerified", label: "Verified ✓" });
  }
  return chips;
}
