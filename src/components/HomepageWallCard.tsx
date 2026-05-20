"use client";

import Link from "next/link";
import GridCard from "@/components/grid/GridCard";
import type { GridCardView } from "@/lib/grid/grid-view";

/**
 * HomepageWallCard — renders the canonical `<GridCard />` but routes
 * EVERY interaction (left-click, middle-click, right-click "Open in new
 * tab", drag-link, copy-link, etc.) to `/grid` instead of the profile.
 *
 * Strategy: overlay a clickable `<Link href="/grid">` over the entire
 * card and disable the inner GridCard anchor via `pointer-events: none`.
 * The browser no longer recognizes the inner `<a href="/@handle">` as
 * interactive — no context menu, no hover preview, no copy-link. The
 * overlay is the only interactive element, and its href is /grid.
 *
 * Hover styles for `.g-card` would normally not fire because the mouse
 * hovers the overlay layer, not the inner anchor. We mirror the hover
 * effects via a `.hp-wall-card-wrap:hover .g-card` rule in dashboard
 * CSS so the visual feedback is preserved.
 *
 * Equal heights: the wrap is `display: flex` column with the inner card
 * `flex: 1` so the anchor stretches to whatever min-height
 * `HomepageWall` measures and sets on the wrapper.
 */
export default function HomepageWallCard({ card }: { card: GridCardView }) {
  return (
    <div className="hp-wall-card-wrap">
      <GridCard card={card} />
      <Link
        href="/grid"
        className="hp-wall-card-overlay"
        aria-label="Open the operator Grid"
      />
    </div>
  );
}
