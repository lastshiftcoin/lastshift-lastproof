"use client";

/**
 * CategoriesCard — additional category selection (up to 4).
 *
 * Wireframe: lastproof-dashboard.html, CATEGORIES section.
 *
 * - Primary category is shown locked (set in Identity card)
 * - User can toggle up to 4 additional categories
 * - SAVE persists to profile_categories via /api/dashboard/categories
 */

import { useState, useRef } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

const CATEGORIES = [
  { slug: "community-manager", label: "Community Manager" },
  { slug: "mod", label: "Mod" },
  { slug: "raid-leader", label: "Raid Leader" },
  { slug: "shiller", label: "Shiller" },
  { slug: "alpha-caller", label: "Alpha Caller" },
  { slug: "kol-influencer", label: "KOL / Influencer" },
  { slug: "space-host-ama-host", label: "Space Host / AMA Host" },
  { slug: "content-creator", label: "Content Creator" },
  { slug: "collab-manager", label: "Collab Manager" },
  { slug: "growth-paid-media", label: "Growth / Paid Media" },
  { slug: "brand-creative", label: "Brand / Creative" },
  { slug: "bd-partnerships", label: "BD / Partnerships" },
  { slug: "pr-comms", label: "PR / Comms" },
  { slug: "vibe-coder-builder", label: "Vibe Coder / Builder" },
  { slug: "token-dev-tokenomics", label: "Token Dev / Tokenomics" },
] as const;

const MAX_ADDITIONAL = 4;

interface CategoriesCardProps {
  profile: ProfileRow;
  primaryCategory: string | null;
  /** Additional category slugs (not including primary). */
  initialAdditional: string[];
}

export function CategoriesCard({ profile, primaryCategory, initialAdditional }: CategoriesCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialAdditional));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryLabel = primaryCategory
    ? CATEGORIES.find((c) => c.slug === primaryCategory)?.label ?? primaryCategory
    : null;

  function toggleCategory(slug: string) {
    // Can't toggle primary
    if (slug === primaryCategory) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < MAX_ADDITIONAL) {
        next.add(slug);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    try {
      const res = await fetch("/api/dashboard/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additional: Array.from(selected),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }

      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">
          ADDITIONAL CATEGORIES{" "}
          <span
            className="status-note"
            style={{ color: "var(--text-dim)", marginLeft: 10 }}
          >
            {selected.size} / {MAX_ADDITIONAL} SELECTED
          </span>
        </div>
        <button
          type="button"
          className={`edit-action${saved ? " saved" : ""}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE →"}
        </button>
      </div>

      <div className="field-help" style={{ margin: "0 0 12px" }}>
        Select up to {MAX_ADDITIONAL}. Your Primary Category from Identity is shown alongside these on your profile.
      </div>

      <div className="chips">
        {/* Primary — locked chip */}
        {primaryLabel && (
          <div
            className="chip selected locked"
            title="Your Primary Category — set in Identity"
          >
            {primaryLabel}
          </div>
        )}

        {/* Selectable chips */}
        {CATEGORIES.filter((c) => c.slug !== primaryCategory).map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`chip${selected.has(c.slug) ? " selected" : ""}${
              !selected.has(c.slug) && selected.size >= MAX_ADDITIONAL ? " disabled" : ""
            }`}
            onClick={() => toggleCategory(c.slug)}
            disabled={!selected.has(c.slug) && selected.size >= MAX_ADDITIONAL}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
