"use client";

import type { TickerProof } from "@/lib/grid/recent-proofs";

/**
 * Slim 32px proof scroller pinned at the top of /operators (under the
 * marketing topbar). Static-per-pageload — no polling. SSR fetches the
 * last 20 confirmed proofs via getRecentProofs() and embeds them here.
 *
 * The track is duplicated so the CSS animation can scroll forever without
 * a visible "jump" when the cycle resets.
 */
export default function LiveTicker({ proofs }: { proofs: TickerProof[] }) {
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

function TickerItem({ p }: { p: TickerProof }) {
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
