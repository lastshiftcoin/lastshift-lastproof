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
 */

import { useState, useEffect } from "react";
import type { ProfileRow } from "@/lib/profiles-store";
import { useTickerPrice } from "@/hooks/useTickerPrice";

interface StatQuadProps {
  profile: ProfileRow;
  /** Total confirmed proofs. Passed in by parent (fetched server-side). */
  totalProofs: number;
  /** Proofs from verified devs. */
  devProofs: number;
}

export function StatQuad({ profile, totalProofs, devProofs }: StatQuadProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const ticker = useTickerPrice();

  useEffect(() => {
    let mounted = true;
    async function fetchBalance() {
      try {
        const res = await fetch("/api/token/balance");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setBalance(data.balance ?? 0);
      } catch {
        // keep null → shows "—"
      }
    }
    fetchBalance();
    return () => { mounted = false; };
  }, []);

  const views = profile.viewCount ?? 0;
  const viewsSub = totalProofs > 0 ? "LAST 30D" : "PROFILE LIVE";

  const proofsSub = totalProofs > 0
    ? `+${Math.min(totalProofs, 3)} THIS WEEK`
    : "MINT YOUR FIRST PROOF";

  const devSub = "FROM VERIFIED PROJECT DEVS";

  // Wallet display
  const walletBalance = balance !== null
    ? `${balance.toLocaleString("en-US", { maximumFractionDigits: 0 })} LASTSHFT`
    : "— LASTSHFT";

  // Parse price from ticker for USD calc
  const priceNum = parseFloat(ticker.price.replace("$", "").replace("…", "0"));
  const walletUsd = balance !== null && priceNum > 0
    ? `$${(balance * priceNum).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  return (
    <div className="stat-trio">
      {/* Profile Views */}
      <div className="stat-box">
        <div className="stat-key">Profile Views</div>
        <div className="stat-val">
          {views}
        </div>
        <div className="stat-sub">{viewsSub}</div>
      </div>

      {/* Total Proofs */}
      <div className="stat-box">
        <div className="stat-key">Total Proofs</div>
        <div className="stat-val">
          {totalProofs}
        </div>
        <div className="stat-sub">{proofsSub}</div>
      </div>

      {/* Dev Proofs */}
      <div className="stat-box dev">
        <div className="stat-key">Dev Proofs</div>
        <div className="stat-val">
          {devProofs}
          <span className="dev-icon">DEV</span>
        </div>
        <div className="stat-sub">{devSub}</div>
      </div>

      {/* $LASTSHFT Wallet */}
      <div className="stat-box wallet">
        <div className="stat-key">$LASTSHFT Wallet</div>
        <div className="stat-val">
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
