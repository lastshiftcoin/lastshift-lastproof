"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GridFilters } from "@/lib/grid/grid-view";
import FilterSections from "./FilterSections";

interface Props {
  open: boolean;
  filters: GridFilters;
  resultCount: number;
  onClose: () => void;
  onUpdateFilter: (patch: Partial<GridFilters>) => void;
  onClearAll: () => void;
  /**
   * When true, all filter inputs are faded + non-interactive. Used in
   * SHIFTBOT-ranked mode. Close + Apply buttons stay live so the user
   * can still dismiss the drawer.
   */
  locked?: boolean;
}

/**
 * Mobile slide-in filter drawer — full height, slides in from the right,
 * Apply / Clear actions pinned at the bottom.
 *
 * Portaled to `document.body` to escape the `.wrap` stacking context
 * (which sits at z-index: 1). Without the portal, the inherited
 * `.shiftbot` strip (rendered as a sibling of `.wrap`) layers on top of
 * the drawer's bottom area and hides the Apply button.
 *
 * Body scroll locked while drawer is open. Escape closes. Backdrop click
 * closes.
 */
export default function FilterDrawer({
  open,
  filters,
  resultCount,
  onClose,
  onUpdateFilter,
  onClearAll,
  locked = false,
}: Props) {
  // SSR guard — `document` doesn't exist server-side. Mount on first
  // client render, then enable the portal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  const drawer = (
    <>
      <button
        type="button"
        className={`g-drawer-overlay${open ? " open" : ""}`}
        aria-label="Close filters"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={`g-drawer${open ? " open" : ""}${locked ? " g-locked" : ""}`}
        role="dialog"
        aria-label="Filters"
        aria-hidden={!open}
        aria-disabled={locked || undefined}
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
          <FilterSections
            filters={filters}
            onUpdateFilter={onUpdateFilter}
            locked={locked}
          />
        </div>
        <div className="g-drawer-foot">
          <button
            type="button"
            className="clear"
            onClick={onClearAll}
            disabled={locked}
          >
            Clear all
          </button>
          <button type="button" className="apply" onClick={onClose}>
            Apply ({resultCount} {resultCount === 1 ? "result" : "results"})
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(drawer, document.body);
}
