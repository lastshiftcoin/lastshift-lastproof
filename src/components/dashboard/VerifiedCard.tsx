"use client";

/**
 * VerifiedCard — X and Telegram verification for the blue checkmark.
 *
 * Wireframe: lastproof-dashboard.html, GET VERIFIED section.
 *
 * - Blue checkmark badge (locked when incomplete, active when both verified)
 * - X / Twitter row: enter handle → CONNECT, or shows @handle + DISCONNECT
 * - Telegram row: enter handle → CONNECT, or shows @handle + DISCONNECT
 * - Progress bar: 0%, 50%, or 100% based on linked handles
 *
 * MVP flow: operator self-reports their handle. Verification (x_verified,
 * tg_verified) is set by admin/automated check later. The badge lights up
 * only when both _verified flags are true.
 *
 * Handle link/unlink calls POST /api/dashboard/verify.
 */

import { useState } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface VerifiedCardProps {
  profile: ProfileRow;
  onProfileUpdate?: (profile: ProfileRow) => void;
}

export function VerifiedCard({ profile, onProfileUpdate }: VerifiedCardProps) {
  const [xHandle, setXHandle] = useState(profile.xHandle ?? "");
  const [tgHandle, setTgHandle] = useState(profile.tgHandle ?? "");
  const [xLinked, setXLinked] = useState(!!profile.xHandle);
  const [tgLinked, setTgLinked] = useState(!!profile.tgHandle);
  const [xVerified, setXVerified] = useState(profile.xVerified);
  const [tgVerified, setTgVerified] = useState(profile.tgVerified);
  const [xSaving, setXSaving] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);

  // Input mode: show input field when connecting
  const [xInputMode, setXInputMode] = useState(false);
  const [tgInputMode, setTgInputMode] = useState(false);
  const [xInput, setXInput] = useState("");
  const [tgInput, setTgInput] = useState("");

  const bothVerified = xVerified && tgVerified;
  const progressPct = (xLinked ? 50 : 0) + (tgLinked ? 50 : 0);

  async function linkPlatform(platform: "x" | "tg", handle: string) {
    const setSaving = platform === "x" ? setXSaving : setTgSaving;
    setSaving(true);

    try {
      const res = await fetch("/api/dashboard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to connect");
        return;
      }

      const data = await res.json();

      if (platform === "x") {
        setXHandle(data.handle);
        setXLinked(true);
        setXVerified(false); // Pending verification
        setXInputMode(false);
        setXInput("");
      } else {
        setTgHandle(data.handle);
        setTgLinked(true);
        setTgVerified(false);
        setTgInputMode(false);
        setTgInput("");
      }
    } catch {
      alert("Connection failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkPlatform(platform: "x" | "tg") {
    if (!confirm(`Disconnect ${platform === "x" ? "X / Twitter" : "Telegram"}?`)) return;

    const setSaving = platform === "x" ? setXSaving : setTgSaving;
    setSaving(true);

    try {
      const res = await fetch("/api/dashboard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: null }),
      });

      if (!res.ok) {
        alert("Disconnect failed");
        return;
      }

      if (platform === "x") {
        setXHandle("");
        setXLinked(false);
        setXVerified(false);
      } else {
        setTgHandle("");
        setTgLinked(false);
        setTgVerified(false);
      }
    } catch {
      alert("Disconnect failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">GET VERIFIED</div>
      </div>

      {/* Badge + copy */}
      <div className="verify-wrap">
        <div className={`verify-badge${bothVerified ? "" : " locked"}`}>
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M60 6 L74 16 L91 14 L96 31 L110 41 L104 58 L110 75 L96 85 L91 102 L74 100 L60 110 L46 100 L29 102 L24 85 L10 75 L16 58 L10 41 L24 31 L29 14 L46 16 Z"
              fill="#409eff"
              stroke="#7eb8ff"
              strokeWidth="1.5"
            />
          </svg>
          <span className="check">{"\u2713"}</span>
        </div>
        <div className="verify-copy">
          <div className="verify-headline">
            Earn the <span className="blue">blue checkmark</span>
          </div>
          <div className="verify-sub">
            Link X and Telegram to unlock the badge. Telegram is required for the HIRE button.
          </div>
          <div className="verify-progress">
            <div className="verify-bar">
              <div className="verify-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Platform rows */}
      <div className="verify-rows">
        {/* X / Twitter */}
        <div className={`verify-row${xLinked ? " linked" : ""}`}>
          <div className="vr-icon x">{"\ud835\udd4f"}</div>
          <div className="vr-meta">
            <div className="vr-name">
              X / Twitter
              {xLinked && !xVerified && (
                <span style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8,
                  letterSpacing: 1,
                  color: "var(--accent)",
                  marginLeft: 8,
                }}>PENDING VERIFICATION</span>
              )}
            </div>
            {xLinked ? (
              <div className="vr-handle connected">@{xHandle}</div>
            ) : xInputMode ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>@</span>
                <input
                  className="field-input"
                  style={{ flex: 1, padding: "6px 10px", fontSize: 11 }}
                  placeholder="your_x_handle"
                  value={xInput}
                  onChange={(e) => setXInput(e.target.value.replace(/^@/, ""))}
                  maxLength={40}
                  autoFocus
                />
              </div>
            ) : (
              <div className="vr-handle">not connected</div>
            )}
          </div>
          {xLinked ? (
            <button
              type="button"
              className="vr-action disconnect"
              onClick={() => unlinkPlatform("x")}
              disabled={xSaving}
            >
              {xSaving ? "..." : "DISCONNECT"}
            </button>
          ) : xInputMode ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="vr-action connect"
                onClick={() => { if (xInput.trim()) linkPlatform("x", xInput.trim()); }}
                disabled={xSaving || !xInput.trim()}
              >
                {xSaving ? "..." : "SAVE"}
              </button>
              <button
                type="button"
                style={{
                  fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)",
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "5px 8px", cursor: "pointer",
                }}
                onClick={() => { setXInputMode(false); setXInput(""); }}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="vr-action connect"
              onClick={() => setXInputMode(true)}
            >
              CONNECT
            </button>
          )}
        </div>

        {/* Telegram */}
        <div className={`verify-row${tgLinked ? " linked" : ""}`}>
          <div className="vr-icon tg">T</div>
          <div className="vr-meta">
            <div className="vr-name">
              Telegram
              {tgLinked && !tgVerified && (
                <span style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8,
                  letterSpacing: 1,
                  color: "var(--accent)",
                  marginLeft: 8,
                }}>PENDING VERIFICATION</span>
              )}
            </div>
            {tgLinked ? (
              <div className="vr-handle connected">@{tgHandle}</div>
            ) : tgInputMode ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>@</span>
                <input
                  className="field-input"
                  style={{ flex: 1, padding: "6px 10px", fontSize: 11 }}
                  placeholder="your_tg_handle"
                  value={tgInput}
                  onChange={(e) => setTgInput(e.target.value.replace(/^@/, ""))}
                  maxLength={40}
                  autoFocus
                />
              </div>
            ) : (
              <div className="vr-handle">required for HIRE button</div>
            )}
          </div>
          {tgLinked ? (
            <button
              type="button"
              className="vr-action disconnect"
              onClick={() => unlinkPlatform("tg")}
              disabled={tgSaving}
            >
              {tgSaving ? "..." : "DISCONNECT"}
            </button>
          ) : tgInputMode ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="vr-action connect"
                onClick={() => { if (tgInput.trim()) linkPlatform("tg", tgInput.trim()); }}
                disabled={tgSaving || !tgInput.trim()}
              >
                {tgSaving ? "..." : "SAVE"}
              </button>
              <button
                type="button"
                style={{
                  fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)",
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "5px 8px", cursor: "pointer",
                }}
                onClick={() => { setTgInputMode(false); setTgInput(""); }}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="vr-action connect"
              onClick={() => setTgInputMode(true)}
            >
              CONNECT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
