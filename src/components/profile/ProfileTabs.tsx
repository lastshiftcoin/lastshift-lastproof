"use client";

import { useEffect, useState } from "react";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pitch", label: "The Pitch" },
  { key: "pow", label: "Proof of Work" },
  { key: "shots", label: "Screenshots" },
  { key: "links", label: "Links" },
  { key: "about", label: "About Me" },
  { key: "verify", label: "Verifications" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Client tab bar. "overview" shows every pane stacked (default); any
 * other key hides all panes except the one whose [data-pane] matches.
 * Panes are owned by the server page — this component only toggles the
 * native `hidden` attribute on matching elements.
 */
export function ProfileTabs({ active: initial = "overview" }: { active?: TabKey }) {
  const [active, setActive] = useState<TabKey>(initial);

  useEffect(() => {
    const panes = document.querySelectorAll<HTMLElement>("[data-pane]");
    panes.forEach((el) => {
      const key = el.dataset.pane;
      el.hidden = active !== "overview" && key !== active;
    });
  }, [active]);

  return (
    <nav className="pp-tabs">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setActive(t.key)}
          className={`pp-tab${t.key === active ? " pp-active" : ""}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
