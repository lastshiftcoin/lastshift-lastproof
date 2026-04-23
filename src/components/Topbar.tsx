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
 *
 * Styled to match ProfileTopBar (pp-topbar) for visual consistency.
 */
export default function Topbar() {
  const pathname = usePathname() || "";
  const tickerPrice = useTickerPrice();
  if (pathname.startsWith("/profile/") || pathname.startsWith("/@")) return null;
  if (pathname.startsWith("/manage")) return null;
  return (
    <div className="pp-topbar">
      <Link href="/" className="pp-topbar-left" style={{ textDecoration: "none" }}>
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
        <Link href="/how-it-works" className="pp-topbar-btn">
          <span>HOW IT WORKS</span>
        </Link>
        <Link href="/manage" className="pp-topbar-btn">
          <span>MANAGE PROFILE</span>
        </Link>
      </div>
    </div>
  );
}
