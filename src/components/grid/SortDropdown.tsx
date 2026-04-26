"use client";

import { useEffect, useRef, useState } from "react";
import type { GridSort } from "@/lib/grid/grid-view";
import { SORT_LABELS } from "@/lib/grid/sort";

interface Props {
  active: GridSort;
  onChange: (sort: GridSort) => void;
}

/**
 * Sort dropdown — 4 options. Click outside to close.
 *
 * Per Kellen's override: this is a dropdown, not a pill row. Saves
 * horizontal real estate on the feed-top row, especially on mobile.
 */
export default function SortDropdown({ active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside closes the menu
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Escape closes the menu
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className={`g-sort-dd${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="g-sort-dd-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="lbl">
          Sort: <b>{SORT_LABELS[active]}</b>
        </span>
        <span className="caret">▾</span>
      </button>
      <div className="g-sort-dd-menu" role="listbox">
        {(["relevant", "trusted", "high", "low"] as GridSort[]).map((opt) => (
          <button
            type="button"
            key={opt}
            role="option"
            aria-selected={active === opt}
            className={`g-sort-dd-opt${active === opt ? " active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt);
              setOpen(false);
            }}
          >
            <span>
              {opt === "high" || opt === "low" ? (
                <>
                  {opt === "high" ? "$$$$ " : "$ "}
                  <span className="arr">{opt === "high" ? "↓" : "↑"}</span>
                </>
              ) : (
                SORT_LABELS[opt]
              )}
            </span>
            <span className="check">✓</span>
          </button>
        ))}
      </div>
    </div>
  );
}
