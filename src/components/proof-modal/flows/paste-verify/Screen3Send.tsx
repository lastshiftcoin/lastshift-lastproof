"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProofPath } from "../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";
import { getProofPriceUsd } from "@/lib/proof-tokens";

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";

export interface Screen3SendProps {
  path: ProofPath;
  token: ProofTokenKey;
}

interface ConvertResponse {
  ok: boolean;
  usd: number;
  token_amount: number;
  token: string;
  rate_usd: number;
}

export function Screen3Send({ path, token }: Screen3SendProps) {
  const [copied, setCopied] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number | null>(null);
  const [rateUsd, setRateUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const price = getProofPriceUsd(path, token);

  // Fetch live token conversion on mount
  useEffect(() => {
    setLoading(true);
    fetch(`/api/proof/convert?path=${path}&token=${token}`)
      .then((r) => r.json())
      .then((data: ConvertResponse) => {
        if (data.ok) {
          setTokenAmount(data.token_amount);
          setRateUsd(data.rate_usd);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [path, token]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(TREASURY_WALLET.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);

  const handleCopyAmount = useCallback(() => {
    if (tokenAmount !== null) {
      const formatted = formatTokenAmount(tokenAmount, token);
      navigator.clipboard.writeText(formatted).catch(() => {});
    }
  }, [tokenAmount, token]);

  if (!TREASURY_WALLET) {
    return (
      <>
        <div className="pm-eyebrow pm-eyebrow-fail">&gt; CONFIGURATION ERROR</div>
        <h2 className="pm-head">
          Treasury address not configured.
        </h2>
        <p className="pm-sub">
          Contact support — this should not happen in production.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="pm-eyebrow">&gt; SEND PAYMENT</div>
      <h2 className="pm-head">
        Send and <span className="pm-accent">come back.</span>
      </h2>

      <div className="pm-review">
        <div className="pm-review-row">
          <span className="pm-review-key">SEND TO</span>
          <span className="pm-review-val pm-mono" style={{ fontSize: 10, wordBreak: "break-all" }}>
            {TREASURY_WALLET}
            <button
              type="button"
              className="pm-cta-ghost"
              style={{ marginLeft: 8, padding: "2px 8px", fontSize: 9, userSelect: "none" }}
              onClick={handleCopy}
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">AMOUNT</span>
          <span className="pm-review-val pm-accent" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? (
              <span style={{ opacity: 0.5 }}>calculating…</span>
            ) : tokenAmount !== null ? (
              <>
                <span>
                  {formatTokenAmount(tokenAmount, token)} {token}
                </span>
                <button
                  type="button"
                  className="pm-cta-ghost"
                  style={{ padding: "2px 8px", fontSize: 9 }}
                  onClick={handleCopyAmount}
                >
                  COPY
                </button>
              </>
            ) : (
              <span>${price.toFixed(2)} in {token}</span>
            )}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">USD VALUE</span>
          <span className="pm-review-val">
            ${price.toFixed(2)}
            {rateUsd !== null && token !== "USDT" && (
              <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 10 }}>
                (1 {token} ≈ ${rateUsd.toFixed(token === "LASTSHFT" ? 6 : 2)})
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: "var(--pm-sub)" }}>
        <div>• Send the exact amount in one transaction</div>
        <div>• Save your Solscan link or TX signature</div>
        <div>• Come back here when you&apos;re done</div>
      </div>
    </>
  );
}

/** Format token amount with appropriate decimal places */
function formatTokenAmount(amount: number, token: ProofTokenKey): string {
  if (token === "USDT") return amount.toFixed(2);
  if (token === "SOL") return amount.toFixed(6);
  // LASTSHFT — show enough precision but not excessive
  if (amount >= 100) return amount.toFixed(2);
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(6);
}
