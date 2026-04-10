"use client";

/**
 * TrustTierRow — visual tier progress card + 4-step ladder.
 *
 * Wireframe: lastproof-dashboard.html `.tier-row-card`
 *
 * Shows:
 *   - Current tier badge (TIER N · NAME) in large text
 *   - Progress bar toward next tier
 *   - "X more proofs to reach TIER N+1"
 *   - 4-step ladder showing all tiers with thresholds + perks
 *
 * Uses computeTier + formatTierLabel from lib/tier.ts.
 * Read-only — no save action.
 */

import type { ProfileRow } from "@/lib/profiles-store";
import {
  computeTier,
  formatTierLabel,
  TIER_THRESHOLDS,
  type Tier,
} from "@/lib/tier";

interface TrustTierRowProps {
  profile: ProfileRow;
  totalProofs: number;
}

// Tier colors for the tier-step border highlight
const TIER_COLORS: Record<number, string> = {
  1: "rgba(156,163,175,0.6)",  // silver
  2: "rgba(205,127,50,0.6)",   // bronze
  3: "rgba(255,215,0,0.6)",    // gold
  4: "rgba(167,139,250,0.6)",  // purple
};

const TIER_STEPS = [
  { tier: 1 as Tier, name: "TIER 1 · NEW", thresh: "0 PROOFS", perks: "Profile listed in grid", cls: "t1" },
  { tier: 2 as Tier, name: "TIER 2 · VERIFIED", thresh: "10 PROOFS", perks: "Standard grid placement", cls: "t2" },
  { tier: 3 as Tier, name: "TIER 3 · EXPERIENCED", thresh: "25 PROOFS", perks: "Boosted grid visibility · SHIFTBOT considers for recommendations", cls: "t3" },
  { tier: 4 as Tier, name: "TIER 4 · LEGEND", thresh: "50 PROOFS", perks: "Top-of-grid placement · SHIFTBOT prioritizes in recommendations", cls: "t4" },
] as const;

function getNextTierInfo(currentTier: Tier, totalProofs: number) {
  if (currentTier === 5) {
    // Not on the ladder — show path to Tier 1
    return { nextLabel: "TIER 1 · NEW", proofsNeeded: 0, nextThreshold: 0, progressPct: 0 };
  }
  if (currentTier === 4) {
    // Already at max
    return { nextLabel: null, proofsNeeded: 0, nextThreshold: TIER_THRESHOLDS.legendProofs, progressPct: 100 };
  }

  const thresholds: Record<number, { next: number; label: string }> = {
    1: { next: TIER_THRESHOLDS.verifiedProofs, label: "TIER 2 · VERIFIED" },
    2: { next: TIER_THRESHOLDS.experiencedProofs, label: "TIER 3 · EXPERIENCED" },
    3: { next: TIER_THRESHOLDS.legendProofs, label: "TIER 4 · LEGEND" },
  };

  const info = thresholds[currentTier];
  const proofsNeeded = Math.max(0, info.next - totalProofs);

  // Progress from current tier threshold to next
  const currentThreshold = currentTier === 1 ? 0 : currentTier === 2 ? 10 : 25;
  const range = info.next - currentThreshold;
  const progress = totalProofs - currentThreshold;
  const progressPct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 0;

  return {
    nextLabel: info.label,
    proofsNeeded,
    nextThreshold: info.next,
    progressPct,
  };
}

export function TrustTierRow({ profile, totalProofs }: TrustTierRowProps) {
  const tier = computeTier({
    isPaid: profile.isPaid,
    isPublished: !!profile.publishedAt,
    proofsConfirmed: totalProofs,
  });

  const tierLabel = formatTierLabel(tier);
  const { nextLabel, proofsNeeded, nextThreshold, progressPct } = getNextTierInfo(tier, totalProofs);

  // If tier is 5 (unlisted), show a muted version prompting to publish/pay
  if (tier === 5) {
    return (
      <div className="tier-row-card" style={{ opacity: 0.5, borderColor: "var(--border)" }}>
        <div className="tier-row-grid">
          <div className="tier-left">
            <div className="tier-key">Trust Tier</div>
            <div className="tier-badge-xl" style={{ color: "var(--text-dim)", fontSize: 28, textShadow: "none" }}>
              UNLISTED
            </div>
            <div className="tier-cta-line">
              <span className="dim">Publish your profile to join the tier ladder</span>
            </div>
          </div>
          <div className="tier-mid">
            <div className="tier-mid-top">
              <span className="pct"><span className="accent">0</span> / {TIER_THRESHOLDS.verifiedProofs} PROOFS</span>
              <span className="next">NEXT: TIER 1 · NEW</span>
            </div>
            <div className="tier-prog">
              <div className="tier-prog-fill" style={{ width: "0%" }} />
            </div>
          </div>
        </div>
        <div className="tier-ladder">
          {TIER_STEPS.map((s) => (
            <div key={s.tier} className={`tier-step ${s.cls}`}>
              <div className="ts-name">{s.name}</div>
              <div className="ts-thresh">{s.thresh}</div>
              <div className="ts-perks">{s.perks}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tier-row-card">
      <div className="tier-row-grid">
        <div className="tier-left">
          <div className="tier-key">Trust Tier</div>
          <div className="tier-badge-xl">{tierLabel}</div>
          <div className="tier-cta-line">
            {nextLabel ? (
              <>
                <span className="accent">+{proofsNeeded} MORE PROOFS</span>{" "}
                <span className="dim">to reach {nextLabel}</span>
              </>
            ) : (
              <span className="accent">MAX TIER REACHED</span>
            )}
          </div>
        </div>
        <div className="tier-mid">
          <div className="tier-mid-top">
            <span className="pct">
              <span className="accent">{totalProofs}</span> / {nextThreshold} PROOFS
            </span>
            {nextLabel && <span className="next">NEXT: {nextLabel}</span>}
          </div>
          <div className="tier-prog">
            <div className="tier-prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="tier-ladder">
        {TIER_STEPS.map((s) => (
          <div
            key={s.tier}
            className={`tier-step ${s.cls}${s.tier === tier ? " current" : ""}`}
          >
            <div className="ts-name">{s.name}</div>
            <div className="ts-thresh">{s.thresh}</div>
            <div className="ts-perks">{s.perks}</div>
            {s.tier === tier && <div className="ts-current-tag">YOU ARE HERE</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
