"use client";

/**
 * PitchCard — full pitch textarea + SHIFTBOT compose strip.
 *
 * Wireframe: lastproof-dashboard.html, THE PITCH section.
 *
 * - Textarea for the operator's full pitch
 * - SHIFTBOT strip: sends textarea content to /api/shiftbot/compose,
 *   typewriter-types the rewrite directly into the textarea
 * - UNDO reverts to original text
 * - SAVE button with feedback
 */

import { useState, useRef, useCallback } from "react";
import type { ProfileRow } from "@/lib/profiles-store";
import { useDebugLog } from "@/lib/debug/useDebugLog";

interface PitchCardProps {
  profile: ProfileRow;
  onProfileUpdate: (profile: ProfileRow) => void;
}

export function PitchCard({ profile, onProfileUpdate }: PitchCardProps) {
  const [pitch, setPitch] = useState(profile.pitch ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debug = useDebugLog();

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

    debug.log("proof_flow", "dashboard_pitch_save", { length: pitch.trim().length });
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
        debug.log("error", "dashboard_pitch_save_failed", { status: res.status, error: data.error });
        alert(data.error || "Save failed");
        return;
      }

      const { profile: updated } = await res.json();
      if (updated) onProfileUpdate(updated);

      debug.log("proof_flow", "dashboard_pitch_save_ok", { length: pitch.trim().length });
      setSaved(true);
      setOriginalText(null); // clear undo after save
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      debug.log("error", "dashboard_pitch_save_network_error", { error: String(err) });
      alert("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const typewriterFill = useCallback((text: string) => {
    setBotTyping(true);
    setPitch("");
    let i = 0;
    function tick() {
      i++;
      setPitch(text.slice(0, i));
      if (i < text.length) {
        typeTimer.current = setTimeout(tick, 18);
      } else {
        setBotTyping(false);
      }
    }
    typeTimer.current = setTimeout(tick, 200);
  }, []);

  async function handleBotRewrite() {
    const text = pitch.trim();
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
    setOriginalText(pitch); // save for undo

    try {
      const res = await fetch("/api/shiftbot/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, field: "pitch" }),
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
      setPitch(originalText);
      setOriginalText(null);
    }
  }

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">THE PITCH</div>
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
        spellCheck
        lang="en"
        value={pitch}
        onChange={(e) => {
          if (!botTyping) setPitch(e.target.value);
        }}
        onPaste={(e) => {
          if (botTyping) return;
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const target = e.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const current = pitch;
          setPitch(current.slice(0, start) + text + current.slice(end));
          requestAnimationFrame(() => {
            target.selectionStart = target.selectionEnd = start + text.length;
          });
        }}
        readOnly={botTyping}
        rows={6}
        placeholder="I run launch operations for memecoin projects on Solana..."
      />
      <div className="field-help field-help-bright">
        Tell devs and projects why they should hire you over others — what you do, who you&apos;ve worked with, what makes you the right pick.
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
          {botTyping ? "typing..." : botLoading ? "thinking..." : "improve your pitch with AI"}
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
