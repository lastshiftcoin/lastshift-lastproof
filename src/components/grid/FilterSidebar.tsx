"use client";

import type { GridFilters } from "@/lib/grid/grid-view";
import FilterSections from "./FilterSections";

interface Props {
  filters: GridFilters;
  hasActiveFilters: boolean;
  onUpdateFilter: (patch: Partial<GridFilters>) => void;
  onClearAll: () => void;
  /**
   * When true, all filter inputs are visually faded and non-interactive.
   * Used in SHIFTBOT-ranked mode where Groq's order is the answer and
   * any user filter would be ignored anyway.
   */
  locked?: boolean;
}

/**
 * Desktop filter sidebar — sticky to top of viewport, own scroll, 7
 * collapsible sections. Hidden below 768px (mobile uses FilterDrawer).
 */
export default function FilterSidebar({
  filters,
  hasActiveFilters,
  onUpdateFilter,
  onClearAll,
  locked = false,
}: Props) {
  return (
    <aside
      className={`g-sidebar${locked ? " g-locked" : ""}`}
      aria-label="Filters"
      aria-disabled={locked || undefined}
    >
      <div className="g-sb-head">
        <div className="title">Filters</div>
        {hasActiveFilters && (
          <button
            type="button"
            className="clear"
            onClick={onClearAll}
            disabled={locked}
          >
            Clear all
          </button>
        )}
      </div>
      <FilterSections
        filters={filters}
        onUpdateFilter={onUpdateFilter}
        locked={locked}
      />
    </aside>
  );
}
