"use client";

import { useEffect, useRef, useState } from "react";
import type { ProofPath, ProofQuote } from "../../../types";
import { useQuoteRefresh } from "../../../useQuoteRefresh";

export interface Step7ReviewProps {
  initialQuote: ProofQuote;
  path: ProofPath;
  ticker: string;
  handle: string;
  comment: string;
  pubkey: string;
  onStartOver: () => void;
  onSign: () => void;
}

export function Step7Review({
  initialQuote,
  path,
  ticker,
  handle,
  comment,
  pubkey,
  onStartOver,
  onSign,
}: Step7ReviewProps) {
  const { state: refresh, manualRefresh } = useQuoteRefresh({
    initialQuote,
    enabled: true,
  });
  const quote = refresh.quote;

  const [flash, setFlash] = useState(false);
  const lastAmountRef = useRef(quote.amount_ui);
  useEffect(() => {
    if (lastAmountRef.current !== quote.amount_ui) {
      lastAmountRef.current = quote.amount_ui;
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 400);
      return () => window.clearTimeout(id);
    }
  }, [quote.amount_ui]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const expiresMs = new Date(quote.expires_at).getTime();
  const secsLeft = Math.max(0, Math.floor((expiresMs - now) / 1000));
  const countdownCls =
    secsLeft <= 10 ? "pm-danger" : secsLeft <= 30 ? "pm-warn" : "";

  const tokenLabel = quote.token.toUpperCase();
  const shortPubkey = pubkey
    ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
    : "—";
  const shortQuoteId = `${quote.quote_id.slice(0, 6)}…${quote.quote_id.slice(-4)}`;

  useEffect(() => {
    if (refresh.lockLost || refresh.slotTaken) {
      onStartOver();
    }
  }, [refresh.lockLost, refresh.slotTaken, onStartOver]);

  return (
    <>
      <div className="pm-eyebrow">&gt; REVIEW BEFORE YOU SIGN</div>
      <h2 className="pm-head">
        One last <span className="pm-accent">look.</span>
      </h2>
      <p className="pm-sub">
        Confirm everything below. After you sign, the proof is permanent — no
        edit, no delete, no refund.
      </p>

      <div className="pm-review">
        <div className="pm-review-row">
          <span className="pm-review-key">PROJECT</span>
          <span className="pm-review-val pm-green">{ticker}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">OPERATOR</span>
          <span className="pm-review-val">@{handle}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">PROOF TYPE</span>
          <span className="pm-review-val">
            {path === "dev" ? "DEV" : "COLLABORATOR"}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">COMMENT</span>
          <span className="pm-review-val pm-review-comment">
            {comment ? `"${comment}"` : <span className="pm-dim">—</span>}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">FROM WALLET</span>
          <span className="pm-review-val pm-mono">{shortPubkey}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">TO</span>
          <span className="pm-review-val">$LASTSHFT AR WALLET</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">PAY WITH</span>
          <span className="pm-review-val">
            {tokenLabel === "LASTSHFT" ? "$LASTSHFT (−40%)" : tokenLabel}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">AMOUNT</span>
          <span className="pm-review-val pm-accent">
            <span className={flash ? "pm-flash" : undefined}>
              ${quote.usd.toFixed(2)} = {quote.amount_ui} {tokenLabel}
            </span>
            {!refresh.expired && (
              <span className="pm-live-pill">
                <span className="pm-live-dot" />
                LIVE
              </span>
            )}
          </span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">QUOTE ID</span>
          <span className="pm-review-val pm-mono">
            {shortQuoteId}
            {!refresh.expired && (
              <>
                {" "}
                · EXPIRES IN <span className={countdownCls}>{secsLeft}s</span>
              </>
            )}
          </span>
        </div>
      </div>
      <div className="pm-field-help">
        PRICE REFRESHES EVERY 5S · LOCKED AT SIGNATURE
      </div>

      {refresh.expired ? (
        <div className="pm-expired">
          QUOTE EXPIRED — REFRESH PRICE
          <br />
          <button
            type="button"
            className="pm-cta"
            style={{ marginTop: 10 }}
            onClick={manualRefresh}
          >
            &gt; REFRESH PRICE
          </button>
        </div>
      ) : (
        <div className="pm-ticker">
          <div>
            <div className={`pm-ticker-amount${flash ? " pm-flash" : ""}`}>
              {quote.amount_ui} {tokenLabel}
            </div>
            <div className="pm-ticker-countdown" style={{ marginTop: 4 }}>
              {refresh.reVerified ? "RE-VERIFIED · " : ""}
              quote locked
            </div>
          </div>
          <div className="pm-ticker-meta">
            <div className="pm-ticker-usd">${quote.usd.toFixed(2)}</div>
            <div className={`pm-ticker-countdown ${countdownCls}`}>
              EXPIRES IN {secsLeft}s
            </div>
          </div>
        </div>
      )}

      {refresh.error && !refresh.expired && (
        <div
          className="pm-comment-hint"
          style={{ color: "var(--pm-red)", marginTop: 8 }}
        >
          refresh error: {refresh.error}
        </div>
      )}

      <div
        className="pm-cta-bar"
        style={{ marginTop: 18, padding: 0, border: 0 }}
      >
        <button
          type="button"
          className="pm-cta"
          disabled={refresh.expired}
          onClick={onSign}
        >
          &gt; SIGN PROOF
        </button>
      </div>

      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 10, padding: "8px 12px", fontSize: 11 }}
        onClick={onStartOver}
      >
        ← START OVER
      </button>
    </>
  );
}
