"use client";

/**
 * PitchCard — full pitch textarea + SHIFTBOT strip.
 *
 * Wireframe: lastproof-dashboard.html, THE PITCH section.
 *
 * - Textarea for the operator's full pitch
 * - field-help: "your full pitch — what you do, who you do it for, what makes you different"
 * - SHIFTBOT inline strip (placeholder for AI rewrite — stub for now)
 * - SAVE button with feedback
 */

import { useState, useRef } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface PitchCardProps {
  profile: ProfileRow;
  onProfileUpdate: (profile: ProfileRow) => void;
}

export function PitchCard({ profile, onProfileUpdate }: PitchCardProps) {
  const [pitch, setPitch] = useState(profile.pitch ?? "");
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
          fields: { pitch: pitch.trim() || null },
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
        <div className="edit-title">THE PITCH</div>
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
        spellCheck
        lang="en"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={6}
        placeholder="I run launch operations for memecoin projects on Solana..."
      />
      <div className="field-help">
        your full pitch — what you do, who you do it for, what makes you different
      </div>

      {/* SHIFTBOT inline strip — AI rewrite stub */}
      <div className="bot-strip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="bot-icon-sm" />
        <span className="bot-strip-label">SHIFTBOT</span>
        <input
          className="bot-strip-input"
          placeholder="Ask SHIFTBOT to rewrite your pitch..."
          disabled
        />
        <button type="button" className="bot-strip-send" disabled>
          SEND
        </button>
      </div>
    </div>
  );
}
