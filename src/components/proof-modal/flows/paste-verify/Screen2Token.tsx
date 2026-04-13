"use client";

import type { ProofPath } from "../../types";
import {
  PROOF_TOKENS,
  PROOF_BASE_PRICE_USD,
  LASTSHFT_DISCOUNT_LABEL,
  BUY_LASTSHFT_URL,
  getProofPriceUsd,
  type ProofTokenKey,
} from "@/lib/proof-tokens";

export interface Screen2TokenProps {
  path: ProofPath;
  token: ProofTokenKey;
  onPick: (t: ProofTokenKey) => void;
}

const TOKEN_LOGO: Record<ProofTokenKey, string> = {
  LASTSHFT: "/tokens/lastshft.png",
  SOL: "/tokens/sol.png",
  USDT: "/tokens/usdt.svg",
};

export function Screen2Token({ path, token, onPick }: Screen2TokenProps) {
  const basePrice = PROOF_BASE_PRICE_USD[path];
  return (
    <>
      <div className="pm-eyebrow">&gt; PICK YOUR TOKEN</div>
      <h2 className="pm-head">
        Pay with <span className="pm-accent">$LASTSHFT</span> — 40% off.
      </h2>
      <p className="pm-sub">
        Three options, all permissionless. Paying in $LASTSHFT unlocks the
        operator discount.
      </p>

      <div className="pm-tokens">
        {PROOF_TOKENS.map((t) => {
          const price = getProofPriceUsd(path, t.key);
          const selected = t.key === token;
          return (
            <button
              key={t.key}
              type="button"
              className={`pm-token pm-token-${t.key.toLowerCase()}${selected ? " pm-selected" : ""}`}
              onClick={() => onPick(t.key)}
            >
              <div className="pm-tc-left">
                <img
                  src={TOKEN_LOGO[t.key]}
                  alt={t.label}
                  className={`pm-token-icon pm-token-icon-${t.key.toLowerCase()}`}
                />
                <div className="pm-token-meta">
                  <div className="pm-token-name">{t.label}</div>
                </div>
              </div>
              <div className="pm-tc-right">
                {t.hasDiscountBadge ? (
                  <div className="pm-token-price pm-discount">
                    <span className="pm-token-strike">${basePrice.toFixed(2)}</span>
                    <span>${price.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="pm-token-price">${price.toFixed(2)}</div>
                )}
              </div>
              {t.hasDiscountBadge && (
                <span className="pm-token-badge">{LASTSHFT_DISCOUNT_LABEL}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pm-field-help" style={{ marginTop: 12 }}>
        <a
          href={BUY_LASTSHFT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--pm-accent)", textDecoration: "none" }}
        >
          NEED $LASTSHFT? → BUY HERE ↗
        </a>
      </div>
    </>
  );
}
