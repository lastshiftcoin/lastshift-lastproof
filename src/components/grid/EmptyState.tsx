"use client";

/**
 * Rendered when active filters narrow the result set to zero.
 * One CTA: clear all filters.
 */
export default function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="g-empty">
      <h3>No operators match</h3>
      <p>
        Your filters are tight. Try widening the range, dropping a tier, or
        clearing one filter at a time.
      </p>
      <button type="button" className="reset" onClick={onReset}>
        Clear all filters
      </button>
    </div>
  );
}
