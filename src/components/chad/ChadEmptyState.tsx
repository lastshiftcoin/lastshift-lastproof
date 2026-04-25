/**
 * ChadEmptyState — shared zero-state block for chad list views.
 *
 * Per locked design (Kellen): no CTA button. Just an icon, headline,
 * and a sub-line of copy. The "copy my profile link" CTA was removed.
 */

interface Props {
  context: "public" | "dashboard";
}

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M21.5 17a4 4 0 0 0-7-2.7" />
  </svg>
);

export function ChadEmptyState({ context }: Props) {
  return (
    <div className="chad-empty">
      <div className="chad-empty-icon">{ICON}</div>
      <div className="chad-empty-title">NO CHADS YET</div>
      <div className="chad-empty-copy">
        {context === "public"
          ? "This operator hasn't connected with anyone yet."
          : "Share your profile to start your army."}
      </div>
    </div>
  );
}
