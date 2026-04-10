"use client";

/**
 * AboutCard — about me textarea + SHIFTBOT compose strip.
 *
 * Wireframe: lastproof-dashboard.html, ABOUT ME section.
 *
 * - Textarea for free-form about text
 * - SHIFTBOT strip: sends textarea content to /api/shiftbot/compose,
 *   typewriter-types the rewrite directly into the textarea
 * - UNDO reverts to original text
 * - SAVE with feedback
 */

import { useState, useRef, useCallback } from "react";
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

  // SHIFTBOT state
  const [botLoading, setBotLoading] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setOriginalText(null);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const typewriterFill = useCallback((text: string) => {
    setBotTyping(true);
    setAbout("");
    let i = 0;
    function tick() {
      i++;
      setAbout(text.slice(0, i));
      if (i < text.length) {
        typeTimer.current = setTimeout(tick, 18);
      } else {
        setBotTyping(false);
      }
    }
    typeTimer.current = setTimeout(tick, 200);
  }, []);

  async function handleBotRewrite() {
    const text = about.trim();
    if (!text) {
      setBotError("Start by typing at least one sentence, then let SHIFTBOT improve it.");
      return;
    }
    if (text.length < 10) {
      setBotError("Write a bit more first — at least one full sentence.");
      return;
    }

    setBotLoading(true);
    setBotError(null);
    setOriginalText(about);

    try {
      const res = await fetch("/api/shiftbot/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, field: "about" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBotError(data.error || "SHIFTBOT couldn't rewrite right now.");
        setOriginalText(null);
        return;
      }

      typewriterFill(data.rewrite);
    } catch {
      setBotError("SHIFTBOT is temporarily unavailable.");
      setOriginalText(null);
    } finally {
      setBotLoading(false);
    }
  }

  function handleUndo() {
    if (typeTimer.current) clearTimeout(typeTimer.current);
    setBotTyping(false);
    if (originalText !== null) {
      setAbout(originalText);
      setOriginalText(null);
    }
  }

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">ABOUT ME</div>
        <div className="edit-head-actions">
          {originalText !== null && (
            <button type="button" className="bot-undo" onClick={handleUndo}>
              UNDO ↩
            </button>
          )}
          <button
            type="button"
            className={`edit-action${saved ? " saved" : ""}`}
            onClick={handleSave}
            disabled={saving || botTyping}
          >
            {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE →"}
          </button>
        </div>
      </div>

      <textarea
        className={`field-input${botTyping ? " bot-typing" : ""}`}
        value={about}
        onChange={(e) => {
          if (!botTyping) setAbout(e.target.value);
        }}
        readOnly={botTyping}
        rows={5}
        placeholder="Based in Europe. Started in gaming guilds, fell into crypto in 2022..."
      />
      <div className="field-help">
        background, interests, anything that makes you human
      </div>

      {botError && (
        <div className="bot-error">{botError}</div>
      )}

      {/* SHIFTBOT inline strip */}
      <div className="bot-strip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="bot-icon-sm" />
        <span className="bot-strip-label">SHIFTBOT</span>
        <span className="bot-strip-hint">
          {botTyping ? "typing..." : botLoading ? "thinking..." : "improve your bio with AI"}
        </span>
        <button
          type="button"
          className="bot-strip-send"
          disabled={botLoading || botTyping}
          onClick={handleBotRewrite}
        >
          {botLoading || botTyping ? "..." : "REWRITE →"}
        </button>
      </div>
    </div>
  );
}
