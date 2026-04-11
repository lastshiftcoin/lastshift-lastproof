"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTickerPrice } from "@/hooks/useTickerPrice";

/**
 * Universal topbar — SHIFTBOT logo (top-left), wordmark, ticker, nav, manage CTA.
 * Present on every public page per §4.3 + §12.6 of the handoff.
 *
 * Profile routes (/profile/[handle], /@handle) render their own profile-scoped
 * header (ProfileTopBar) with SHARE / REPORT actions instead of this global one.
 */
export default function Topbar() {
  const pathname = usePathname() || "";
  const tickerPrice = useTickerPrice();
  if (pathname.startsWith("/profile/") || pathname.startsWith("/@")) return null;
  if (pathname.startsWith("/manage")) return null;
  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="topbar-logo" />
        <div>
          <div className="topbar-brand">
            <span className="last">LAST</span>
            <span className="proof">PROOF</span>
          </div>
          <div className="topbar-sub">VERIFIED OPERATORS</div>
        </div>
      </div>
      <div className="ticker">
        <span className="sym">$LASTSHFT</span>
        <span className="price">{tickerPrice.price}</span>
        {tickerPrice.change && (
          <span className={`chg ${tickerPrice.direction === "down" ? "down" : ""}`}>{tickerPrice.change}</span>
        )}
      </div>
      <div className="topbar-right">
        <div className="topbar-nav">
          <Link href="/how-it-works">HOW IT WORKS</Link>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/manage">
          MANAGE PROFILE
        </Link>
      </div>
    </div>
  );
}
