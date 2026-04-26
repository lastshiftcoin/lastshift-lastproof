"use client";

/**
 * ChadManagementStrip — dashboard summary card. Self-fetches counts
 * via /api/chads/counts so we don't have to drill props through
 * DashboardShell + DashboardContent.
 *
 * Two render variants:
 *   PREMIUM (active operator)  — pending count + army count + MANAGE → pill
 *   LOCKED  (free operator, tier 5) — PREMIUM-only notice + UPGRADE PROFILE pill
 *
 * When the feature flag is off, /api/chads/counts returns 404 → strip
 * renders null. When the flag is on but the session has no profile,
 * returns 401 → strip also renders null (the user is on /manage anyway).
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface CountsResponse {
  ok: boolean;
  pendingCount: number;
  armyCount: number;
  tier: number;
}

export function ChadManagementStrip() {
  const [data, setData] = useState<CountsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chads/counts");
        if (cancelled) return;
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const body = (await res.json()) as CountsResponse;
        if (!cancelled) {
          setData(body);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !data) return null;

  const isLocked = data.tier === 5;

  if (isLocked) {
    return (
      <section className="edit-card chad-mgmt chad-mgmt-locked">
        <h2 className="chad-mgmt-title chad-mgmt-title-locked">
          <span className="slash">//</span>CHAD MANAGEMENT
        </h2>
        <div className="chad-mgmt-row">
          <div className="chad-mgmt-locked-notice">
            <span className="chad-mgmt-warn-glyph">⚠</span> PREMIUM FEATURE ONLY
          </div>
          <Link href="/manage" className="chad-mgmt-cta chad-mgmt-cta-upgrade">
            UPGRADE PROFILE
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="edit-card chad-mgmt">
      <h2 className="chad-mgmt-title">
        <span className="slash">//</span>CHAD MANAGEMENT
      </h2>
      <div className="chad-mgmt-row">
        <div className="chad-mgmt-counts">
          <div className="chad-mgmt-count">
            <span className="chad-mgmt-label">Pending Asks</span>
            <span className="chad-mgmt-value chad-mgmt-pending">{data.pendingCount}</span>
          </div>
          <div className="chad-mgmt-count">
            <span className="chad-mgmt-label">Your Chad Army</span>
            <span className="chad-mgmt-value">{data.armyCount}</span>
          </div>
        </div>
        <Link href="/manage/chads" className="chad-mgmt-cta">
          MANAGE →
        </Link>
      </div>
    </section>
  );
}
