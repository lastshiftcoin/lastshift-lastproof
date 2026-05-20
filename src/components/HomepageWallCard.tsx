"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent } from "react";
import GridCard from "@/components/grid/GridCard";
import type { GridCardView } from "@/lib/grid/grid-view";

/**
 * HomepageWallCard — renders the canonical `<GridCard />` but intercepts
 * every click so the homepage wall always sends visitors to /grid
 * instead of opening the individual profile. Per the operator's call: homepage
 * cards are a teaser surface, not a navigation surface.
 *
 * Implementation notes:
 *   - `onClickCapture` (not `onClick`) is essential because GridCard's
 *     inner anchor uses `target="_blank"`. Browsers handle target=_blank
 *     navigation SYNCHRONOUSLY on click — bubble-phase preventDefault
 *     fires too late and the new tab still opens. Capture-phase fires
 *     BEFORE the click reaches the anchor target, so preventDefault is
 *     honored.
 *   - We also handle `onAuxClickCapture` (middle-click) for the same
 *     reason: middle-click on target=_blank anchors opens a new tab
 *     instantly. Capture-phase intercept stops it.
 *   - Right-click "Open link in new tab" from the browser context menu
 *     STILL works (no JS hook for it). That's an OS/browser action,
 *     not a click event. If you need that closed too, GridCard itself
 *     needs a `linkBehavior` / `hrefOverride` prop — GRID builder
 *     territory.
 */
export default function HomepageWallCard({ card }: { card: GridCardView }) {
  const router = useRouter();

  function intercept(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Modifier-click on the new-tab anchor should still go to /grid per
    // spec — if the operator wants cmd-click to open /grid in a new tab,
    // swap router.push for window.open("/grid", "_blank").
    router.push("/grid");
  }

  return (
    <div
      className="hp-wall-card-wrap"
      onClickCapture={intercept}
      onAuxClickCapture={intercept}
    >
      <GridCard card={card} />
    </div>
  );
}
