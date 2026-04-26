import { Suspense } from "react";
import type { Metadata } from "next";
import OperatorsClient from "./OperatorsClient";
import {
  GRID_MOCK,
  TICKER_MOCK,
  CATEGORY_CHIPS_MOCK,
} from "@/lib/mock/grid-mock";
import "./operators.css";

/**
 * /operators — the LASTPROOF Grid.
 *
 * Stage 1 of Phase 2: visual scaffold rendering from typed mock data.
 * No backend wiring, no real proofs/operators. The page is `noindex`
 * during iteration so search engines don't index the half-built state.
 *
 * Inherits Topbar / Footer / ShiftbotStrip from (marketing)/layout.tsx.
 *
 * The route is gated by /grid in production via src/proxy.ts (Stage 3).
 * Stage 1 ships ungated so Kellen can iterate at lastproof.app/operators
 * directly without setting the entry cookie.
 */

export const metadata: Metadata = {
  title: "Operators · LASTPROOF",
  description:
    "Discover verified web3 operators on LASTPROOF — filtered by tier, fee, language, and timezone.",
  // Stage 1: noindex during iteration. Removed in Stage 4 (launch).
  robots: { index: false, follow: false },
};

export default function OperatorsPage() {
  return (
    <Suspense fallback={null}>
      <OperatorsClient
        cards={GRID_MOCK}
        ticker={TICKER_MOCK}
        categoryChips={CATEGORY_CHIPS_MOCK}
      />
    </Suspense>
  );
}
