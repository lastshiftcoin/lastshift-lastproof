"use client";

import { useState } from "react";
import type { WorkItem } from "@/lib/public-profile-view";
import { ProofModal } from "@/components/proof-modal/ProofModal";

/**
 * Single PoW card. "VERIFY THIS WORK" button opens the proof modal.
 *
 * Modal is a minimal shell in this commit — step 1 + step 5 eligibility
 * stream wired to the mock SSE endpoint at /api/mock/proof/eligibility.
 * See src/components/proof-modal/ProofModal.tsx for scope notes.
 */
export function WorkItemCard({ item, handle, ownerWallet }: { item: WorkItem; handle: string; ownerWallet: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  const cardClass = [
    "pp-pow-card",
    item.isMinted ? "pp-minted" : "",
    item.isCurrent ? "pp-current" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };

  const dateRange = item.endedAt
    ? `${fmt(item.startedAt)} — ${fmt(item.endedAt)}`
    : `${fmt(item.startedAt)} — PRESENT`;

  return (
    <>
      <div className={cardClass}>
        <div className="pp-pow-head">
          <div className="pp-pow-title">
            <div className="pp-pow-ticker-row">
              <span className="pp-ticker">{item.ticker}</span>
              {item.isCurrent && <span className="pp-pow-tag pp-current">CURRENT</span>}
            </div>
            <span className="pp-role">{item.role}</span>
          </div>
          <div className="pp-pow-tags">
            {item.isMinted && (
              <span className="pp-pow-tag pp-minted" data-tip="Project minted on-chain via LASTPROOF">
                MINTED
              </span>
            )}
            {item.isDev && <span className="pp-pow-tag pp-dev">DEV</span>}
          </div>
        </div>
        <div className="pp-pow-dates">{dateRange}</div>
        <p className="pp-pow-desc">{item.description}</p>
        <div className="pp-pow-foot">
          <div className="pp-pow-proofs">
            <b>{item.proofCount}</b>PROOFS
          </div>
          <button
            type="button"
            className="pp-pow-verify"
            data-tip="Proof this project on-chain today"
            onClick={() => setModalOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            VERIFY THIS WORK
          </button>
        </div>
      </div>
      <ProofModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workItemId={item.id}
        ticker={item.ticker}
        handle={handle}
        ownerWallet={ownerWallet}
      />
    </>
  );
}
