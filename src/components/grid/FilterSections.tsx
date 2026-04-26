"use client";

import { useState } from "react";
import type { GridFilters, GridTier, GridFee } from "@/lib/grid/grid-view";

/**
 * Shared filter UI rendered inside both the desktop sidebar and the
 * mobile drawer. Order is locked per Kellen's override:
 *   1. Tier
 *   2. Verified
 *   3. DEV Proofs
 *   4. # of Proofs
 *   5. Fee
 *   6. Language
 *   7. Timezone
 *
 * Default expand state: Tier + Fee open, others collapsed.
 */

export interface FilterSectionsProps {
  filters: GridFilters;
  onUpdateFilter: (patch: Partial<GridFilters>) => void;
}

const PROOF_BUCKETS = [0, 10, 25, 50, 100];
const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "ES", label: "Spanish" },
  { code: "JP", label: "Japanese" },
  { code: "DE", label: "German" },
  { code: "TR", label: "Turkish" },
  { code: "PT", label: "Portuguese" },
];
const TIMEZONES = [
  "UTC-8",
  "UTC-5",
  "UTC-4",
  "UTC-3",
  "UTC+0",
  "UTC+1",
  "UTC+2",
  "UTC+8",
  "UTC+9",
];

export default function FilterSections({ filters, onUpdateFilter }: FilterSectionsProps) {
  return (
    <>
      <TierSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <VerifiedSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <DevProofsSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <MinProofsSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <FeeSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <LanguageSection filters={filters} onUpdateFilter={onUpdateFilter} />
      <TimezoneSection filters={filters} onUpdateFilter={onUpdateFilter} />
    </>
  );
}

/* ─── Section wrapper ──────────────────────────────────────────── */

function Section({
  title,
  defaultOpen = false,
  titleSuffix,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  titleSuffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`g-fsec${open ? " open" : ""}`}>
      <div
        className="g-fsec-head"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span>
          {title}
          {titleSuffix}
        </span>
        <span className="caret">{open ? "−" : "+"}</span>
      </div>
      <div className="g-fsec-body">
        <div className="g-fsec-body-inner">{children}</div>
      </div>
    </div>
  );
}

/* ─── 1. Tier ─────────────────────────────────────────────────── */

const TIER_OPTIONS: Array<{ tier: GridTier; label: string; color: string }> = [
  { tier: 4, label: "TIER 4 · LEGEND", color: "var(--purple)" },
  { tier: 3, label: "TIER 3 · EXPERIENCED", color: "var(--gold)" },
  { tier: 2, label: "TIER 2 · VERIFIED", color: "var(--bronze)" },
  { tier: 1, label: "TIER 1 · NEW", color: "var(--silver)" },
];

function TierSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  function toggle(tier: GridTier) {
    const next = filters.tiers.includes(tier)
      ? filters.tiers.filter((t) => t !== tier)
      : [...filters.tiers, tier];
    onUpdateFilter({ tiers: next });
  }
  return (
    <Section title="Tier" defaultOpen>
      {TIER_OPTIONS.map((o) => (
        <button
          type="button"
          key={o.tier}
          className={`g-fopt${filters.tiers.includes(o.tier) ? " checked" : ""}`}
          onClick={() => toggle(o.tier)}
        >
          <span className="cb" />
          <span className="label">
            <span className="tdot" style={{ background: o.color }} />
            {o.label}
          </span>
          <span />
        </button>
      ))}
    </Section>
  );
}

/* ─── 2. Verified ─────────────────────────────────────────────── */

function VerifiedSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  const suffix = <span className="g-check-inline" />;
  return (
    <Section title="Verified" titleSuffix={suffix}>
      <button
        type="button"
        className={`g-toggle-row${filters.onlyVerified ? " on" : ""}`}
        onClick={() => onUpdateFilter({ onlyVerified: !filters.onlyVerified })}
      >
        <span className="g-switch" />
        <span className="check-hint">Only verified operators (✓)</span>
      </button>
    </Section>
  );
}

/* ─── 3. DEV Proofs ───────────────────────────────────────────── */

function DevProofsSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  return (
    <Section title="DEV Proofs">
      <button
        type="button"
        className={`g-toggle-row${filters.onlyDevProofs ? " on" : ""}`}
        onClick={() =>
          onUpdateFilter({ onlyDevProofs: !filters.onlyDevProofs })
        }
      >
        <span className="g-switch" />
        <span className="check-hint">Only operators with DEV proofs</span>
      </button>
    </Section>
  );
}

/* ─── 4. # of Proofs ──────────────────────────────────────────── */

function MinProofsSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  // Visual position of the thumb on the slider track (0-100%)
  const idx = PROOF_BUCKETS.indexOf(filters.minProofs);
  const thumbPct = idx >= 0
    ? (idx / (PROOF_BUCKETS.length - 1)) * 100
    : 0;

  return (
    <Section title="# of Proofs">
      <div className="g-slider">
        <div className="track">
          <div className="fill" style={{ width: `${thumbPct}%` }} />
          <div className="thumb" style={{ left: `${thumbPct}%` }} />
        </div>
        <div className="scale">
          {PROOF_BUCKETS.map((b) => (
            <span
              key={b}
              className={filters.minProofs === b ? "active" : ""}
              onClick={() => onUpdateFilter({ minProofs: b })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onUpdateFilter({ minProofs: b });
                }
              }}
            >
              {b === 100 ? "100+" : b}
            </span>
          ))}
        </div>
        <div className="caption">
          Operators with <b>{filters.minProofs}+</b> proofs
        </div>
      </div>
    </Section>
  );
}

/* ─── 5. Fee ─────────────────────────────────────────────────── */

const FEE_OPTIONS: GridFee[] = ["$", "$$", "$$$", "$$$$"];

function FeeSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  function toggle(fee: GridFee) {
    const next = filters.fees.includes(fee)
      ? filters.fees.filter((f) => f !== fee)
      : [...filters.fees, fee];
    onUpdateFilter({ fees: next });
  }
  return (
    <Section title="Fee" defaultOpen>
      {FEE_OPTIONS.map((fee) => (
        <button
          type="button"
          key={fee}
          className={`g-fopt${filters.fees.includes(fee) ? " checked" : ""}`}
          onClick={() => toggle(fee)}
        >
          <span className="cb" />
          <span className="label">
            <span className="fee-glyph">{fee}</span>
          </span>
          <span />
        </button>
      ))}
    </Section>
  );
}

/* ─── 6. Language ─────────────────────────────────────────────── */

function LanguageSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  function toggle(code: string) {
    const next = filters.languages.includes(code)
      ? filters.languages.filter((l) => l !== code)
      : [...filters.languages, code];
    onUpdateFilter({ languages: next });
  }
  return (
    <Section title="Language">
      {LANGUAGES.map((l) => (
        <button
          type="button"
          key={l.code}
          className={`g-fopt${filters.languages.includes(l.code) ? " checked" : ""}`}
          onClick={() => toggle(l.code)}
        >
          <span className="cb" />
          <span className="label">{l.label}</span>
          <span />
        </button>
      ))}
      <button type="button" className="g-more-link">
        + More languages
      </button>
    </Section>
  );
}

/* ─── 7. Timezone ─────────────────────────────────────────────── */

function TimezoneSection({ filters, onUpdateFilter }: FilterSectionsProps) {
  function toggle(tz: string) {
    const next = filters.timezones.includes(tz)
      ? filters.timezones.filter((t) => t !== tz)
      : [...filters.timezones, tz];
    onUpdateFilter({ timezones: next });
  }
  return (
    <Section title="Timezone">
      {TIMEZONES.map((tz) => (
        <button
          type="button"
          key={tz}
          className={`g-fopt${filters.timezones.includes(tz) ? " checked" : ""}`}
          onClick={() => toggle(tz)}
        >
          <span className="cb" />
          <span className="label">{tz}</span>
          <span />
        </button>
      ))}
      <button type="button" className="g-more-link">
        + More timezones
      </button>
    </Section>
  );
}
