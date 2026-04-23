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

import { useState, useCallback, useRef, useEffect } from "react";
import type { ProfileRow } from "@/lib/profiles-store";
import { HandleChangeModal } from "@/components/handle-change-modal/HandleChangeModal";
import { useDebugLog } from "@/lib/debug/useDebugLog";

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
  "UTC−12",
  "UTC−11",
  "UTC−10",
  "UTC−9",
  "UTC−8",
  "UTC−7",
  "UTC−6",
  "UTC−5",
  "UTC−4",
  "UTC−3",
  "UTC−2",
  "UTC−1",
  "UTC+0",
  "UTC+1",
  "UTC+2",
  "UTC+3",
  "UTC+4",
  "UTC+5",
  "UTC+5:30",
  "UTC+6",
  "UTC+7",
  "UTC+8",
  "UTC+9",
  "UTC+10",
  "UTC+11",
  "UTC+12",
] as const;

const LANGUAGES = [
  "English", "Spanish", "Mandarin", "Japanese", "Korean",
  "French", "German", "Portuguese", "Russian", "Arabic",
  "Turkish", "Vietnamese", "Tagalog", "Hindi", "Indonesian",
  "Thai",
] as const;

const FEE_RANGES = ["$", "$$", "$$$", "$$$$"] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

interface IdentityCardProps {
  profile: ProfileRow;
  /** Primary category slug from profile_categories (loaded server-side). */
  primaryCategory: string | null;
  onProfileUpdate: (profile: ProfileRow) => void;
  /** When true, auto-open the handle change modal (triggered externally). */
  handleChangeRequested?: boolean;
  /** Called after the modal opens so parent can reset the flag. */
  onHandleChangeAck?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IdentityCard({ profile, primaryCategory, onProfileUpdate, handleChangeRequested, onHandleChangeAck }: IdentityCardProps) {
  // ─── Local form state ─────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [category, setCategory] = useState(primaryCategory ?? "");
  const [timezone, setTimezone] = useState(() => {
    const raw = profile.timezone ?? "UTC−5";
    return raw.includes(" · ") ? raw.split(" · ")[0] : raw;
  });
  const [feeRange, setFeeRange] = useState(profile.feeRange ?? "$$$");
  const [language, setLanguage] = useState(profile.language ?? "English");
  const [secondaryLang, setSecondaryLang] = useState(profile.secondaryLanguage ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [bio, setBio] = useState(profile.bioStatement ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debug = useDebugLog();

  // ─── Handle change modal state ──────────────────────────────────────────
  const [showHandleModal, setShowHandleModal] = useState(false);

  // External trigger from standalone URL bar
  useEffect(() => {
    if (handleChangeRequested) {
      setShowHandleModal(true);
      onHandleChangeAck?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleChangeRequested]);

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

  // ─── Handle change helpers ────────────────────────────────────────────────

  // ─── Save handler ─────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    const fieldKeys = ["displayName", "timezone", "feeRange", "language", "secondaryLanguage", "website", "bioStatement"];
    debug.log("proof_flow", "dashboard_identity_save", { fields: fieldKeys, categoryChanged: category !== primaryCategory });
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
            secondaryLanguage: secondaryLang.trim() || null,
            website: website.trim() || null,
            bioStatement: bio.trim() || null,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        debug.log("error", "dashboard_identity_save_failed", { status: res.status, error: data.error });
        alert(data.error || "Save failed");
        return;
      }

      const { profile: updated } = await res.json();
      if (updated) onProfileUpdate(updated);

      // Also update primary category if changed
      if (category !== primaryCategory) {
        const catRes = await fetch("/api/dashboard/category", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
        if (!catRes.ok) {
          const catData = await catRes.json().catch(() => ({}));
          debug.log("error", "dashboard_identity_category_failed", { status: catRes.status, error: catData.error, category });
        } else {
          debug.log("proof_flow", "dashboard_identity_category_ok", { category });
        }
      }

      debug.log("proof_flow", "dashboard_identity_save_ok", { fields: fieldKeys });
      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      debug.log("error", "dashboard_identity_save_network_error", { error: String(err) });
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

      <HandleChangeModal
        open={showHandleModal}
        onClose={() => setShowHandleModal(false)}
        oldHandle={profile.handle}
        onSuccess={() => setShowHandleModal(false)}
      />
    </div>
  );
}
