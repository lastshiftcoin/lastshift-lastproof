"use client";

import type { CategoryChip } from "@/lib/grid/category-chips";

interface Props {
  /** Categories sorted by usage count descending — reads `categories.operator_count`. */
  chips: CategoryChip[];
  /** Currently selected category slug, or "all". */
  active: string;
  /** Click handler — receives the category slug, "all" for the leftmost chip. */
  onSelect: (slug: string) => void;
}

/**
 * Horizontal row of 16 chips: ALL + 15 operator categories. Single-select.
 * Wraps to multiple lines on narrow viewports.
 */
export default function CategoryChipRow({ chips, active, onSelect }: Props) {
  return (
    <div className="g-cat-strip">
      <div className="section-label">BROWSE BY OPERATOR TYPE</div>
      <div className="inner">
        <button
          type="button"
          className={`g-chip${active === "all" ? " active" : ""}`}
          onClick={() => onSelect("all")}
        >
          All
        </button>
        {chips.map((c) => (
          <button
            type="button"
            key={c.slug}
            className={`g-chip${active === c.slug ? " active" : ""}`}
            onClick={() => onSelect(c.slug)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
