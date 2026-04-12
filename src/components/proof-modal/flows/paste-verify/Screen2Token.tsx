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

const TOKEN_GLYPH: Record<ProofTokenKey, string> = {
  LASTSHFT: "LS",
  SOL: "◎",
  USDT: "₮",
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
        operator discount and routes straight to the buy-back wallet.
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
                <div className={`pm-token-icon pm-token-icon-${t.key.toLowerCase()}`}>
                  {TOKEN_GLYPH[t.key]}
                </div>
                <div className="pm-token-meta">
                  <div className="pm-token-name">{t.label}</div>
                  <div className="pm-token-sub">BAL: — · ≈ $—</div>
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
                {t.hasDiscountBadge ? (
                  <a
                    className="pm-buy-btn"
                    href={BUY_LASTSHFT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    BUY $LASTSHFT ↗
                  </a>
                ) : (
                  <div className="pm-token-live">≈ {price.toFixed(2)} {t.key}</div>
                )}
              </div>
              {t.hasDiscountBadge && (
                <span className="pm-token-badge">{LASTSHFT_DISCOUNT_LABEL}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pm-field-help">
        PAYMENT GOES TO $LASTSHFT AR WALLET · MEMO INCLUDES PROOF ID
      </div>
    </>
  );
}
