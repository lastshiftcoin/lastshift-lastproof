"use client";

import { useEffect, useRef } from "react";
import HomepageWallCard from "@/components/HomepageWallCard";
import type { GridCardView } from "@/lib/grid/grid-view";

/**
 * HomepageWall — wraps the 2-column wall grid and equalizes card heights
 * across all rows after mount. Default CSS grid behavior makes cards
 * in the same row equal-height but lets different rows differ; this
 * component finds the tallest card and applies that min-height to every
 * card so the grid reads as uniform tiles regardless of bio length /
 * category count.
 *
 * Re-measures on window resize so layout changes (mobile breakpoints,
 * viewport tweaks) don't desync. No layout shift on first paint because
 * cards naturally render at their content-derived heights — the JS only
 * normalizes upward to the max.
 */
export default function HomepageWall({ cards }: { cards: GridCardView[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    function equalize() {
      const container = ref.current;
      if (!container) return;
      const items =
        container.querySelectorAll<HTMLElement>(".hp-wall-card-wrap");
      if (items.length === 0) return;

      // Reset, measure max natural height, apply.
      items.forEach((el) => {
        el.style.minHeight = "";
      });
      let max = 0;
      items.forEach((el) => {
        const h = el.getBoundingClientRect().height;
        if (h > max) max = h;
      });
      items.forEach((el) => {
        el.style.minHeight = `${Math.ceil(max)}px`;
      });
    }

    equalize();

    // Re-measure on resize (debounced via rAF — sufficient for a small
    // 8-card list, no need for a heavier debounce util).
    let raf = 0;
    function onResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(equalize);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [cards]);

  return (
    <div ref={ref} className="wall hp-wall-equal">
      {cards.map((card) => (
        <HomepageWallCard key={card.handle} card={card} />
      ))}
    </div>
  );
}
