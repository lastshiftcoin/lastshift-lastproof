"use client";

import type { GridFilters } from "@/lib/grid/grid-view";
import FilterSections from "./FilterSections";

interface Props {
  filters: GridFilters;
  hasActiveFilters: boolean;
  onUpdateFilter: (patch: Partial<GridFilters>) => void;
  onClearAll: () => void;
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
}: Props) {
  return (
    <aside className="g-sidebar" aria-label="Filters">
      <div className="g-sb-head">
        <div className="title">Filters</div>
        {hasActiveFilters && (
          <button type="button" className="clear" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>
      <FilterSections filters={filters} onUpdateFilter={onUpdateFilter} />
    </aside>
  );
}
