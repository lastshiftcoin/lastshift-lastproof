"use client";

import type { ActiveFilterChip } from "@/lib/grid/filter";

interface Props {
  chips: ActiveFilterChip[];
  onRemove: (chip: ActiveFilterChip) => void;
}

/**
 * Inline chips at the top of the feed showing each active filter.
 * Each chip has an `×` to remove that single filter.
 */
export default function ActiveFilterChips({ chips, onRemove }: Props) {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => (
        <span key={chip.id} className="g-afchip">
          {chip.label}
          <button
            type="button"
            className="x"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={() => onRemove(chip)}
          >
            ×
          </button>
        </span>
      ))}
    </>
  );
}
