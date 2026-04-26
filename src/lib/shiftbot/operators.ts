/**
 * Enriched operator fetcher for SHIFTBOT Mode B (deep content search).
 *
 * The Grid page itself reads from the slim `grid_operators` view (just enough
 * to render cards). When SHIFTBOT runs Mode B — "find me someone who's
 * worked on Ethereum" — it needs to search profile content beyond what's on
 * the card: pitch, about, work_items, etc.
 *
 * This helper does a fresh join against profiles + profile_categories +
 * work_items to give Groq the full searchable content per operator.
 *
 * Visibility predicate matches the grid_operators view exactly:
 *   is_paid AND published_at IS NOT NULL AND tier != 5
 */

import { supabaseService } from "@/lib/db/client";
import type { OperatorSearchInput } from "./prompt";

interface RawRow {
  handle: string;
  bio_statement: string | null;
  headline: string | null;
  pitch: string | null;
  about: string | null;
  profile_categories: Array<{ categories: { label: string } | null }> | null;
  work_items: Array<{
    ticker: string | null;
    role: string | null;
    description: string | null;
  }> | null;
}

/**
 * Fetch all Grid-eligible operators with their full searchable content.
 *
 * Returns the shape SHIFTBOT's prompt builder consumes. Empty array on DB
 * error — caller falls back to refuse:no_match if Groq can't rank against
 * an empty candidate set.
 */
export async function getOperatorsForSearch(): Promise<OperatorSearchInput[]> {
  const { data, error } = await supabaseService()
    .from("profiles")
    .select(
      `
      handle,
      bio_statement,
      headline,
      pitch,
      about,
      profile_categories ( categories ( label ) ),
      work_items ( ticker, role, description )
      `,
    )
    .eq("is_paid", true)
    .not("published_at", "is", null)
    .neq("tier", 5)
    .returns<RawRow[]>();

  if (error) {
    console.error("[shiftbot/operators] error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    handle: r.handle,
    // Mirrors ProfileHero's `bioStatement || headline` fallback so SHIFTBOT
    // sees the same identity line the public profile shows.
    shortBio: r.bio_statement ?? r.headline ?? "",
    pitch: r.pitch ?? "",
    about: r.about ?? "",
    categories: (r.profile_categories ?? [])
      .map((pc) => pc.categories?.label)
      .filter((l): l is string => Boolean(l)),
    workItems: (r.work_items ?? []).map((wi) => ({
      ticker: wi.ticker ?? "",
      role: wi.role ?? "",
      description: wi.description ?? "",
    })),
  }));
}
