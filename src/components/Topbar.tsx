import Link from "next/link";

/**
 * Universal topbar — SHIFTBOT logo (top-left), wordmark, ticker, nav, manage CTA.
 * Present on every public page per §4.3 + §12.6 of the handoff.
 */
export default function Topbar() {
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
        <span className="price">$0.00012</span>
        <span className="chg down">-2.7%</span>
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
