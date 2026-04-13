"use client";

/**
 * ProofsLedgerCard — read-only table of on-chain proofs.
 *
 * Wireframe: lastproof-dashboard.html, PROOFS section.
 *
 * - Meta row: total proofs count, dev proofs count, legend
 * - Table: WALLET | TICKER | DATE | COMMENT | TX
 * - DEV badge on dev_verification proofs
 * - First 10 rows visible, rest behind SHOW ALL toggle
 * - TX links to Solscan
 * - Empty state if no proofs
 */

import { useState } from "react";

interface LedgerProof {
  id: string;
  voucherWallet: string;
  ticker: string | null;
  kind: "proof" | "dev_verification";
  note: string | null;
  txSignature: string | null;
  createdAt: string;
}

interface ProofsLedgerCardProps {
  proofs: LedgerProof[];
}

const VISIBLE_COUNT = 10;

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

export function ProofsLedgerCard({ proofs }: ProofsLedgerCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCount = proofs.length;
  const devCount = proofs.filter((p) => p.kind === "dev_verification").length;
  const hasHidden = totalCount > VISIBLE_COUNT;

  const visible = expanded ? proofs : proofs.slice(0, VISIBLE_COUNT);

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">PROOFS</div>
      </div>
      <div className="edit-body">
        <div className="field-help">
          Every on-chain proof submitted to your wallet. Each row is a real
          transaction signed by a proofer — DEV badge means the proofer is a
          verified project dev. Click TX to view on Solscan.
        </div>

        {totalCount === 0 ? (
          <div className="pf-empty">
            No proofs yet. Share your profile to start collecting on-chain endorsements.
          </div>
        ) : (
          <>
            {/* Meta row */}
            <div className="pf-meta">
              <div className="pf-total">
                <strong>{totalCount}</strong> TOTAL PROOFS{" "}
                {devCount > 0 && (
                  <>· <strong>{devCount}</strong> FROM DEVS</>
                )}
              </div>
              <div className="pf-legend">
                <span className="pf-dev">DEV</span>
                <span>= verified project dev</span>
              </div>
            </div>

            {/* Table */}
            <table className="pf-table">
              <thead>
                <tr>
                  <th>WALLET</th>
                  <th>TICKER</th>
                  <th>DATE</th>
                  <th>COMMENT</th>
                  <th>TX</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((proof) => (
                  <tr key={proof.id}>
                    <td>
                      <span className="pf-wallet">
                        {truncateWallet(proof.voucherWallet)}
                      </span>{" "}
                      {proof.kind === "dev_verification" ? (
                        <span className="pf-dev">DEV</span>
                      ) : (
                        <span className="pf-dev-empty" />
                      )}
                    </td>
                    <td className="pf-tick">
                      {proof.ticker ?? "—"}
                    </td>
                    <td className="pf-date">{formatDate(proof.createdAt)}</td>
                    <td className="pf-comment">{proof.note || "—"}</td>
                    <td>
                      {proof.txSignature ? (
                        <a
                          className="pf-link"
                          href={`https://solscan.io/tx/${proof.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          SOLSCAN
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontSize: 10 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Show all toggle */}
            {hasHidden && (
              <div className="pf-expand">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                >
                  {expanded ? "SHOW LESS" : `SHOW ALL ${totalCount} PROOFS`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
