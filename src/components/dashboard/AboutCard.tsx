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
  /** Previous handles from handle_history, loaded server-side. */
  previousHandles?: string[];
}

export function AboutCard({ profile, onProfileUpdate, previousHandles = [] }: AboutCardProps) {
  const [about, setAbout] = useState(profile.about ?? "");
  const [aliases, setAliases] = useState<string[]>(previousHandles);
  const [aliasInput, setAliasInput] = useState("");
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
      const [profileRes, aliasRes] = await Promise.all([
        fetch("/api/dashboard/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: { about: about.trim() || null },
          }),
        }),
        fetch("/api/dashboard/aliases", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aliases }),
        }),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }
      if (!aliasRes.ok) {
        console.error("[about] aliases save failed");
      }

      const { profile: updated } = await profileRes.json();
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
        onPaste={(e) => {
          if (botTyping) return;
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const target = e.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const current = about;
          setAbout(current.slice(0, start) + text + current.slice(end));
          requestAnimationFrame(() => {
            target.selectionStart = target.selectionEnd = start + text.length;
          });
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

      {/* Previously Known As */}
      <div style={{ marginTop: 18 }}>
        <div className="field-key" style={{ marginBottom: 8 }}>Previously Known As</div>
        <div className="field-help" style={{ marginBottom: 10 }}>
          Add any past handles you&apos;ve used. Shown on your public profile so people can find you.
        </div>
        {aliases.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {aliases.map((a) => (
              <span
                key={a}
                style={{
                  fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)",
                  background: "var(--bg-input)", border: "1px solid var(--border)",
                  padding: "4px 8px", borderRadius: 4, display: "inline-flex",
                  alignItems: "center", gap: 6,
                }}
              >
                @{a}
                <button
                  type="button"
                  onClick={() => setAliases((prev) => prev.filter((x) => x !== a))}
                  style={{
                    fontFamily: "var(--mono)", fontSize: 10, color: "var(--red, #ff5470)",
                    background: "transparent", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>@</span>
          <input
            className="field-input"
            style={{ flex: 1, padding: "6px 10px", fontSize: 11 }}
            placeholder="old_handle"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value.replace(/^@/, "").replace(/\s/g, "").toLowerCase())}
            maxLength={30}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aliasInput.trim()) {
                e.preventDefault();
                if (!aliases.includes(aliasInput.trim())) {
                  setAliases((prev) => [...prev, aliasInput.trim()]);
                }
                setAliasInput("");
              }
            }}
          />
          <button
            type="button"
            className="btn-add"
            style={{ padding: "6px 12px", fontSize: 10 }}
            onClick={() => {
              if (aliasInput.trim() && !aliases.includes(aliasInput.trim())) {
                setAliases((prev) => [...prev, aliasInput.trim()]);
              }
              setAliasInput("");
            }}
            disabled={!aliasInput.trim()}
          >
            ADD
          </button>
        </div>
      </div>

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
