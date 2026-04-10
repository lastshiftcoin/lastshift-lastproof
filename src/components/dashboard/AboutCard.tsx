"use client";

/**
 * AboutCard — about me textarea + SHIFTBOT strip.
 *
 * Wireframe: lastproof-dashboard.html, ABOUT ME section.
 *
 * - Textarea for free-form about text
 * - field-help: "background, interests, anything that makes you human"
 * - SHIFTBOT inline strip (stub)
 * - SAVE with feedback
 */

import { useState, useRef } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface AboutCardProps {
  profile: ProfileRow;
  onProfileUpdate: (profile: ProfileRow) => void;
}

export function AboutCard({ profile, onProfileUpdate }: AboutCardProps) {
  const [about, setAbout] = useState(profile.about ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { about: about.trim() || null },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }

      const { profile: updated } = await res.json();
      if (updated) onProfileUpdate(updated);

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
        <div className="edit-title">ABOUT ME</div>
        <button
          type="button"
          className={`edit-action${saved ? " saved" : ""}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE →"}
        </button>
      </div>

      <textarea
        className="field-input"
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        rows={5}
        placeholder="Based in Europe. Started in gaming guilds, fell into crypto in 2022..."
      />
      <div className="field-help">
        background, interests, anything that makes you human
      </div>

      {/* SHIFTBOT inline strip — AI rewrite stub */}
      <div className="bot-strip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="bot-icon-sm" />
        <span className="bot-strip-label">SHIFTBOT</span>
        <input
          className="bot-strip-input"
          placeholder="Ask SHIFTBOT to rewrite your bio..."
          disabled
        />
        <button type="button" className="bot-strip-send" disabled>
          SEND
        </button>
      </div>
    </div>
  );
}
