"use client";

/**
 * Dashboard topbar — brand + ticker + wallet pill.
 * Styled to match ProfileTopBar (pp-topbar) for visual consistency.
 *
 * Wallet pill shows truncated address, green dot. On hover, text
 * swaps to "DISCONNECT" and turns red (CSS-driven via ::before content swap).
 */

import type { Session } from "@/lib/session";
import { useTickerPrice } from "@/hooks/useTickerPrice";

export function DashboardTopbar({ session }: { session: Session }) {
  const short = session.walletAddress.slice(0, 4) + "..." + session.walletAddress.slice(-4);
  const tickerPrice = useTickerPrice();

  async function handleDisconnect() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/manage";
  }

  return (
    <div className="pp-topbar">
      <div className="pp-topbar-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="pp-topbar-logo" />
        <div>
          <div className="pp-topbar-brand">
            <span className="pp-topbar-last">LAST</span>
            <span className="pp-topbar-proof">PROOF</span>
          </div>
          <div className="pp-topbar-sub">VERIFIED OPERATORS</div>
        </div>
      </div>

      <div className="pp-topbar-ticker">
        <span className="pp-topbar-sym">$LASTSHFT</span>
        <span className="pp-topbar-price">{tickerPrice.price}</span>
        {tickerPrice.change && (
          <span className={`pp-topbar-chg${tickerPrice.direction === "down" ? " pp-topbar-chg-down" : ""}`}>{tickerPrice.change}</span>
        )}
      </div>

      <div className="pp-topbar-right">
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
