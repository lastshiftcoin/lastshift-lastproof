/**
 * Grid adapter — reads from the `grid_operators` Supabase view.
 *
 * Single query returns everything needed for the /operators feed: each row
 * is a Grid-eligible operator with all `GridCardView` fields pre-aggregated
 * (proof counts, project count, categories array). No per-card fan-out.
 *
 * View definition lives in supabase/migrations/0022_grid_view.sql.
 *
 * Visibility predicate is enforced inside the view itself
 * (`is_paid AND published_at IS NOT NULL AND tier != 5`) — callers don't
 * need to re-filter.
 */

import { supabaseService } from "../db/client";
import type { GridCardView, GridTier, GridFee, GridCategory } from "./grid-view";

const VIEW = "grid_operators";

interface GridOperatorRow {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: number | null;
  is_verified: boolean | null;
  is_early_adopter: boolean | null;
  timezone: string | null;
  location: string | null;
  language: string | null;
  secondary_language: string | null;
  fee_range: string | null;
  short_bio: string | null;
  published_at: string;
  proofs_confirmed: number;
  dev_proofs_confirmed: number;
  projects_count: number;
  categories: GridCategory[] | null; // jsonb in DB → array in JS
}

/**
 * Fetch every Grid-eligible operator. Returns a `GridCardView[]` ready to
 * render. Sorted by relevance (tier DESC → proofs DESC → verified DESC) at
 * the SQL level so the SSR first paint is meaningful even before client-
 * side sort kicks in.
 *
 * Empty array on DB error is intentional — page renders empty state rather
 * than throwing. Errors are logged for ops debugging.
 */
export async function getGridList(): Promise<GridCardView[]> {
  const { data, error } = await supabaseService()
    .from(VIEW)
    .select("*")
    .order("tier", { ascending: false })
    .order("proofs_confirmed", { ascending: false })
    .order("is_verified", { ascending: false })
    .returns<GridOperatorRow[]>();

  if (error) {
    console.error("[grid-adapter] getGridList error:", error.message);
    return [];
  }

  return (data ?? []).map(transformRow);
}

/**
 * Sample N Grid-eligible operators for the homepage wall. Stratified by
 * proof count so the wall always shows at least `minWithProofs` cards
 * with confirmed proofs (avoids a homepage full of tier-1 / no-proof
 * profiles, which would undersell the platform).
 *
 * Algorithm (per GRID builder's recommendation):
 *   1. Fetch full Grid list (cached at view level)
 *   2. Split into bucketA (proofs > 0) and bucketB (no proofs)
 *   3. Shuffle each bucket independently
 *   4. Take min(minWithProofs, bucketA.length) from bucketA
 *   5. Top up to N from bucketA-remainder + bucketB
 *   6. Shuffle the final N so proof-rich cards aren't always first
 *
 * Homepage callsite wraps this in ISR (`revalidate = 60`) so it executes
 * at most once per minute, with random selection per render giving
 * per-visit variation within the minute. Empty array on DB error is
 * intentional — homepage renders an empty wall rather than throwing.
 */
export async function getHomepageWallSample(
  n: number,
  minWithProofs: number,
): Promise<GridCardView[]> {
  const all = await getGridList();
  if (all.length === 0) return [];

  const withProofs = all.filter((c) => c.proofsConfirmed > 0);
  const withoutProofs = all.filter((c) => c.proofsConfirmed === 0);

  shuffleInPlace(withProofs);
  shuffleInPlace(withoutProofs);

  // Floor first — take up to minWithProofs from the proof-rich pool.
  const floor = Math.min(minWithProofs, withProofs.length);
  const picked = withProofs.slice(0, floor);

  // Top up to N from the remainder of bucketA, then bucketB.
  const remainder = withProofs.slice(floor).concat(withoutProofs);
  for (let i = 0; picked.length < n && i < remainder.length; i++) {
    picked.push(remainder[i]!);
  }

  // Final shuffle so the floor-cards aren't always first.
  shuffleInPlace(picked);
  return picked;
}

/** Fisher-Yates shuffle, in-place. Math.random is fine here — this is a
 * cosmetic homepage rotation, not a security or fairness boundary. */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a `grid_operators` row into a `GridCardView`. Format-mapping
 * lives here (not in SQL) so the view stays simple and the formatting
 * concern is testable from TypeScript.
 */
function transformRow(r: GridOperatorRow): GridCardView {
  const displayName = r.display_name ?? r.handle;
  const tier = clampTier(r.tier);

  return {
    handle: r.handle,
    displayName,
    avatarUrl: r.avatar_url,
    avatarMonogram: monogramFor(displayName),
    tier,
    isVerified: Boolean(r.is_verified),
    isEarlyAdopter: Boolean(r.is_early_adopter),
    proofsConfirmed: r.proofs_confirmed,
    devProofsConfirmed: r.dev_proofs_confirmed,
    projectsCount: r.projects_count,
    timezone: shortTimezone(r.timezone),
    language: formatLanguage(r.language, r.secondary_language),
    feeRange: clampFee(r.fee_range),
    categories: r.categories ?? [],
    shortBio: r.short_bio ?? "",
    publishedAt: r.published_at,
  };
}

/**
 * `profiles.tier` can technically be null in the row even though the view
 * filters out tier=5. Coerce defensively to 1 if null/out-of-range.
 */
function clampTier(t: number | null): GridTier {
  if (t === 4) return 4;
  if (t === 3) return 3;
  if (t === 2) return 2;
  return 1;
}

function clampFee(fee: string | null): GridFee {
  if (fee === "$$$$") return "$$$$";
  if (fee === "$$$") return "$$$";
  if (fee === "$$") return "$$";
  if (fee === "$") return "$";
  return "$$"; // fallback for null/missing
}

/**
 * Compute the avatar monogram. 2-char preferred — first letter of each of
 * the first two words of `displayName`. Fallback: first 2 chars uppercased.
 */
function monogramFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return "??";
}

/**
 * Combine primary + secondary language into the inline display form:
 *   "English"            (single language)
 *   "English / Spanish"  (primary + secondary)
 *
 * Languages are stored AND displayed as full English names — no code
 * translation. If both fields are null, returns "—" so the card meta
 * row never collapses to an empty span.
 */
function formatLanguage(primary: string | null, secondary: string | null): string {
  if (!primary && !secondary) return "—";
  // Dedupe: if secondary equals primary, show only one.
  const out: string[] = [];
  if (primary) out.push(primary);
  if (secondary && secondary !== primary) out.push(secondary);
  return out.join(" / ");
}

/**
 * Shorten a stored timezone like `"UTC-5 · NEW YORK (EST)"` to `"UTC-5"` for
 * the inline card meta row. If the stored value is already short or doesn't
 * follow the `· city` pattern, return it as-is (capped at 8 chars).
 */
function shortTimezone(raw: string | null): string {
  if (!raw) return "—";
  const split = raw.split("·");
  const head = split[0].trim();
  return head.length <= 8 ? head : head.slice(0, 8);
}
