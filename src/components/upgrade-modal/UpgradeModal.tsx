"use client";

/**
 * UpgradeModal — 4-step payment modal for upgrading to a premium profile.
 *
 * Steps:
 *   1. Info + feature grid + token select
 *   2. Review + confirm
 *   3. Pending (signing pipeline via useSignFlow)
 *   4. Outcome (success with live countdown / failure with retry)
 *
 * Visual canon: wireframes/lastproof-upgrade-modal.html
 * Purple theme throughout (#a78bfa).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import "./upgrade-modal.css";
import { useSignFlow, type SignPhase } from "@/components/proof-modal/useSignFlow";
import type { FailureReason } from "@/components/proof-modal/types";
import { useConnected } from "@/lib/wallet/use-connected";
import {
  PROOF_TOKENS,
  LASTSHFT_DISCOUNT_LABEL,
  BUY_LASTSHFT_URL,
  type ProofTokenKey,
} from "@/lib/proof-tokens";
import {
  BASE_PRICES_USD,
  LASTSHFT_DISCOUNT,
  priceFor,
} from "@/lib/pricing";
import { SUBSCRIPTION_PERIOD_DAYS } from "@/lib/subscription";

type UpgradeStep = 1 | 2 | 3 | 4;

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  handle: string;
}

/** Format a Date as "APR 9, 2026" style. */
function fmtDate(d: Date): string {
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Shorten a pubkey: F7k2…9xMp */
function shortPubkey(pk: string): string {
  if (pk.length <= 8) return pk;
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

export function UpgradeModal({ open, onClose, handle }: UpgradeModalProps) {
  const [step, setStep] = useState<UpgradeStep>(1);
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteAmountUi, setQuoteAmountUi] = useState<string | null>(null);
  const [quoteUsd, setQuoteUsd] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteFetching, setQuoteFetching] = useState(false);

  const { state: sign, start: startSign, reset: resetSign } = useSignFlow();
  const connected = useConnected();
  const { wallet: walletAdapter } = useWallet();

  const shellRef = useRef<HTMLDivElement | null>(null);

  // Compute expiry date (30 days from now)
  const expiresAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + SUBSCRIPTION_PERIOD_DAYS);
    return d;
  }, []);

  // Pricing
  const basePrice = BASE_PRICES_USD.subscription;
  const discountedPrice = priceFor("subscription", "LASTSHFT");
  const selectedPrice = priceFor("subscription", token);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setToken("LASTSHFT");
      setQuoteId(null);
      setQuoteAmountUi(null);
      setQuoteUsd(null);
      setQuoteError(null);
      setQuoteFetching(false);
      resetSign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Step 3 -> 4 auto-advance on sign terminal phase
  useEffect(() => {
    if (step === 3 && (sign.phase === "confirmed" || sign.phase === "failed")) {
      setStep(4);
    }
  }, [step, sign.phase]);

  // Keyboard: ESC closes (unless mid-signing)
  useEffect(() => {
    if (!open) return;
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        sign.phase === "awaiting_signature" ||
        sign.phase === "broadcasting" ||
        sign.phase === "confirming"
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sign.phase, onClose]);

  /** Fetch a quote from /api/quote for this subscription. */
  const fetchQuote = useCallback(async () => {
    setQuoteFetching(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "subscription",
          token,
          metadata: { handle },
        }),
      });
      const body = await res.json().catch(() => ({})) as {
        ok?: boolean;
        quote_id?: string;
        amount_ui?: number;
        usd?: number;
        reason?: string;
      };
      if (!res.ok || body.ok === false) {
        setQuoteError(body.reason ?? "Quote request failed");
        return;
      }
      setQuoteId(body.quote_id ?? null);
      setQuoteAmountUi(body.amount_ui != null ? String(body.amount_ui) : null);
      setQuoteUsd(body.usd ?? selectedPrice);
    } catch {
      setQuoteError("Network error — try again");
    } finally {
      setQuoteFetching(false);
    }
  }, [token, handle, selectedPrice]);

  /** Move from step 1 to step 2 — fetch quote first. */
  const handleContinueToReview = useCallback(async () => {
    if (!connected) return;
    await fetchQuote();
    setStep(2);
  }, [connected, fetchQuote]);

  /** Kick off signing pipeline. */
  const kickOffSigning = useCallback(() => {
    if (!quoteId || !connected) return;
    setStep(3);
    startSign({
      quoteId,
      pubkey: connected.pubkey,
      handle,
      ticker: "$LASTSHFT",
      path: "collab", // subscription doesn't have a path; placeholder
      signTransactionBase64: async (txBase64) => {
        const adapter = walletAdapter?.adapter as
          | { signTransaction?: (tx: unknown) => Promise<unknown> }
          | undefined;
        if (!adapter?.signTransaction) {
          return txBase64;
        }
        const { Transaction } = await import("@solana/web3.js");
        const tx = Transaction.from(
          Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0)),
        );
        const signed = (await adapter.signTransaction(tx)) as {
          serialize: () => Uint8Array;
        };
        const bytes = signed.serialize();
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin);
      },
    });
  }, [quoteId, connected, handle, walletAdapter, startSign]);

  /** Retry from failure — re-sign same quote. */
  const handleRetry = useCallback(() => {
    resetSign();
    kickOffSigning();
  }, [resetSign, kickOffSigning]);

  /** Go back to step 1 from failure. */
  const handleBackToStart = useCallback(() => {
    resetSign();
    setQuoteId(null);
    setQuoteAmountUi(null);
    setQuoteUsd(null);
    setQuoteError(null);
    setStep(1);
  }, [resetSign]);

  if (!open) return null;

  const tokenLabel = PROOF_TOKENS.find((t) => t.key === token)?.label ?? token;

  return (
    <div
      className="um-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="um-bar-title"
    >
      <div
        className="um-shell"
        ref={shellRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Titlebar ────────────────────────────────────────────── */}
        <div className="um-bar">
          <div className="um-bar-left">
            <div className="um-dots" aria-hidden="true">
              <span className="um-dot-r" />
              <span className="um-dot-y" />
              <span className="um-dot-g" />
            </div>
            <span className="um-bar-title" id="um-bar-title">
              lastproof — upgrade to premium
            </span>
          </div>
          <div className="um-bar-right">
            <span className="um-pulse" aria-hidden="true" />
            UPGRADE
            <button
              type="button"
              className="um-bar-close"
              onClick={onClose}
              aria-label="Close upgrade modal"
            >
              CLOSE
            </button>
          </div>
        </div>

        {/* ── Ref row: connected wallet + step counter ────────────── */}
        <div className="um-ref-row">
          {connected ? (
            <div className="um-conn-pill">
              <span className="um-conn-dot" />
              <span className="um-conn-label">CONNECTED</span>
              <span className="um-conn-addr">
                {connected.canonical.toUpperCase()} &middot; {shortPubkey(connected.pubkey)}
              </span>
            </div>
          ) : (
            <span />
          )}
          <span className="um-step-counter">
            STEP <span className="um-step-now">{step}</span> / 4
          </span>
        </div>

        {/* ── Progress bar ────────────────────────────────────────── */}
        <div className="um-progress-wrap">
          <div className="um-bar-track">
            <div
              className="um-bar-fill"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="um-body">
          {step === 1 && (
            <Step1Info
              token={token}
              onPickToken={setToken}
              basePrice={basePrice}
              discountedPrice={discountedPrice}
            />
          )}
          {step === 2 && (
            <Step2Review
              token={token}
              tokenLabel={tokenLabel}
              handle={handle}
              pubkey={connected?.pubkey ?? ""}
              expiresAt={expiresAt}
              quoteAmountUi={quoteAmountUi}
              quoteUsd={quoteUsd ?? selectedPrice}
              quoteFetching={quoteFetching}
              quoteError={quoteError}
            />
          )}
          {step === 3 && (
            <Step3Pending
              sign={sign}
              pubkey={connected?.pubkey ?? ""}
            />
          )}
          {step === 4 && (
            <Step4Outcome
              sign={sign}
              handle={handle}
              token={token}
              tokenLabel={tokenLabel}
              quoteAmountUi={quoteAmountUi}
              quoteUsd={quoteUsd ?? selectedPrice}
              expiresAt={expiresAt}
              onRetry={handleRetry}
              onBack={handleBackToStart}
              onClose={onClose}
            />
          )}
        </div>

        {/* ── CTA row (steps 1 & 2 only) ──────────────────────────── */}
        {step === 1 && (
          <div className="um-cta-row">
            <button
              type="button"
              className="um-cta"
              disabled={!connected}
              onClick={handleContinueToReview}
            >
              &gt; CONTINUE TO REVIEW
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="um-cta-row">
            <button
              type="button"
              className="um-btn-back"
              onClick={() => setStep(1)}
            >
              &larr; BACK
            </button>
            <button
              type="button"
              className="um-cta"
              disabled={!quoteId || quoteFetching}
              onClick={kickOffSigning}
            >
              &gt; CONFIRM &amp; PAY
            </button>
          </div>
        )}

        {/* ── Fine print ──────────────────────────────────────────── */}
        {(step === 1 || step === 2) && (
          <div className="um-fine">
            ${basePrice.toFixed(0)} / {SUBSCRIPTION_PERIOD_DAYS} DAYS &middot; 40% OFF WITH $LASTSHFT &middot; ROLLOVER IF RENEWED EARLY
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Info + Features + Token Select ──────────────────────────

const CHECK_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const STAR_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const PREMIUM_FEATURES = [
  { bold: "Grid listing", desc: "discoverable by hirers" },
  { bold: "Tier badges", desc: "New, Verified, Experienced, Legend" },
  { bold: "Verification Badge", desc: "X & Telegram" },
  { bold: "Hire button", desc: "DMs from your profile" },
  { bold: "Minting", desc: "lock top work on-chain" },
  { bold: "30 days", desc: "renew early, time rolls over" },
];

const COMPARE_ROWS: Array<{ feature: string; free: string; freeClass: string; prem: string; premClass: string }> = [
  { feature: "Public profile page",      free: "LIMITED", freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
  { feature: "Work items + proofs",      free: "\u2717",  freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
  { feature: "Grid discovery listing",   free: "\u2717",  freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
  { feature: "Tier badge system",        free: "\u2717",  freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
  { feature: "Verification Badge (X / TG)", free: "\u2717", freeClass: "um-no", prem: "\u2713", premClass: "um-hl" },
  { feature: "Hire button on profile",   free: "\u2717",  freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
  { feature: "Mint work items",          free: "\u2717",  freeClass: "um-no",  prem: "\u2713", premClass: "um-hl" },
];

function Step1Info({
  token,
  onPickToken,
  basePrice,
  discountedPrice,
}: {
  token: ProofTokenKey;
  onPickToken: (t: ProofTokenKey) => void;
  basePrice: number;
  discountedPrice: number;
}) {
  return (
    <>
      <div className="um-eyebrow">UPGRADE YOUR PROFILE</div>
      <h2 className="um-head">
        Go <span className="um-purple">Premium.</span>
      </h2>
      <p className="um-sub">
        Premium profiles are visible on the LASTPROOF grid, earn tier badges,
        and get the full suite of trust signals. One payment, 30 days. Renew
        early and your remaining time rolls over.
      </p>

      {/* Premium includes card */}
      <div className="um-prem-features">
        <div className="um-prem-features-head">
          {STAR_SVG}
          PREMIUM INCLUDES
        </div>
        <div className="um-prem-grid">
          {PREMIUM_FEATURES.map((f) => (
            <div className="um-prem-feat" key={f.bold}>
              {CHECK_SVG}
              <span>
                <b>{f.bold}</b> &mdash; {f.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Free vs Premium comparison table */}
      <table className="um-compare-table">
        <thead>
          <tr>
            <th>FEATURE</th>
            <th>FREE</th>
            <th>PREMIUM</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((r) => (
            <tr key={r.feature}>
              <td>{r.feature}</td>
              <td className={r.freeClass}>{r.free}</td>
              <td className={r.premClass}>{r.prem}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pricing row */}
      <div className="um-price-row">
        <div className="um-price-item">
          <div className="um-price-amount um-base">${basePrice.toFixed(2)}</div>
          <div className="um-price-label">SOL / USDT</div>
          <div className="um-price-period">/ 30 DAYS</div>
        </div>
        <div className="um-price-divider" />
        <div className="um-price-item">
          <div className="um-price-amount um-disc">${discountedPrice.toFixed(2)}</div>
          <div className="um-price-label">
            WITH <span className="um-hl">$LASTSHFT</span> &middot; 40% OFF
          </div>
          <div className="um-price-period">/ 30 DAYS</div>
        </div>
      </div>

      {/* Token selector */}
      <div className="um-token-grid">
        {PROOF_TOKENS.map((t) => {
          const selected = t.key === token;
          const price = priceFor("subscription", t.key);
          const isDiscount = t.key === "LASTSHFT";
          return (
            <div
              key={t.key}
              className={`um-token-card${selected ? " um-selected" : ""}`}
              onClick={() => onPickToken(t.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickToken(t.key);
                }
              }}
            >
              {t.hasDiscountBadge && (
                <span className="um-discount-pill">{LASTSHFT_DISCOUNT_LABEL}</span>
              )}
              <div className="um-tc-left">
                <div className={`um-token-icon${t.key === "USDT" ? " um-usdt" : ""}`}>
                  {t.key === "LASTSHFT" && (
                    <img
                      src="https://lastshiftcoin.com/$LASTSHFT%20Coin%20Logo.png"
                      alt="$LASTSHFT"
                      onError={(e) => {
                        (e.target as HTMLElement).outerHTML = "LP";
                      }}
                    />
                  )}
                  {t.key === "SOL" && (
                    <img
                      src="https://cryptologos.cc/logos/solana-sol-logo.svg"
                      alt="SOL"
                      onError={(e) => {
                        (e.target as HTMLElement).outerHTML = "SOL";
                      }}
                    />
                  )}
                  {t.key === "USDT" && (
                    <img
                      src="https://cryptologos.cc/logos/tether-usdt-logo.svg"
                      alt="USDT"
                      onError={(e) => {
                        (e.target as HTMLElement).outerHTML = "$";
                      }}
                    />
                  )}
                </div>
                <div className="um-token-meta">
                  <div className="um-token-name">{t.label}</div>
                  <div className="um-token-sub">SELECT TO PAY</div>
                </div>
              </div>
              <div className="um-tc-right">
                <div className={`um-token-price${isDiscount ? " um-discount" : ""}`}>
                  {isDiscount && (
                    <span className="um-strike">${basePrice.toFixed(2)}</span>
                  )}
                  <span>${price.toFixed(2)}</span>
                </div>
                {t.key === "LASTSHFT" && (
                  <a
                    className="um-buy-btn"
                    href={BUY_LASTSHFT_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    BUY $LASTSHFT &#8599;
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="um-field-help" style={{ textAlign: "center", marginTop: 12 }}>
        PAYMENT GOES TO $LASTSHFT AR WALLET &middot; RENEWS EVERY 30 DAYS &middot; ROLLOVER IF EARLY
      </div>
    </>
  );
}

// ─── Step 2: Review + Confirm ────────────────────────────────────────

function Step2Review({
  token,
  tokenLabel,
  handle,
  pubkey,
  expiresAt,
  quoteAmountUi,
  quoteUsd,
  quoteFetching,
  quoteError,
}: {
  token: ProofTokenKey;
  tokenLabel: string;
  handle: string;
  pubkey: string;
  expiresAt: Date;
  quoteAmountUi: string | null;
  quoteUsd: number;
  quoteFetching: boolean;
  quoteError: string | null;
}) {
  const discountTag = token === "LASTSHFT" ? " (\u221240%)" : "";
  const amountDisplay = quoteAmountUi
    ? `$${quoteUsd.toFixed(2)} = ${quoteAmountUi} ${tokenLabel}`
    : `$${quoteUsd.toFixed(2)}`;

  return (
    <>
      <div className="um-eyebrow">REVIEW BEFORE YOU SIGN</div>
      <h2 className="um-head">
        One last <span className="um-purple">look.</span>
      </h2>
      <p className="um-sub">
        Confirm everything below. Your premium subscription starts immediately
        and runs for {SUBSCRIPTION_PERIOD_DAYS} days.
      </p>

      {quoteError && (
        <div style={{ color: "var(--um-red)", textAlign: "center", marginBottom: 14, fontFamily: "var(--um-mono)", fontSize: 10, letterSpacing: "0.5px" }}>
          {quoteError}
        </div>
      )}

      <div className="um-review-card">
        <div className="um-review-row">
          <span className="um-review-key">PLAN</span>
          <span className="um-review-val um-purple">PREMIUM &mdash; {SUBSCRIPTION_PERIOD_DAYS} DAYS</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">HANDLE</span>
          <span className="um-review-val">@{handle.toUpperCase()}</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">INCLUDES</span>
          <span className="um-review-val">GRID + TIERS + VERIFIED + HIRE + MINT</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">FROM WALLET</span>
          <span className="um-review-val">{shortPubkey(pubkey).toUpperCase()}</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">TO</span>
          <span className="um-review-val">$LASTSHFT AR WALLET</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">PAY WITH</span>
          <span className="um-review-val">
            {tokenLabel}{discountTag}
          </span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">EXPIRES</span>
          <span className="um-review-val um-purple">{fmtDate(expiresAt)}</span>
        </div>
        <div className="um-review-row">
          <span className="um-review-key">AMOUNT</span>
          <span className="um-review-val um-purple">
            {quoteFetching ? "LOADING..." : amountDisplay}
            {!quoteFetching && (
              <span className="um-live-pill">
                <span className="um-live-dot" />
                LIVE
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="um-field-help" style={{ textAlign: "center", marginTop: 10 }}>
        PRICE LOCKED AT SIGNATURE &middot; SUBSCRIPTION STARTS IMMEDIATELY
      </div>
    </>
  );
}

// ─── Step 3: Pending ─────────────────────────────────────────────────

function phaseLabel(phase: SignPhase): string {
  switch (phase) {
    case "idle":
    case "building":
      return "PREPARING TRANSACTION...";
    case "awaiting_signature":
      return "WAITING FOR WALLET SIGNATURE...";
    case "broadcasting":
      return "BROADCASTING TRANSACTION...";
    case "confirming":
      return "CONFIRMING ON-CHAIN...";
    case "confirmed":
      return "CONFIRMED";
    case "failed":
      return "FAILED";
    default:
      return "ACTIVATING PREMIUM...";
  }
}

function Step3Pending({
  sign,
  pubkey,
}: {
  sign: { phase: SignPhase; signature: string | null; failure: FailureReason | null };
  pubkey: string;
}) {
  const pastBuilding =
    sign.phase !== "idle" && sign.phase !== "building";
  const pastSigning =
    sign.phase === "broadcasting" ||
    sign.phase === "confirming" ||
    sign.phase === "confirmed";

  return (
    <>
      <div className="um-eyebrow">CONFIRMING ON-CHAIN</div>
      <h2 className="um-head">
        Activating <span className="um-purple">premium.</span>
      </h2>
      <p className="um-sub">
        Your wallet signed the transaction. Waiting for on-chain confirmation to
        activate your subscription.
      </p>

      <div className="um-pending-wrap">
        <div className="um-spinner" />
        <div className="um-pending-status">{phaseLabel(sign.phase)}</div>
        <div className="um-pending-log">
          <div className={pastBuilding ? "um-ok" : "um-pending"}>
            WALLET CONNECTED &middot; {shortPubkey(pubkey).toUpperCase()}
          </div>
          <div className={pastSigning ? "um-ok" : pastBuilding ? "um-pending" : "um-pending"}>
            {pastSigning
              ? "TRANSACTION SIGNED \u00B7 PAYLOAD SENT"
              : "WAITING FOR WALLET SIGNATURE..."}
          </div>
          <div className={sign.phase === "confirmed" ? "um-ok" : "um-pending"}>
            {sign.phase === "confirmed"
              ? "ON-CHAIN CONFIRMED"
              : "WAITING FOR ON-CHAIN CONFIRMATION..."}
          </div>
        </div>
      </div>
      <div className="um-field-help" style={{ textAlign: "center", marginTop: 14 }}>
        DO NOT CLOSE THIS WINDOW &middot; AVERAGE CONFIRMATION: 5&ndash;15 SECONDS
      </div>
    </>
  );
}

// ─── Step 4: Outcome ─────────────────────────────────────────────────

function Step4Outcome({
  sign,
  handle,
  token,
  tokenLabel,
  quoteAmountUi,
  quoteUsd,
  expiresAt,
  onRetry,
  onBack,
  onClose,
}: {
  sign: { phase: SignPhase; signature: string | null; solscanUrl: string | null; failure: FailureReason | null };
  handle: string;
  token: ProofTokenKey;
  tokenLabel: string;
  quoteAmountUi: string | null;
  quoteUsd: number;
  expiresAt: Date;
  onRetry: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  if (sign.phase === "confirmed") {
    return (
      <SuccessOutcome
        handle={handle}
        tokenLabel={tokenLabel}
        quoteAmountUi={quoteAmountUi}
        quoteUsd={quoteUsd}
        expiresAt={expiresAt}
        solscanUrl={sign.solscanUrl}
        signature={sign.signature}
        onClose={onClose}
      />
    );
  }

  // Failure
  const failureMessage = friendlyFailure(sign.failure);

  return (
    <div className="um-done-wrap">
      <div className="um-done-check um-fail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <div className="um-eyebrow" style={{ color: "var(--um-red)" }}>
        TRANSACTION FAILED
      </div>
      <h2 className="um-head">
        Upgrade did <span className="um-red">not broadcast.</span>
      </h2>
      <p className="um-sub">
        Nothing was charged. The transaction either reverted on-chain or was
        rejected by your wallet. You can retry below.
      </p>
      <div className="um-summary">
        <div className="um-summary-row">
          <span className="um-summary-key">PLAN</span>
          <span className="um-summary-val um-purple">PREMIUM &mdash; {SUBSCRIPTION_PERIOD_DAYS} DAYS</span>
        </div>
        <div className="um-summary-row">
          <span className="um-summary-key">ERROR</span>
          <span className="um-summary-val" style={{ color: "var(--um-red)" }}>
            {failureMessage}
          </span>
        </div>
        <div className="um-summary-row">
          <span className="um-summary-key">CHARGED</span>
          <span className="um-summary-val um-green">$0.00 &middot; NOTHING SENT</span>
        </div>
        {sign.signature && (
          <div className="um-summary-row">
            <span className="um-summary-key">SOLSCAN</span>
            <span className="um-summary-val">
              {sign.solscanUrl ? (
                <a href={sign.solscanUrl} target="_blank" rel="noreferrer">
                  {shortPubkey(sign.signature)} (failed) &#8599;
                </a>
              ) : (
                `${shortPubkey(sign.signature)} (failed)`
              )}
            </span>
          </div>
        )}
      </div>
      <div className="um-fail-actions">
        <button type="button" className="um-cta um-fail-retry" onClick={onRetry}>
          &gt; RETRY UPGRADE
        </button>
        <button type="button" className="um-cta um-fail-back-btn" onClick={onBack}>
          &gt; BACK TO UPDATE PROFILE
        </button>
      </div>
    </div>
  );
}

function friendlyFailure(reason: FailureReason | null): string {
  switch (reason) {
    case "user_rejected":
      return "WALLET SIGNATURE REJECTED";
    case "insufficient_balance":
      return "INSUFFICIENT BALANCE";
    case "blockhash_expired":
      return "BLOCKHASH EXPIRED \u00B7 RETRY";
    case "tx_reverted":
      return "TRANSACTION REVERTED ON-CHAIN";
    case "rpc_degraded":
      return "RPC DEGRADED \u00B7 TRY AGAIN";
    case "quote_expired_hard":
      return "QUOTE EXPIRED \u00B7 NEW QUOTE NEEDED";
    case "lock_lost":
      return "LOCK LOST \u00B7 RETRY";
    case "signature_invalid":
      return "SIGNATURE INVALID \u00B7 WALLET MISMATCH";
    case "dev_slot_taken":
      return "SLOT TAKEN";
    case "unknown":
    default:
      return "UNKNOWN ERROR \u00B7 TRY AGAIN";
  }
}

// ─── Success Outcome with Live Countdown ─────────────────────────────

function SuccessOutcome({
  handle,
  tokenLabel,
  quoteAmountUi,
  quoteUsd,
  expiresAt,
  solscanUrl,
  signature,
  onClose,
}: {
  handle: string;
  tokenLabel: string;
  quoteAmountUi: string | null;
  quoteUsd: number;
  expiresAt: Date;
  solscanUrl: string | null;
  signature: string | null;
  onClose: () => void;
}) {
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = expiresAt.getTime();
    function tick() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setCountdown({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const activatedDate = fmtDate(new Date());
  const expiresDate = fmtDate(expiresAt);
  const paidDisplay = quoteAmountUi
    ? `${quoteAmountUi} ${tokenLabel} ($${quoteUsd.toFixed(2)})`
    : `$${quoteUsd.toFixed(2)}`;

  return (
    <div className="um-done-wrap">
      <div className="um-done-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="um-eyebrow" style={{ color: "var(--um-purple)" }}>
        PREMIUM PROFILE ACTIVE
      </div>
      <h2 className="um-head">
        Welcome to <span className="um-purple">Premium.</span>
      </h2>
      <p className="um-sub">
        Your profile is now live on the grid with full trust signals. Your
        subscription runs for {SUBSCRIPTION_PERIOD_DAYS} days from today. Renew early and your
        remaining time rolls over.
      </p>

      {/* Live countdown */}
      <div className="um-countdown-wrap">
        <div className="um-countdown-label">PREMIUM EXPIRES IN</div>
        <div className="um-countdown-digits">
          <div className="um-cd-block">
            <div className="um-cd-num">{countdown.d}</div>
            <div className="um-cd-unit">DAYS</div>
          </div>
          <div className="um-cd-sep">:</div>
          <div className="um-cd-block">
            <div className="um-cd-num">{String(countdown.h).padStart(2, "0")}</div>
            <div className="um-cd-unit">HRS</div>
          </div>
          <div className="um-cd-sep">:</div>
          <div className="um-cd-block">
            <div className="um-cd-num">{String(countdown.m).padStart(2, "0")}</div>
            <div className="um-cd-unit">MIN</div>
          </div>
          <div className="um-cd-sep">:</div>
          <div className="um-cd-block">
            <div className="um-cd-num">{String(countdown.s).padStart(2, "0")}</div>
            <div className="um-cd-unit">SEC</div>
          </div>
        </div>
        <div className="um-countdown-expires">EXPIRES {expiresDate}</div>
      </div>

      {/* Summary card */}
      <div className="um-summary">
        <div className="um-summary-row">
          <span className="um-summary-key">PLAN</span>
          <span className="um-summary-val um-purple">PREMIUM &mdash; {SUBSCRIPTION_PERIOD_DAYS} DAYS</span>
        </div>
        <div className="um-summary-row">
          <span className="um-summary-key">ACTIVATED</span>
          <span className="um-summary-val um-green">{activatedDate}</span>
        </div>
        <div className="um-summary-row">
          <span className="um-summary-key">EXPIRES</span>
          <span className="um-summary-val um-purple">{expiresDate}</span>
        </div>
        <div className="um-summary-row">
          <span className="um-summary-key">PAID</span>
          <span className="um-summary-val">{paidDisplay}</span>
        </div>
        {signature && (
          <div className="um-summary-row">
            <span className="um-summary-key">SOLSCAN</span>
            <span className="um-summary-val">
              {solscanUrl ? (
                <a href={solscanUrl} target="_blank" rel="noreferrer">
                  {shortPubkey(signature)} &#8599;
                </a>
              ) : (
                shortPubkey(signature)
              )}
            </span>
          </div>
        )}
      </div>

      <div className="um-ok-actions">
        <button type="button" className="um-cta um-ok-back" onClick={onClose}>
          &gt; BACK TO PROFILE
        </button>
      </div>
    </div>
  );
}
