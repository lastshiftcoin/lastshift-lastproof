"use client";

/**
 * OnboardingModal — 4-step quicksetup wizard.
 *
 * Wireframe: lastproof-onboarding.html
 *
 * Step 1: Claim handle (debounced availability check)
 * Step 2: Display name + primary category
 * Step 3: Region/timezone + language + one-liner bio
 * Step 4: Done — summary + "BUILD MY PROFILE" CTA
 *
 * On completion, POSTs to /api/onboarding to create the profile row +
 * primary category, then calls onComplete with the new ProfileRow.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { Session } from "@/lib/session";
import type { ProfileRow } from "@/lib/profiles-store";
import "./onboarding.css";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Community Manager",
  "Mod",
  "Raid Leader",
  "Shiller",
  "Alpha Caller",
  "KOL / Influencer",
  "Space Host / AMA Host",
  "Content Creator",
  "Collab Manager",
  "Growth / Paid Media",
  "Brand / Creative",
  "BD / Partnerships",
  "PR / Comms",
  "Vibe Coder / Builder",
  "Token Dev / Tokenomics",
] as const;

const TIMEZONES = [
  "UTC−12 · Baker Island",
  "UTC−11 · Pago Pago",
  "UTC−10 · Honolulu (HST)",
  "UTC−9 · Anchorage (AKST)",
  "UTC−8 · Los Angeles (PST)",
  "UTC−7 · Denver (MST)",
  "UTC−6 · Mexico City (CST)",
  "UTC−5 · New York (EST)",
  "UTC−4 · Caracas / Halifax",
  "UTC−3 · São Paulo / Buenos Aires",
  "UTC−2 · South Georgia",
  "UTC−1 · Azores",
  "UTC+0 · London (GMT)",
  "UTC+1 · Berlin / Paris (CET)",
  "UTC+2 · Athens / Cairo (EET)",
  "UTC+3 · Moscow / Istanbul",
  "UTC+4 · Dubai",
  "UTC+5 · Karachi / Islamabad",
  "UTC+5:30 · Mumbai / Delhi (IST)",
  "UTC+6 · Dhaka / Almaty",
  "UTC+7 · Bangkok / Jakarta / HCMC",
  "UTC+8 · Singapore / HK / Beijing",
  "UTC+9 · Tokyo / Seoul",
  "UTC+10 · Sydney / Melbourne",
  "UTC+11 · Solomon Islands",
  "UTC+12 · Auckland / Fiji",
] as const;

const LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin",
  "Japanese",
  "Korean",
  "French",
  "German",
  "Portuguese",
] as const;

const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  session: Session;
  operatorId: string;
  onComplete: (profile: ProfileRow) => void;
}

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// ─── Component ───────────────────────────────────────────────────────────────

export function OnboardingModal({ session, operatorId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1 — handle
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — identity
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // Step 3 — region
  const [timezone, setTimezone] = useState("UTC−5 · New York (EST)");
  const [language, setLanguage] = useState("English");
  const [oneLiner, setOneLiner] = useState("");

  const walletShort = session.walletAddress.slice(0, 4) + "…" + session.walletAddress.slice(-4);

  // ─── Handle availability check (debounced 400ms) ─────────────────────────
  const checkHandle = useCallback((val: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!val || val.length < 3) {
      setHandleStatus("idle");
      return;
    }
    if (!HANDLE_RE.test(val)) {
      setHandleStatus("invalid");
      return;
    }

    setHandleStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-handle?handle=${encodeURIComponent(val.toLowerCase())}`);
        const data = await res.json();
        setHandleStatus(data.available ? "available" : "taken");
      } catch {
        setHandleStatus("idle");
      }
    }, 400);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  function handleHandleChange(val: string) {
    // Only allow alphanumeric + underscore
    const clean = val.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    setHandle(clean);
    checkHandle(clean);
  }

  // ─── Step validation ──────────────────────────────────────────────────────
  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return handleStatus === "available";
      case 2:
        return displayName.trim().length >= 2 && category !== null;
      case 3:
        return true; // timezone + language have defaults, one-liner is optional
      case 4:
        return true;
      default:
        return false;
    }
  }

  // ─── Submit on step 4 ─────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId,
          handle: handle.toLowerCase(),
          displayName: displayName.trim(),
          category,
          timezone,
          language,
          oneLiner: oneLiner.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { profile } = await res.json();
      onComplete(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  function handleNext() {
    setError(null);
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      // Move to step 4 (summary) and submit
      setStep(4);
      handleSubmit();
    } else if (step === 4) {
      // "BUILD MY PROFILE" — reload page to show dashboard
      window.location.reload();
    }
  }

  function handleBack() {
    if (step > 1) {
      setError(null);
      setStep(step - 1);
    }
  }

  // ─── Button labels ────────────────────────────────────────────────────────
  function getButtonLabel(): string {
    switch (step) {
      case 1: return "> LOCK IN HANDLE";
      case 2: return "> NEXT";
      case 3: return "> NEXT";
      case 4: return saving ? "> SAVING..." : "> BUILD MY PROFILE";
      default: return "> NEXT";
    }
  }

  // ─── Handle status display ────────────────────────────────────────────────
  function getHandleStatusClass(): string {
    if (handleStatus === "available") return "ob-handle-status ok";
    if (handleStatus === "taken" || handleStatus === "invalid") return "ob-handle-status taken";
    return "ob-handle-status";
  }

  function getHandleStatusText(): string {
    switch (handleStatus) {
      case "checking": return "CHECKING...";
      case "available": return "AVAILABLE";
      case "taken": return "TAKEN";
      case "invalid": return "INVALID";
      default: return "3-20 CHARS";
    }
  }

  function getHandleWrapClass(): string {
    if (handleStatus === "available") return "ob-handle-wrap ok";
    if (handleStatus === "taken" || handleStatus === "invalid") return "ob-handle-wrap taken";
    return "ob-handle-wrap";
  }

  // ─── Category slug helper ────────────────────────────────────────────────
  function catSlug(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="ob-overlay">
      <div className="ob-modal">
        {/* Titlebar */}
        <div className="ob-titlebar">
          <div className="ob-titlebar-left">
            <div className="ob-dots">
              <span className="r" />
              <span className="y" />
              <span className="g" />
            </div>
            <span className="ob-title">lastproof — onboarding</span>
          </div>
          <div className="ob-title-right">
            <span className="ob-pulse" />
            SETUP
          </div>
        </div>

        {/* Wallet + step counter */}
        <div className="ob-wallet-row">
          <span className="ob-step-counter">
            STEP <span className="now">{step}</span> / 4
          </span>
          <div className="ob-wallet-pill">
            <span className="wp-dot" />
            {walletShort}
          </div>
        </div>

        {/* Progress bar */}
        <div className="ob-progress-wrap">
          <div className="ob-bar-track">
            <div
              className="ob-bar-fill"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="ob-body">
          {/* ═══ STEP 1 — Claim Handle ═══ */}
          {step === 1 && (
            <div>
              <div className="ob-pain">QUICK SETUP · 60 SECONDS TO LIVE</div>
              <h2 className="ob-head">
                Grab <span className="accent">your handle.</span>
              </h2>
              <p className="ob-sub">
                This is your name on the Grid. Lock it in and you&apos;re already ahead.
              </p>

              <div className="ob-field">
                <label className="ob-field-key">YOUR HANDLE</label>
                <div className={getHandleWrapClass()}>
                  <div className="ob-handle-prefix">
                    lastproof.app/<span className="at">@</span>
                  </div>
                  <input
                    className="ob-handle-input"
                    type="text"
                    value={handle}
                    onChange={(e) => handleHandleChange(e.target.value)}
                    maxLength={20}
                    placeholder="yourhandle"
                    autoFocus
                  />
                  <div className={getHandleStatusClass()}>
                    <span className="check" />
                    {getHandleStatusText()}
                  </div>
                </div>
              </div>

              <div className="ob-fee-callout">
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="text">
                  Pick well — changing later costs a <b>hefty $LASTSHFT fee</b>.
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 2 — Identity ═══ */}
          {step === 2 && (
            <div>
              <div className="ob-pain">SHOW THE GRID YOUR LANE</div>
              <h2 className="ob-head">
                What do you <span className="accent">do best?</span>
              </h2>
              <p className="ob-sub">
                Pick your lane and your name. You&apos;re almost there.
              </p>

              <div className="ob-field">
                <label className="ob-field-key">
                  DISPLAY NAME{" "}
                  <span className="ob-char-count">{displayName.length} / 30</span>
                </label>
                <input
                  className="ob-field-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                  maxLength={30}
                  placeholder="What people call you"
                  autoFocus
                />
              </div>

              <div className="ob-field">
                <label className="ob-field-key">PRIMARY CATEGORY</label>
                <div className="ob-cat-grid">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`ob-cat-chip${category === catSlug(cat) ? " active" : ""}`}
                      onClick={() => setCategory(
                        category === catSlug(cat) ? null : catSlug(cat)
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 3 — Region / Language / Bio ═══ */}
          {step === 3 && (
            <div>
              <div className="ob-pain">HELP PROJECTS FIND YOU</div>
              <h2 className="ob-head">
                Where do you <span className="accent">ship from?</span>
              </h2>
              <p className="ob-sub">
                Last bit. Then your profile is live.
              </p>

              <div className="ob-field-row">
                <div className="ob-field">
                  <label className="ob-field-key">REGION / TIMEZONE</label>
                  <select
                    className="ob-field-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="ob-field">
                  <label className="ob-field-key">PRIMARY LANGUAGE</label>
                  <select
                    className="ob-field-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ob-field">
                <label className="ob-field-key">
                  ONE-LINER{" "}
                  <span className="ob-char-count">{oneLiner.length} / 160</span>
                </label>
                <textarea
                  className="ob-field-input"
                  rows={3}
                  maxLength={160}
                  value={oneLiner}
                  onChange={(e) => setOneLiner(e.target.value.slice(0, 160))}
                  placeholder="What you ship, in one line."
                />
              </div>
            </div>
          )}

          {/* ═══ STEP 4 — Done / Summary ═══ */}
          {step === 4 && (
            <div className="ob-done-wrap">
              <div className="ob-done-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="ob-pain">YOUR PROFILE IS READY</div>
              <h2 className="ob-head">
                You&apos;re <span className="accent">on the Grid.</span>
              </h2>
              <p className="ob-sub">
                Next: enhance it. Add proofs, links, and screenshots to climb tiers.
              </p>
              <div className="ob-done-summary">
                <div className="ob-ds-row">
                  <span className="ob-ds-key">HANDLE</span>
                  <span className="ob-ds-val accent">@{handle.toLowerCase()}</span>
                </div>
                <div className="ob-ds-row">
                  <span className="ob-ds-key">DISPLAY NAME</span>
                  <span className="ob-ds-val">{displayName.toUpperCase()}</span>
                </div>
                <div className="ob-ds-row">
                  <span className="ob-ds-key">PRIMARY LANE</span>
                  <span className="ob-ds-val">
                    {category
                      ? CATEGORIES.find((c) => catSlug(c) === category)?.toUpperCase() ?? category.toUpperCase()
                      : "—"}
                  </span>
                </div>
                <div className="ob-ds-row">
                  <span className="ob-ds-key">REGION</span>
                  <span className="ob-ds-val">{timezone.split(" · ")[1]?.toUpperCase() ?? timezone.toUpperCase()}</span>
                </div>
                <div className="ob-ds-row">
                  <span className="ob-ds-key">LANGUAGE</span>
                  <span className="ob-ds-val">{language.toUpperCase()}</span>
                </div>
                {oneLiner && (
                  <div className="ob-ds-row">
                    <span className="ob-ds-key">ONE-LINER</span>
                    <span className="ob-ds-val">{oneLiner.toUpperCase()}</span>
                  </div>
                )}
                <div className="ob-ds-row">
                  <span className="ob-ds-key">WALLET</span>
                  <span className="ob-ds-val">{walletShort.toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="ob-error">{error}</div>}

        {/* CTA row */}
        <div className="ob-cta-row">
          {step > 1 && step < 4 && (
            <button type="button" className="ob-btn-back" onClick={handleBack}>
              &larr;
            </button>
          )}
          <button
            type="button"
            className="ob-cta"
            disabled={!canAdvance() || saving}
            onClick={handleNext}
          >
            {getButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
