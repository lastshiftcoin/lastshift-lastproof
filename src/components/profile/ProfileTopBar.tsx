"use client";

import { useState } from "react";

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const REPORT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Props {
  handle: string;
}

/**
 * Profile-scoped top header. Replaces the global <Topbar /> on all profile
 * variants (public, 5000, free). Layout: SHIFTBOT logo + LASTPROOF wordmark
 * (left) · $LASTSHFT ticker (center) · SHARE / REPORT (right).
 */
export function ProfileTopBar({ handle }: Props) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://lastproof.app/profile/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch {}
      document.body.removeChild(ta);
    }
  };

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
        <span className="pp-topbar-price">$0.00012</span>
        <span className="pp-topbar-chg">-2.7%</span>
      </div>

      <div className="pp-topbar-right">
        <button
          type="button"
          className="pp-topbar-btn"
          onClick={onShare}
          data-testid="pp-share"
          aria-label="Copy profile link"
        >
          {copied ? CHECK_ICON : SHARE_ICON}
          <span>{copied ? "LINK COPIED" : "SHARE"}</span>
        </button>
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
