"use client";

import { useState } from "react";
import type { ProofRow } from "@/lib/public-profile-view";

const INITIAL_LIMIT = 10;

const EXT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export function ProofsTable({
  proofs,
  totalProofs,
}: {
  proofs: ProofRow[];
  totalProofs: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? proofs : proofs.slice(0, INITIAL_LIMIT);
  const hasMore = proofs.length > INITIAL_LIMIT && !expanded;

  return (
    <div className="pp-proofs-table">
      <div className="pp-pf-row pp-head">
        <div>WALLET</div>
        <div>TICKER</div>
        <div>DATE</div>
        <div>COMMENT</div>
        <div>TX</div>
      </div>
      {visible.map((p) => (
        <div key={p.id} className="pp-pf-row">
          <div className="pp-pf-wallet">
            {p.shortWallet}
            {p.isDev && <span className="pp-dev-mini">DEV</span>}
          </div>
          <div className="pp-pf-ticker">{p.ticker}</div>
          <div className="pp-pf-date">{p.date}</div>
          <div className={`pp-pf-comment${p.comment ? "" : " pp-empty"}`}>
            {p.comment ? `"${p.comment}"` : "— NO COMMENT —"}
          </div>
          <a className="pp-pf-tx" href={p.solscanUrl} target="_blank" rel="noreferrer">
            SOLSCAN {EXT_ICON}
          </a>
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          className="pp-proofs-foot"
          onClick={() => setExpanded(true)}
        >
          SEE ALL {totalProofs} PROOFS →
        </button>
      )}
    </div>
  );
}
