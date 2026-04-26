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
  pitch: string | null;
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
    proofsConfirmed: r.proofs_confirmed,
    devProofsConfirmed: r.dev_proofs_confirmed,
    projectsCount: r.projects_count,
    timezone: shortTimezone(r.timezone),
    language: formatLanguage(r.language, r.secondary_language),
    feeRange: clampFee(r.fee_range),
    categories: r.categories ?? [],
    pitch: r.pitch ?? "",
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
 *   "EN"          (single language)
 *   "EN / DE"     (primary + secondary)
 *
 * The DB stores either full names ("English") or 2-char codes. We normalize
 * to 2-char codes for the card meta row.
 */
function formatLanguage(primary: string | null, secondary: string | null): string {
  const p = languageCode(primary);
  const s = secondary ? languageCode(secondary) : null;
  if (s && s !== p) return `${p} / ${s}`;
  return p;
}

const LANGUAGE_CODES: Record<string, string> = {
  ENGLISH: "EN",
  SPANISH: "ES",
  PORTUGUESE: "PT",
  GERMAN: "DE",
  FRENCH: "FR",
  ITALIAN: "IT",
  RUSSIAN: "RU",
  TURKISH: "TR",
  ARABIC: "AR",
  CHINESE: "CN",
  JAPANESE: "JP",
  KOREAN: "KR",
  HINDI: "HI",
  VIETNAMESE: "VI",
  THAI: "TH",
  INDONESIAN: "ID",
  TAGALOG: "TL",
};

function languageCode(raw: string | null): string {
  if (!raw) return "EN";
  const upper = raw.trim().toUpperCase();
  if (upper.length <= 3) return upper; // already a code
  return LANGUAGE_CODES[upper] ?? upper.slice(0, 2);
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
