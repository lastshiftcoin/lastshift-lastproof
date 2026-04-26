"use client";

import { useRouter } from "next/navigation";

interface Props {
  /** The user's original query — surfaced in the banner copy. */
  query: string;
  /**
   * Mode determines the banner copy:
   *   "filter"  — Mode A applied: SHIFTBOT mapped query to filter values
   *   "search"  — Mode B: SHIFTBOT ranked operators by content match
   *   "fallback" — Mode B fallback: no specific matches; default ordering
   */
  mode: "filter" | "search" | "fallback";
}

/**
 * Renders above the card list on /operators when SHIFTBOT was the source
 * of the current view (i.e. ?q= is in URL). Click [Reset] to drop all
 * SHIFTBOT params and return to a clean Grid.
 */
export default function ShiftbotBanner({ query, mode }: Props) {
  const router = useRouter();

  const onReset = () => router.push("/operators");

  const label =
    mode === "search"
      ? "SHIFTBOT results"
      : mode === "fallback"
      ? "SHIFTBOT couldn't find specific matches"
      : "SHIFTBOT applied filters";

  return (
    <div className="g-shiftbot-banner" role="status">
      <span className="sbb-icon">▸</span>
      <span className="sbb-label">{label}</span>
      <span className="sbb-sep">for</span>
      <span className="sbb-query">&ldquo;{query}&rdquo;</span>
      {mode === "fallback" && (
        <span className="sbb-note">— showing all operators in default order</span>
      )}
      <button type="button" className="sbb-reset" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
