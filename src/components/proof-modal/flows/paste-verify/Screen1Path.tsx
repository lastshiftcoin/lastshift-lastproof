"use client";

import type { ProofPath } from "../../types";

export interface Screen1PathProps {
  path: ProofPath | null;
  onPick: (p: ProofPath) => void;
  ticker: string;
  handle: string;
}

export function Screen1Path({ path, onPick, ticker, handle }: Screen1PathProps) {
  return (
    <>
      <div className="pm-eyebrow">&gt; VERIFY THIS WORK ON-CHAIN</div>
      <h2 className="pm-head">
        You&apos;re proofing <span className="pm-accent">@{handle}</span>.
      </h2>
      <p className="pm-sub">
        Pick the path that matches your relationship to <b>{ticker}</b>. Proofs
        are permanent — you can&apos;t edit, delete, or refund after signature.
      </p>
      <div className="pm-paths">
        <button
          type="button"
          className={`pm-path-card${path === "collab" ? " pm-selected" : ""}`}
          onClick={() => onPick("collab")}
        >
          <span className="pm-path-lim">1 PER WALLET</span>
          <div className="pm-path-title">COLLABORATOR</div>
          <div className="pm-path-desc">
            You worked alongside them on {ticker}. No token-level claim.
          </div>
        </button>
        <button
          type="button"
          className={`pm-path-card pm-path-dev${path === "dev" ? " pm-selected" : ""}`}
          onClick={() => onPick("dev")}
        >
          <span className="pm-path-lim">1 DEV PROOF / PROJECT</span>
          <div className="pm-path-title">DEV</div>
          <div className="pm-path-desc">
            You deployed or co-founded {ticker}. You must pay from the wallet
            that deployed the token or holds mint authority.
          </div>
        </button>
      </div>
      <div className="pm-field-help">
        1 WALLET PER PROJECT · 1 DEV PROOF PER PROJECT · PERMANENT ON-CHAIN
      </div>
    </>
  );
}
