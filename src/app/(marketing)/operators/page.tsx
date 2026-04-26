import { Suspense } from "react";
import type { Metadata } from "next";
import OperatorsClient from "./OperatorsClient";
import { getGridList } from "@/lib/grid/grid-adapter";
import { getRecentProofs } from "@/lib/grid/recent-proofs";
import { getCategoryChips } from "@/lib/grid/category-chips";
import "./operators.css";

/**
 * /operators — the LASTPROOF Grid.
 *
 * Stage 2 of Phase 2: real backend data.
 *   - getGridList() reads from the `grid_operators` Supabase view
 *     (migration 0022). Single query, all aggregations baked in.
 *   - getRecentProofs(20) fetches the last 20 confirmed proofs for
 *     the LIVE ticker. Static-per-pageload — no polling.
 *   - getCategoryChips() reads `categories.operator_count` for the
 *     usage-sorted chip row (migration 0023, refreshed daily by
 *     /api/grid/categories-cron).
 *
 * Inherits Topbar / Footer / ShiftbotStrip from (marketing)/layout.tsx.
 *
 * Page is currently `noindex` during the iteration phase — flipped at
 * Stage 4 launch alongside the boot screen gate at /grid.
 */

export const metadata: Metadata = {
  title: "Operators · LASTPROOF",
  description:
    "Discover verified web3 operators on LASTPROOF — filtered by tier, fee, language, and timezone.",
  // Stage 2: still noindex during iteration. Removed at Stage 4 launch.
  robots: { index: false, follow: false },
};

// Don't statically generate — Grid data is dynamic enough that we want a
// fresh read on each request (cached at edge for 60s).
export const dynamic = "force-dynamic";

export default async function OperatorsPage() {
  const [cards, ticker, categoryChips] = await Promise.all([
    getGridList(),
    getRecentProofs(20),
    getCategoryChips(),
  ]);

  return (
    <Suspense fallback={null}>
      <OperatorsClient
        cards={cards}
        ticker={ticker}
        categoryChips={categoryChips}
      />
    </Suspense>
  );
}
