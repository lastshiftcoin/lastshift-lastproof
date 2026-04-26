/**
 * GridCardView — slim per-card projection for the /operators Grid page.
 *
 * This is the type the Grid feed consumes. Counts (proofsConfirmed,
 * devProofsConfirmed, projectsCount) are NOT columns on `profiles` — they
 * come from joins/aggregates against `proofs` + `work_items`. See
 * docs/GRID-PHASE-2-ARCHITECTURE.md § 3 for the SQL strategy.
 *
 * Stage 1 (this commit) populates these from a typed mock.
 * Stage 2 will swap the mock for a real `getGridList()` projector that
 * reads from a `grid_operators` Supabase view.
 */

export type GridTier = 1 | 2 | 3 | 4;
export type GridFee = "$" | "$$" | "$$$" | "$$$$";

export interface GridCategory {
  slug: string;
  label: string;
}

export interface GridCardView {
  // Identity
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** First letter of displayName, uppercase. Used for avatar fallback. */
  avatarMonogram: string;

  // Trust signals
  tier: GridTier;
  /** True only if BOTH x_verified AND telegram_verified. */
  isVerified: boolean;

  // Counts (derived from joins/aggregates in Stage 2)
  proofsConfirmed: number;
  devProofsConfirmed: number;
  projectsCount: number;

  // Meta
  /** "UTC-5" or similar short form for inline meta row. */
  timezone: string;
  /** "EN" or "EN / DE" or similar. Primary + optional secondary, slash-joined. */
  language: string;
  feeRange: GridFee;

  // Categories — first entry is the primary (orange-filled chip)
  categories: GridCategory[];

  /**
   * Short bio — the one-liner identity statement that goes on the card.
   * NOT the long-form Pitch tab body (that lives on the profile page).
   * Sourced from `bio_statement` with `headline` as a legacy fallback —
   * matches the profile hero's `bioStatement || headline` rendering
   * (src/components/profile/ProfileHero.tsx).
   */
  shortBio: string;

  /** ISO timestamp. Used by sort logic (eventually) and ranking. */
  publishedAt: string;
}

/**
 * Sort options surfaced on the /operators page. Locked to 4.
 *
 * - `relevant`: tier DESC → proofsConfirmed DESC → isVerified DESC (default)
 * - `trusted`: tier DESC → proofsConfirmed DESC (no verified tiebreaker)
 * - `high`: feeRange DESC ($$$$ first)
 * - `low`: feeRange ASC ($ first)
 */
export type GridSort = "relevant" | "trusted" | "high" | "low";

/**
 * Filter state for the sidebar / mobile drawer. Lives in URL params and
 * client state. Pure functions in `filter.ts` consume this shape to
 * produce the filtered card array.
 */
export interface GridFilters {
  /** Single-select category. "all" or one of the 15 category slugs. */
  category: string;

  // Multi-select
  tiers: GridTier[];
  fees: GridFee[];
  /** Languages. Matches against primary + secondary language strings. */
  languages: string[];
  /** UTC offsets. e.g. ["UTC-5", "UTC+1"]. */
  timezones: string[];

  /** Minimum proof count threshold. 0 = no filter. Snap values: 0/10/25/50/100. */
  minProofs: number;
  /** True = only show operators with ≥1 DEV proof. */
  onlyDevProofs: boolean;
  /** True = only show operators with both X + Telegram verified. */
  onlyVerified: boolean;
}

/**
 * Empty default filter state. Used at page load and "Clear all".
 */
export const EMPTY_FILTERS: GridFilters = {
  category: "all",
  tiers: [],
  fees: [],
  languages: [],
  timezones: [],
  minProofs: 0,
  onlyDevProofs: false,
  onlyVerified: false,
};
