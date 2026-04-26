/**
 * Category chip data for the /operators chip row.
 *
 * Reads the cached `operator_count` column from `categories` (populated by
 * the daily refresh_categories_operator_count() cron). Returns chips
 * sorted by usage descending — most-used categories first.
 *
 * Cron lives at /api/grid/categories-cron and runs daily at 00:10 UTC
 * per vercel.json. If the cron hasn't run yet (fresh DB), counts will all
 * be 0 and chip order falls back to the categories.position seed order.
 */

import { supabaseService } from "../db/client";

export interface CategoryChip {
  slug: string;
  label: string;
  count: number;
}

interface RawRow {
  slug: string;
  label: string;
  operator_count: number | null;
  position: number | null;
}

/**
 * Fetch all 15 categories sorted by `operator_count DESC` (then by `position`
 * for ties / zero-count rows so the seed order survives when counts are flat).
 */
export async function getCategoryChips(): Promise<CategoryChip[]> {
  const { data, error } = await supabaseService()
    .from("categories")
    .select("slug, label, operator_count, position")
    .order("operator_count", { ascending: false })
    .order("position", { ascending: true })
    .returns<RawRow[]>();

  if (error) {
    console.error("[category-chips] error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    slug: r.slug,
    label: r.label,
    count: r.operator_count ?? 0,
  }));
}
