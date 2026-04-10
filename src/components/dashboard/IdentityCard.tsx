"use client";

/**
 * IdentityCard — the main profile editor card.
 *
 * Wireframe: lastproof-dashboard.html `.edit-card[data-card=identity]`
 *
 * Layout:
 *   - Profile URL bar (green): lastproof.app/@handle + CHANGE + VIEW PROFILE
 *   - Avatar (initials fallback) + UPLOAD button
 *   - 2-column grid of fields:
 *     Display Name | Primary Category
 *     Region/TZ    | Fee Range
 *     Language      | Secondary Language
 *     Website (full width)
 *     Short Bio (full width)
 *   - SAVE button in header
 *
 * On save, PATCHes /api/dashboard/profile with changed fields.
 */

import { useState, useCallback, useRef } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

// ─── Option lists ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "community-manager", label: "Community Manager" },
  { value: "mod", label: "Mod" },
  { value: "raid-leader", label: "Raid Leader" },
  { value: "shiller", label: "Shiller" },
  { value: "alpha-caller", label: "Alpha Caller" },
  { value: "kol-influencer", label: "KOL / Influencer" },
  { value: "space-host-ama-host", label: "Space Host / AMA Host" },
  { value: "content-creator", label: "Content Creator" },
  { value: "collab-manager", label: "Collab Manager" },
  { value: "growth-paid-media", label: "Growth / Paid Media" },
  { value: "brand-creative", label: "Brand / Creative" },
  { value: "bd-partnerships", label: "BD / Partnerships" },
  { value: "pr-comms", label: "PR / Comms" },
  { value: "vibe-coder-builder", label: "Vibe Coder / Builder" },
  { value: "token-dev-tokenomics", label: "Token Dev / Tokenomics" },
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
  "English", "Spanish", "Mandarin", "Japanese", "Korean",
  "French", "German", "Portuguese", "Russian", "Arabic",
  "Turkish", "Vietnamese",
] as const;

const FEE_RANGES = ["$", "$$", "$$$", "$$$$"] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

interface IdentityCardProps {
  profile: ProfileRow;
  /** Primary category slug from profile_categories (loaded server-side). */
  primaryCategory: string | null;
  onProfileUpdate: (profile: ProfileRow) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IdentityCard({ profile, primaryCategory, onProfileUpdate }: IdentityCardProps) {
  // ─── Local form state ─────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [category, setCategory] = useState(primaryCategory ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? "UTC−5 · New York (EST)");
  const [feeRange, setFeeRange] = useState(profile.feeRange ?? "$$$");
  const [language, setLanguage] = useState(profile.language ?? "English");
  const [secondaryLang, setSecondaryLang] = useState(""); // Not stored in DB yet
  const [website, setWebsite] = useState(profile.website ?? "");
  const [bio, setBio] = useState(profile.bioStatement ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avatar initials
  const initials = (displayName || profile.handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ─── Avatar upload (file input trigger) ───────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("Only PNG, JPEG, or WebP files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File must be under 2MB.");
      return;
    }

    // Upload to Supabase Storage via API
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/dashboard/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Upload failed");
        return;
      }
      const { avatarUrl, profile: updated } = await res.json();
      if (updated) onProfileUpdate(updated);
    } catch {
      alert("Upload failed — please try again.");
    }
  }, [onProfileUpdate]);

  // ─── Save handler ─────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            displayName: displayName.trim(),
            timezone,
            feeRange,
            language,
            website: website.trim() || null,
            bioStatement: bio.trim() || null,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }

      const { profile: updated } = await res.json();
      if (updated) onProfileUpdate(updated);

      // Also update primary category if changed
      if (category !== primaryCategory) {
        await fetch("/api/dashboard/category", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
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
    <div className="edit-card" data-card="identity">
      <div className="edit-head">
        <div className="edit-title">IDENTITY</div>
        <button
          type="button"
          className={`edit-action${saved ? " saved" : ""}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE →"}
        </button>
      </div>

      {/* Profile URL bar */}
      <div className="profile-url-bar">
        <div className="profile-url">
          <span className="pu-base">lastproof.app/</span>
          <span className="pu-handle">@{profile.handle}</span>
        </div>
        <div className="profile-url-actions">
          <button
            type="button"
            className="change-link"
            onClick={() => alert("Handle change requires $LASTSHFT fee — coming soon")}
          >
            CHANGE
          </button>
          <a
            href={`/profile/${profile.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-mini green"
          >
            VIEW PROFILE
          </a>
        </div>
      </div>

      {/* Avatar + fields grid */}
      <div className="id-card">
        {/* Avatar column */}
        <div className="avatar-upload">
          {profile.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatarUrl}
              alt={displayName || profile.handle}
              className="id-avatar"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="id-avatar">{initials}</div>
          )}
          <button
            type="button"
            className="avatar-replace"
            onClick={() => fileInputRef.current?.click()}
          >
            UPLOAD
          </button>
          <div className="avatar-rec">
            Recommended: 1:1 ratio · PNG / JPEG · 2MB max
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Fields column — 2-col grid */}
        <div className="id-fields">
          {/* Display Name */}
          <div className="id-field">
            <span className="field-key">Display Name</span>
            <input
              className="field-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
              maxLength={30}
            />
          </div>

          {/* Primary Category */}
          <div className="id-field">
            <span className="field-key">Primary Category</span>
            <select
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— select —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Region / Timezone */}
          <div className="id-field">
            <span className="field-key">Region / Timezone</span>
            <select
              className="field-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Fee Range */}
          <div className="id-field">
            <span className="field-key">Fee Range</span>
            <select
              className="field-input"
              value={feeRange}
              onChange={(e) => setFeeRange(e.target.value)}
            >
              {FEE_RANGES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Primary Language */}
          <div className="id-field">
            <span className="field-key">Primary Language</span>
            <select
              className="field-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Secondary Language (optional) */}
          <div className="id-field">
            <span className="field-key">Secondary Language · optional</span>
            <select
              className="field-input"
              value={secondaryLang}
              onChange={(e) => setSecondaryLang(e.target.value)}
            >
              <option value="">— none —</option>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Website — full width */}
          <div className="id-field full">
            <span className="field-key">Website</span>
            <input
              className="field-input"
              type="url"
              placeholder="https://"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Short Bio — full width */}
          <div className="id-field full">
            <span className="field-key">Short Bio · {bio.length} / 160 chars</span>
            <input
              className="field-input"
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="one-liner shown on your profile header and Grid card"
            />
            <div className="field-help">
              one-liner shown on your profile header and Grid card
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
