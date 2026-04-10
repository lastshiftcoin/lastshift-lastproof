"use client";

/**
 * StatQuad — the four stat boxes at the top of the dashboard.
 *
 * Wireframe: lastproof-dashboard.html `.stat-trio` (it's a quad despite the name)
 *
 * Boxes:
 *   1. Profile Views — reads from profile stats (TODO: real analytics)
 *   2. Total Proofs  — confirmed proof count
 *   3. Dev Proofs    — proofs from verified devs, with DEV badge
 *   4. $LASTSHFT Wallet — token balance + USD value + BUY button
 *
 * All values are read-only. For new profiles, everything starts at 0.
 */

import type { ProfileRow } from "@/lib/profiles-store";

interface StatQuadProps {
  profile: ProfileRow;
  /** Total confirmed proofs. Passed in by parent (fetched server-side). */
  totalProofs: number;
  /** Proofs from verified devs. */
  devProofs: number;
}

export function StatQuad({ profile, totalProofs, devProofs }: StatQuadProps) {
  // For now, views and wallet are static/placeholder.
  // These will be wired to real data in Step 13.
  const views = 0;
  const viewsSub = totalProofs > 0 ? "LAST 30D" : "PROFILE LIVE";

  const proofsSub = totalProofs > 0
    ? `+${Math.min(totalProofs, 3)} THIS WEEK`
    : "MINT YOUR FIRST PROOF";

  const devSub = "FROM VERIFIED PROJECT DEVS";

  // Wallet is always placeholder until token integration
  const walletBalance = "0 LASTSHFT";
  const walletUsd = "$0.00";

  const dimmed = totalProofs === 0;

  return (
    <div className="stat-trio">
      {/* Profile Views */}
      <div className="stat-box">
        <div className="stat-key">Profile Views</div>
        <div className="stat-val" style={dimmed ? { opacity: 0.4 } : undefined}>
          {views}
        </div>
        <div className="stat-sub">{viewsSub}</div>
      </div>

      {/* Total Proofs */}
      <div className="stat-box">
        <div className="stat-key">Total Proofs</div>
        <div className="stat-val" style={dimmed ? { opacity: 0.4 } : undefined}>
          {totalProofs}
        </div>
        <div className="stat-sub">{proofsSub}</div>
      </div>

      {/* Dev Proofs */}
      <div className="stat-box dev">
        <div className="stat-key">Dev Proofs</div>
        <div className="stat-val" style={dimmed ? { opacity: 0.4 } : undefined}>
          {devProofs}
          <span className="dev-icon">DEV</span>
        </div>
        <div className="stat-sub">{devSub}</div>
      </div>

      {/* $LASTSHFT Wallet */}
      <div className="stat-box wallet">
        <div className="stat-key">$LASTSHFT Wallet</div>
        <div className="stat-val" style={dimmed ? { opacity: 0.4 } : undefined}>
          {walletBalance}
        </div>
        <div className="stat-sub">{walletUsd}</div>
        <a
          href="https://lastshiftcoin.com"
          target="_blank"
          rel="noopener noreferrer"
          className="buy-btn"
        >
          BUY $LASTSHFT
        </a>
      </div>
    </div>
  );
}
