import type { WorkItem } from "@/lib/public-profile-view";

/**
 * Single PoW card. "VERIFY THIS WORK" button is a stub — the real proof
 * flow lands in Step 4 with the token-dev qualification gate. For now it
 * just renders as a no-op button so the visual is complete.
 */
export function WorkItemCard({ item }: { item: WorkItem }) {
  const cardClass = [
    "pp-pow-card",
    item.isMinted ? "pp-minted" : "",
    item.isCurrent ? "pp-current" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dateRange = item.endedAt
    ? `${item.startedAt} — ${item.endedAt}`
    : `${item.startedAt} — PRESENT`;

  return (
    <div className={cardClass}>
      <div className="pp-pow-head">
        <div className="pp-pow-title">
          <span className="pp-ticker">{item.ticker}</span>
          <span className="pp-role">{item.role}</span>
        </div>
        <div className="pp-pow-tags">
          {item.isMinted && (
            <span className="pp-pow-tag pp-minted" data-tip="Project minted on-chain via LASTPROOF">
              MINTED
            </span>
          )}
          {item.isCurrent && <span className="pp-pow-tag pp-current">CURRENT</span>}
          {item.isDev && <span className="pp-pow-tag pp-dev">DEV</span>}
        </div>
      </div>
      <div className="pp-pow-dates">{dateRange}</div>
      <p className="pp-pow-desc">{item.description}</p>
      <div className="pp-pow-foot">
        <div className="pp-pow-proofs">
          <b>{item.proofCount}</b>PROOFS
        </div>
        <button type="button" className="pp-pow-verify" data-tip="Proof this project on-chain today">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          VERIFY THIS WORK
        </button>
      </div>
    </div>
  );
}
