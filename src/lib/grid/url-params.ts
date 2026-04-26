/**
 * URL param serialization / deserialization for the /operators Grid.
 *
 * The URL is the source of truth. Client state mirrors the URL so links
 * are shareable + back-button works + page refresh preserves filter state.
 *
 * Param shape:
 *   /operators
 *   /operators?category=shiller
 *   /operators?category=shiller&tier=3,4&fee=2,3
 *   /operators?minProofs=10&onlyVerified=1&sort=trusted
 *   /operators?lang=EN,ES&tz=UTC-5,UTC+1
 *
 * Empty / default values are omitted from the URL. Multi-value params use
 * comma-delimited lists. Booleans are `1` / absent.
 */

import type { GridFilters, GridSort, GridTier, GridFee } from "./grid-view";
import { EMPTY_FILTERS } from "./grid-view";

const VALID_TIERS: GridTier[] = [1, 2, 3, 4];
const VALID_FEES: GridFee[] = ["$", "$$", "$$$", "$$$$"];
const VALID_SORTS: GridSort[] = ["relevant", "trusted", "high", "low"];

/**
 * Fee values are URL-unfriendly (`$` would be `%24`). We map them to
 * 1/2/3/4 in the URL and back to symbols on read.
 */
function feeToUrl(fee: GridFee): string {
  return String(VALID_FEES.indexOf(fee) + 1);
}
function feeFromUrl(s: string): GridFee | null {
  const idx = parseInt(s, 10) - 1;
  return VALID_FEES[idx] ?? null;
}

/**
 * Parse URL search params into structured filter + sort state.
 * Invalid values are dropped silently — the page falls back to defaults
 * for unrecognized params rather than rendering an empty list.
 */
export function parseGridParams(params: URLSearchParams): {
  filters: GridFilters;
  sort: GridSort;
  query: string | null;
  ranked: string[];
  fallback: boolean;
} {
  // Category — single value.
  const category = params.get("category") ?? "all";

  // Tier — comma-delimited list of 1/2/3/4.
  const tiers: GridTier[] = (params.get("tier") ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => parseInt(s, 10) as GridTier)
    .filter((t): t is GridTier => VALID_TIERS.includes(t));

  // Fee — comma-delimited list of 1/2/3/4 mapped to $/$$/$$$/$$$$.
  const fees: GridFee[] = (params.get("fee") ?? "")
    .split(",")
    .filter(Boolean)
    .map(feeFromUrl)
    .filter((f): f is GridFee => f !== null);

  // Languages — comma-delimited 2-char codes.
  const languages: string[] = (params.get("lang") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  // Timezones — comma-delimited UTC offsets.
  const timezones: string[] = (params.get("tz") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Minimum proofs.
  const minProofsRaw = parseInt(params.get("minProofs") ?? "0", 10);
  const minProofs = Number.isFinite(minProofsRaw) && minProofsRaw > 0 ? minProofsRaw : 0;

  // Booleans.
  const onlyDevProofs = params.get("onlyDevProofs") === "1";
  const onlyVerified = params.get("onlyVerified") === "1";

  // Sort.
  const sortRaw = params.get("sort") ?? "relevant";
  const sort: GridSort = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as GridSort)
    : "relevant";

  // SHIFTBOT-driven query — populated when ShiftbotStrip routed the user here.
  const query = params.get("q");

  // SHIFTBOT Mode B — comma-delimited handles in display order.
  // Validated downstream against the actual card list (no hallucinated handles
  // can leak in via URL manipulation).
  const rankedRaw = params.get("ranked") ?? "";
  const ranked = rankedRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // SHIFTBOT fallback flag — set when Groq couldn't rank usefully and we
  // showed all operators with a "couldn't find specific matches" notice.
  const fallback = params.get("fallback") === "1";

  const filters: GridFilters = {
    category,
    tiers,
    fees,
    languages,
    timezones,
    minProofs,
    onlyDevProofs,
    onlyVerified,
  };

  return { filters, sort, query, ranked, fallback };
}

/**
 * Build a URLSearchParams from filter + sort state. Empty / default
 * values are omitted so the URL stays short on default views.
 */
export function buildGridParams(
  filters: GridFilters,
  sort: GridSort,
): URLSearchParams {
  const out = new URLSearchParams();

  if (filters.category !== "all" && filters.category) {
    out.set("category", filters.category);
  }
  if (filters.tiers.length > 0) {
    out.set("tier", filters.tiers.slice().sort().join(","));
  }
  if (filters.fees.length > 0) {
    out.set("fee", filters.fees.map(feeToUrl).join(","));
  }
  if (filters.languages.length > 0) {
    out.set("lang", filters.languages.join(","));
  }
  if (filters.timezones.length > 0) {
    out.set("tz", filters.timezones.join(","));
  }
  if (filters.minProofs > 0) {
    out.set("minProofs", String(filters.minProofs));
  }
  if (filters.onlyDevProofs) out.set("onlyDevProofs", "1");
  if (filters.onlyVerified) out.set("onlyVerified", "1");
  if (sort !== "relevant") out.set("sort", sort);

  return out;
}

/**
 * Initial-state factory — defaults all filters off, sort = relevant.
 */
export function defaultGridState(): {
  filters: GridFilters;
  sort: GridSort;
  query: string | null;
  ranked: string[];
  fallback: boolean;
} {
  return {
    filters: { ...EMPTY_FILTERS },
    sort: "relevant",
    query: null,
    ranked: [],
    fallback: false,
  };
}
