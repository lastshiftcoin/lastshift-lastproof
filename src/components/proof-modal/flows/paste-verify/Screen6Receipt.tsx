"use client";

import type { ProofPath } from "../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";

export interface Screen6ReceiptProps {
  proofData: Record<string, unknown>;
  solscanUrl: string | null;
  ticker: string;
  handle: string;
  path: ProofPath;
  token: ProofTokenKey;
  onClose: () => void;
}

export function Screen6Receipt({
  proofData,
  solscanUrl,
  ticker,
  handle,
  path,
  token,
  onClose,
}: Screen6ReceiptProps) {
  const senderWallet = (proofData.sender_wallet as string) ?? "";
  const shortSender = senderWallet.length > 10
    ? `${senderWallet.slice(0, 6)}…${senderWallet.slice(-4)}`
    : senderWallet || "—";
  const proofId = (proofData.proof_id as string) ?? "";
  const shortProofId = proofId.length > 10
    ? `${proofId.slice(0, 6)}…${proofId.slice(-4)}`
    : proofId || "—";
  const commentText = (proofData.comment as string) ?? "";
  const createdAt = proofData.created_at
    ? new Date(proofData.created_at as string).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  const txSig = solscanUrl ?? (proofData.tx_signature
    ? `https://solscan.io/tx/${proofData.tx_signature}`
    : null);

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
      </div>

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
          <span className="pm-ps-val pm-mono">{shortSender}</span>
        </div>
        <div className="pm-ps-row">
          <span className="pm-ps-key">TOKEN</span>
          <span className="pm-ps-val">{token}</span>
        </div>
        {commentText && (
          <div className="pm-ps-row">
            <span className="pm-ps-key">COMMENT</span>
            <span className="pm-ps-val" style={{ fontSize: 11 }}>
              &ldquo;{commentText}&rdquo;
            </span>
          </div>
        )}
        <div className="pm-ps-row">
          <span className="pm-ps-key">STATUS</span>
          <span className="pm-ps-val pm-green">VERIFIED</span>
        </div>
        <div className="pm-ps-row">
          <span className="pm-ps-key">PROOF ID</span>
          <span className="pm-ps-val pm-mono">{shortProofId}</span>
        </div>
        <div className="pm-ps-row">
          <span className="pm-ps-key">DATE</span>
          <span className="pm-ps-val">{createdAt}</span>
        </div>
        {txSig && (
          <div className="pm-ps-row">
            <span className="pm-ps-key">SOLSCAN</span>
            <span className="pm-ps-val">
              <a href={txSig} target="_blank" rel="noopener noreferrer">
                VIEW ↗
              </a>
            </span>
          </div>
        )}
      </div>

      <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
        <button
          type="button"
          className="pm-cta pm-cta-green"
          onClick={() => {
            onClose();
            // Refresh page to show updated proof count + tier
            window.location.reload();
          }}
        >
          &gt; BACK TO PROFILE
        </button>
      </div>
    </>
  );
}
