"use client";

import { useState } from "react";
import type { GridFilters, GridTier, GridFee } from "@/lib/grid/grid-view";
import { LANGUAGES, TIMEZONES } from "@/lib/grid/options";

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
  /** When true, every interactive control is disabled. Section
   *  collapse/expand stays live since it's not a filter action. */
  locked?: boolean;
}

const PROOF_BUCKETS = [0, 10, 25, 50, 100];

export default function FilterSections({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
  return (
    <>
      <TierSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <VerifiedSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <DevProofsSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <MinProofsSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <FeeSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <LanguageSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
      <TimezoneSection filters={filters} onUpdateFilter={onUpdateFilter} locked={locked} />
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

function TierSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
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
          disabled={locked}
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

function VerifiedSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
  const suffix = <span className="g-check-inline" />;
  return (
    <Section title="Verified" titleSuffix={suffix}>
      <button
        type="button"
        className={`g-toggle-row${filters.onlyVerified ? " on" : ""}`}
        onClick={() => onUpdateFilter({ onlyVerified: !filters.onlyVerified })}
        disabled={locked}
      >
        <span className="g-switch" />
        <span className="check-hint">Only verified operators (✓)</span>
      </button>
    </Section>
  );
}

/* ─── 3. DEV Proofs ───────────────────────────────────────────── */

function DevProofsSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
  return (
    <Section title="DEV Proofs">
      <button
        type="button"
        className={`g-toggle-row${filters.onlyDevProofs ? " on" : ""}`}
        onClick={() =>
          onUpdateFilter({ onlyDevProofs: !filters.onlyDevProofs })
        }
        disabled={locked}
      >
        <span className="g-switch" />
        <span className="check-hint">Only operators with DEV proofs</span>
      </button>
    </Section>
  );
}

/* ─── 4. # of Proofs ──────────────────────────────────────────── */

function MinProofsSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
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
              onClick={() => {
                if (locked) return;
                onUpdateFilter({ minProofs: b });
              }}
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-disabled={locked || undefined}
              onKeyDown={(e) => {
                if (locked) return;
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

function FeeSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
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
          disabled={locked}
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

function LanguageSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
  function toggle(name: string) {
    const next = filters.languages.includes(name)
      ? filters.languages.filter((l) => l !== name)
      : [...filters.languages, name];
    onUpdateFilter({ languages: next });
  }
  return (
    <Section title="Language">
      {LANGUAGES.map((name) => (
        <button
          type="button"
          key={name}
          className={`g-fopt${filters.languages.includes(name) ? " checked" : ""}`}
          onClick={() => toggle(name)}
          disabled={locked}
        >
          <span className="cb" />
          <span className="label">{name}</span>
          <span />
        </button>
      ))}
    </Section>
  );
}

/* ─── 7. Timezone ─────────────────────────────────────────────── */

function TimezoneSection({ filters, onUpdateFilter, locked = false }: FilterSectionsProps) {
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
          disabled={locked}
        >
          <span className="cb" />
          <span className="label">{tz}</span>
          <span />
        </button>
      ))}
    </Section>
  );
}
