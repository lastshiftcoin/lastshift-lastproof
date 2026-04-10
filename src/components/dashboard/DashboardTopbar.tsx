"use client";

/**
 * Dashboard topbar — brand + ticker + wallet pill.
 * Wireframe: lastproof-dashboard.html `.topbar`
 *
 * Wallet pill shows truncated address, green dot. On hover, text
 * swaps to "DISCONNECT" and turns red (CSS-driven via ::before content swap).
 */

import type { Session } from "@/lib/session";

export function DashboardTopbar({ session }: { session: Session }) {
  const short = session.walletAddress.slice(0, 4) + "..." + session.walletAddress.slice(-4);

  async function handleDisconnect() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/manage";
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="brand-logo" />
          <span className="brand-name">
            <span className="last">LAST</span>
            <span className="proof">PROOF</span>
          </span>
          <span className="brand-tag">V1.0</span>
        </div>
      </div>

      <div className="ticker">
        <span className="ticker-symbol">$LASTSHFT</span>
        <span className="ticker-price">$0.0428</span>
        <span className="ticker-change">+12.4%</span>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="wallet-pill"
          onClick={handleDisconnect}
          title="Click to disconnect"
        >
          <span className="wp-dot" />
          <span className="wp-label" data-addr={short} />
        </button>
      </div>
    </div>
  );
}
