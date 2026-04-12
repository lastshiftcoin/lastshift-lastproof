"use client";

import type { ProofPath } from "../../types";

export interface Screen5SuccessProps {
  ticker: string;
  handle: string;
  path: ProofPath;
  pubkey: string;
  tokenLabel: string;
  proofId: string;
  solscanUrl: string | null;
  onClose: () => void;
}

export function Screen5Success({
  ticker,
  handle,
  path,
  pubkey,
  tokenLabel,
  proofId,
  solscanUrl,
  onClose,
}: Screen5SuccessProps) {
  const shortPubkey = `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
  const shortProofId = `${proofId.slice(0, 6)}…${proofId.slice(-4)}`;

  return (
    <>
      <div className="pm-done-wrap">
        <div className="pm-done-check" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="pm-eyebrow">&gt; PROOFED ON-CHAIN</div>
        <h2 className="pm-head">
          <span className="pm-accent">@{handle}</span> thanks you.{" "}
          <span className="pm-green">It&apos;s done.</span>
        </h2>
        <p className="pm-sub">
          Your proof is live. The operator&apos;s count just ticked up by 1.
        </p>
        <div className="pm-proof-summary">
          <div className="pm-ps-row">
            <span className="pm-ps-key">PROJECT</span>
            <span className="pm-ps-val pm-green">{ticker}</span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">PROOF TYPE</span>
            <span className="pm-ps-val">
              {path === "dev" ? "DEV" : "COLLABORATOR"}
            </span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">FROM</span>
            <span className="pm-ps-val pm-mono">{shortPubkey}</span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">TOKEN</span>
            <span className="pm-ps-val">{tokenLabel}</span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">PROOF ID</span>
            <span className="pm-ps-val pm-mono">{shortProofId}</span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">SOLSCAN</span>
            <span className="pm-ps-val">
              {solscanUrl ? (
                <a href={solscanUrl} target="_blank" rel="noopener noreferrer">
                  VIEW ↗
                </a>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
        <button type="button" className="pm-cta pm-cta-green" onClick={onClose}>
          &gt; BACK TO PROFILE
        </button>
      </div>
    </>
  );
}
