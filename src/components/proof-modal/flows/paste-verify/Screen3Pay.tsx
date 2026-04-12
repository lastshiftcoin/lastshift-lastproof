"use client";

import { useCallback, useState } from "react";
import type { ProofPath } from "../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";
import { getProofPriceUsd } from "@/lib/proof-tokens";

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";

export interface Screen3PayProps {
  path: ProofPath;
  token: ProofTokenKey;
  pubkey: string;
  onSubmit: (signature: string) => void;
}

export function Screen3Pay({ path, token, pubkey, onSubmit }: Screen3PayProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const price = getProofPriceUsd(path, token);
  const shortPubkey = `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(TREASURY_WALLET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }, [input, onSubmit]);

  return (
    <>
      <div className="pm-eyebrow">&gt; SEND PAYMENT</div>
      <h2 className="pm-head">
        Pay and <span className="pm-accent">paste.</span>
      </h2>
      <p className="pm-sub">
        Send the exact amount from your connected wallet to the address below.
        Then paste the Solscan link or transaction signature.
      </p>

      <div className="pm-review">
        <div className="pm-review-row">
          <span className="pm-review-key">SENDING FROM</span>
          <span className="pm-review-val pm-mono pm-green">{shortPubkey}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">SEND TO</span>
          <span className="pm-review-val pm-mono" style={{ fontSize: 10, wordBreak: "break-all" }}>
            {TREASURY_WALLET}
            <button
              type="button"
              className="pm-cta-ghost"
              style={{ marginLeft: 8, padding: "2px 8px", fontSize: 9 }}
              onClick={handleCopy}
            >
              {copied ? "COPIED" : "COPY"}
            </button>
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">AMOUNT</span>
          <span className="pm-review-val pm-accent">
            ${price.toFixed(2)} in {token}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">TOKEN</span>
          <span className="pm-review-val">{token}</span>
        </div>
      </div>

      <div className="pm-notice" style={{ marginTop: 14, padding: "10px 12px", fontSize: 11, lineHeight: 1.5, color: "var(--pm-sub)", borderLeft: "2px solid var(--pm-red, #ef4444)", background: "rgba(239,68,68,0.05)" }}>
        <strong style={{ color: "var(--pm-fg)" }}>SEND FROM YOUR CONNECTED WALLET</strong>
        <span style={{ display: "block", marginTop: 2 }}>
          Transactions from other wallets will be rejected during verification.
        </span>
      </div>

      <div className="pm-notice" style={{ marginTop: 8, padding: "10px 12px", fontSize: 11, lineHeight: 1.5, color: "var(--pm-sub)", borderLeft: "2px solid var(--pm-accent)", background: "rgba(255,255,255,0.03)" }}>
        <strong style={{ color: "var(--pm-fg)" }}>SOL REQUIRED FOR GAS</strong>
        <span style={{ display: "block", marginTop: 2 }}>
          Your wallet needs a small amount of SOL (~0.005) to cover Solana network fees.
          The proof payment is in {token} — SOL is only for gas.
        </span>
      </div>

      <div className="pm-field" style={{ marginTop: 14 }}>
        <label className="pm-field-key" htmlFor="pm-sig-input">
          TRANSACTION SIGNATURE
        </label>
        <textarea
          id="pm-sig-input"
          className="pm-comment"
          placeholder="Paste Solscan URL or transaction signature…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ minHeight: 56, fontSize: 11 }}
        />
      </div>
      <div className="pm-field-help">
        FIND THIS IN YOUR WALLET&apos;S TRANSACTION HISTORY OR ON SOLSCAN.IO
      </div>

      <div className="pm-cta-bar" style={{ marginTop: 14, padding: 0, border: 0 }}>
        <button
          type="button"
          className="pm-cta"
          disabled={!input.trim()}
          onClick={handleSubmit}
        >
          &gt; SUBMIT FOR VERIFICATION
        </button>
      </div>
    </>
  );
}
