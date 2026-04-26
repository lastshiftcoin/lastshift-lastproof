"use client";

import { useEffect } from "react";
import type { GridFilters } from "@/lib/grid/grid-view";
import FilterSections from "./FilterSections";

interface Props {
  open: boolean;
  filters: GridFilters;
  resultCount: number;
  onClose: () => void;
  onUpdateFilter: (patch: Partial<GridFilters>) => void;
  onClearAll: () => void;
}

/**
 * Mobile slide-in filter drawer — full height, slides in from the right,
 * Apply / Clear actions pinned at the bottom.
 *
 * Body scroll locked while drawer is open. Escape key closes. Backdrop
 * click closes.
 */
export default function FilterDrawer({
  open,
  filters,
  resultCount,
  onClose,
  onUpdateFilter,
  onClearAll,
}: Props) {
  // Body scroll lock + escape-key handler while open
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("g-drawer-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("g-drawer-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={`g-drawer-overlay${open ? " open" : ""}`}
        aria-label="Close filters"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={`g-drawer${open ? " open" : ""}`}
        role="dialog"
        aria-label="Filters"
        aria-hidden={!open}
      >
        <div className="g-drawer-head">
          <div className="title">Filters</div>
          <button
            type="button"
            className="close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="g-drawer-body">
          <FilterSections filters={filters} onUpdateFilter={onUpdateFilter} />
        </div>
        <div className="g-drawer-foot">
          <button type="button" className="clear" onClick={onClearAll}>
            Clear all
          </button>
          <button type="button" className="apply" onClick={onClose}>
            Apply ({resultCount} {resultCount === 1 ? "result" : "results"})
          </button>
        </div>
      </aside>
    </>
  );
}
