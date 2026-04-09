const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pitch", label: "The Pitch" },
  { key: "pow", label: "Proof of Work" },
  { key: "shots", label: "Screenshots" },
  { key: "links", label: "Links" },
  { key: "about", label: "About Me" },
  { key: "verify", label: "Verifications" },
] as const;

/**
 * Decorative tab bar for step 1. Active = "overview"; no JS switching.
 * All panes render stacked below. Interactive tab switching is a
 * follow-up task (see docs/NEXT-PUBLIC-PROFILE.md §6).
 */
export function ProfileTabs({ active = "overview" }: { active?: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="pp-tabs">
      {TABS.map((t) => (
        <div key={t.key} className={`pp-tab${t.key === active ? " pp-active" : ""}`}>
          {t.label}
        </div>
      ))}
    </nav>
  );
}
