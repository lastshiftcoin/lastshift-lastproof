"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Shared 3-phase campaign counter hook.
 *
 * Used by: Popup5000, FomoCtaStrip (legend profile footer), Dashboard FOMO strip.
 *
 * Phase 1 (theatrical): Time-based decay from 5,000 over ~30 days.
 *   Each day reduces by a seeded-random amount in the 150-170 range.
 *   All visitors see the same number on the same day.
 *
 * Phase 2 (low stock): Once decay drops below 200,
 *   display cycles between 30-80 with small client-side ticks.
 *
 * Phase 3 (real check): At the 200 threshold, fetch /api/campaign/count.
 *   If real claims >= 4,900 (≤100 spots left), show 0 and mark sold out.
 */

// Campaign start date — anchor for deterministic daily decay
const CAMPAIGN_START = new Date("2026-04-10T00:00:00Z");
export const TOTAL_SPOTS = 5000;
const DAILY_DECAY_MIN = 150;
const DAILY_DECAY_MAX = 170;
const LOW_STOCK_THRESHOLD = 200;
const REAL_CUTOFF = 100; // when real claims leave ≤100 spots, show 0

/** Seeded PRNG — deterministic per day so all visitors see the same number */
function seededRandom(day: number): number {
  let x = Math.sin(day * 9301 + 49297) * 49297;
  x = x - Math.floor(x);
  return x;
}

/** Calculate theatrical spots remaining based on days since campaign start */
export function getTheatricalSpots(): number {
  const now = new Date();
  const msElapsed = now.getTime() - CAMPAIGN_START.getTime();
  const daysElapsed = Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24)));

  let remaining = TOTAL_SPOTS;
  for (let d = 0; d < daysElapsed; d++) {
    const dailyDrop =
      DAILY_DECAY_MIN +
      Math.floor(seededRandom(d) * (DAILY_DECAY_MAX - DAILY_DECAY_MIN + 1));
    remaining -= dailyDrop;
    if (remaining <= LOW_STOCK_THRESHOLD) return LOW_STOCK_THRESHOLD;
  }

  // Partial day progress — interpolate within current day's drop
  const partialDay = msElapsed / (1000 * 60 * 60 * 24) - daysElapsed;
  const todayDrop =
    DAILY_DECAY_MIN +
    Math.floor(seededRandom(daysElapsed) * (DAILY_DECAY_MAX - DAILY_DECAY_MIN + 1));
  remaining -= Math.floor(todayDrop * partialDay);

  return Math.max(LOW_STOCK_THRESHOLD, remaining);
}

/** Low-stock phase: random number between 30-80 */
function getLowStockDisplay(): number {
  return 30 + Math.floor(Math.random() * 51);
}

export interface CampaignCounterState {
  /** Current display number of spots remaining */
  spots: number;
  /** Whether all spots are gone (real check confirmed) */
  soldOut: boolean;
  /** Whether we're in the low-stock shuffle phase */
  isLowStock: boolean;
  /** Percentage of spots filled (0-100) */
  filledPct: number;
  /** Number of spots claimed (TOTAL_SPOTS - spots) */
  claimed: number;
}

/**
 * Hook that drives the 3-phase campaign counter.
 *
 * @param active - Whether the counter should be running (e.g. visible).
 *                 When false, skips API calls and tick animations.
 */
export function useCampaignCounter(active: boolean = true): CampaignCounterState {
  const theatricalBase = getTheatricalSpots();
  const isLowStock = theatricalBase <= LOW_STOCK_THRESHOLD;

  const [spots, setSpots] = useState(isLowStock ? getLowStockDisplay() : theatricalBase);
  const [soldOut, setSoldOut] = useState(false);

  // Check real Supabase count when in low-stock phase (edge-cached, 1 req/min)
  const checkReal = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign/count");
      if (!res.ok) return;
      const data = await res.json();
      const realRemaining = TOTAL_SPOTS - (data.claimed ?? 0);
      if (realRemaining <= REAL_CUTOFF) {
        setSoldOut(true);
        setSpots(0);
      }
    } catch {
      // Silently fail — keep showing theatrical numbers
    }
  }, []);

  useEffect(() => {
    if (!active || !isLowStock) return;
    checkReal();
  }, [active, isLowStock, checkReal]);

  // Client-side tick animation
  useEffect(() => {
    if (!active || soldOut) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (isLowStock) {
        setSpots(getLowStockDisplay());
      } else {
        setSpots((s) => Math.max(LOW_STOCK_THRESHOLD, s - 1));
      }
      const delay = isLowStock
        ? 3000 + Math.random() * 4000
        : 4000 + Math.random() * 5000;
      window.setTimeout(tick, delay);
    };

    const initial = window.setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
    };
  }, [active, soldOut, isLowStock]);

  const filledPct = ((TOTAL_SPOTS - spots) / TOTAL_SPOTS) * 100;

  return {
    spots,
    soldOut,
    isLowStock,
    filledPct,
    claimed: TOTAL_SPOTS - spots,
  };
}
