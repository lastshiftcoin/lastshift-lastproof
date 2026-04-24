"use client";

import Link from "next/link";
import { useTickerPrice } from "@/hooks/useTickerPrice";

const REPORT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

interface Props {
  handle: string;
}

/**
 * Profile-scoped top header. Replaces the global <Topbar /> on all profile
 * variants (public, 5000, free). Layout: SHIFTBOT logo + LASTPROOF wordmark
 * (left) · $LASTSHFT ticker (center) · HOW IT WORKS / REPORT (right).
 *
 * Share button moved to ProfileHero (icon-only, next to display name).
 */
export function ProfileTopBar({ handle }: Props) {
  const tickerPrice = useTickerPrice();

  return (
    <div className="pp-topbar">
      <Link
        href="/"
        className="pp-topbar-left"
        style={{ textDecoration: "none", color: "inherit" }}
        aria-label="LASTPROOF home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="pp-topbar-logo" />
        <div>
          <div className="pp-topbar-brand">
            <span className="pp-topbar-last">LAST</span>
            <span className="pp-topbar-proof">PROOF</span>
          </div>
          <div className="pp-topbar-sub">VERIFIED OPERATORS</div>
        </div>
      </Link>

      <div className="pp-topbar-ticker">
        <span className="pp-topbar-sym">$LASTSHFT</span>
        <span className="pp-topbar-price">{tickerPrice.price}</span>
        {tickerPrice.change && (
          <span className={`pp-topbar-chg${tickerPrice.direction === "down" ? " pp-topbar-chg-down" : ""}`}>{tickerPrice.change}</span>
        )}
      </div>

      <div className="pp-topbar-right">
        <a
          className="pp-topbar-btn"
          href="/how-it-works"
          target="_blank"
          rel="noreferrer"
          data-testid="pp-howitworks"
        >
          <span>HOW IT WORKS</span>
        </a>
        <a
          className="pp-topbar-btn pp-topbar-report"
          href={`mailto:reportclaims@lastshift.ai?subject=Report%20%40${encodeURIComponent(handle)}&body=Reporting%20profile%3A%20%40${encodeURIComponent(handle)}%0A%0AReason%3A%20`}
          data-testid="pp-report"
        >
          {REPORT_ICON}
          <span>REPORT</span>
        </a>
      </div>
    </div>
  );
}
