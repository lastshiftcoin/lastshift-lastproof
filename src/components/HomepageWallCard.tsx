"use client";

import { useRouter } from "next/navigation";
import GridCard from "@/components/grid/GridCard";
import type { GridCardView } from "@/lib/grid/grid-view";

/**
 * HomepageWallCard — renders the canonical `<GridCard />` but intercepts
 * the click so the homepage wall always sends visitors to /grid instead
 * of opening the individual profile. Per the operator's call: homepage cards
 * are a teaser surface, not a navigation surface to specific operators.
 *
 * Implementation: bubble-phase click handler on the wrapper calls
 * `event.preventDefault()` before the inner anchor's native navigation
 * fires, then routes to /grid. Hover effects on `.g-card:hover` still
 * work because we don't disable pointer-events.
 *
 * Edge case: cmd-click / middle-click / right-click "Open in new tab"
 * will still follow the inner anchor's `href="/@<handle>"` because
 * browser-level new-tab actions bypass our React event handler. Flagged
 * for follow-up — fixing means adding a `linkBehavior` / `hrefOverride`
 * prop to GridCard itself, which is GRID builder territory.
 */
export default function HomepageWallCard({ card }: { card: GridCardView }) {
  const router = useRouter();
  return (
    <div
      className="hp-wall-card-wrap"
      onClick={(e) => {
        e.preventDefault();
        router.push("/grid");
      }}
    >
      <GridCard card={card} />
    </div>
  );
}
