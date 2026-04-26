"use client";

import type { MockTickerProof } from "@/lib/mock/grid-mock";

/**
 * Slim 32px proof scroller pinned at the top of /operators (under the
 * marketing topbar). Static-per-pageload — no polling. Stage 2 will swap
 * the mock array for `getRecentProofs(20)` server-rendered into the page.
 *
 * The track is duplicated so the CSS animation can scroll forever without
 * a visible "jump" when the cycle resets.
 */
export default function LiveTicker({ proofs }: { proofs: MockTickerProof[] }) {
  return (
    <div className="g-ticker">
      <span className="live-label">
        <span className="pulse" />
        LIVE
      </span>
      <div className="track-wrap">
        <div className="track">
          {proofs.map((p, i) => (
            <TickerItem key={`a-${i}`} p={p} />
          ))}
          {/* Duplicated track for seamless loop */}
          {proofs.map((p, i) => (
            <TickerItem key={`b-${i}`} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerItem({ p }: { p: MockTickerProof }) {
  return (
    <span className="item">
      <span className="t-wallet">{p.shortWallet}</span>
      <span className="t-proof">proof</span>
      <span className="t-op">{p.operatorHandle}</span>
      <span>on</span>
      <span className="t-ticker">{p.projectTicker}</span>
      {p.isDev && <span className="t-dev">DEV</span>}
      <span className="t-time">{p.timeAgo}</span>
    </span>
  );
}
