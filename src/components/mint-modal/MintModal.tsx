"use client";

/**
 * MintModal — 4-step payment modal for minting a work item on-chain.
 *
 * Steps:
 *   1. Info + Token Select (work item card, mint explainer, pricing, token picker)
 *   2. Review + Confirm (summary card, fine print, back/confirm CTAs)
 *   3. Pending (gold spinner, log lines mapped from useSignFlow phases)
 *   4. Outcome (success: gold check + summary, failure: red X + retry)
 *
 * Visual canon: wireframes/lastproof-mint-modal.html
 * Gold theme (vs orange for proof modal). All CSS classes `mm-` prefixed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import "./mint-modal.css";
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
  type PaymentToken,
} from "@/lib/pricing";

type MintStep = 1 | 2 | 3 | 4;

export interface MintModalProps {
  open: boolean;
  onClose: () => void;
  workItemId: string;
  ticker: string;
  role: string;
  dates: string;
  proofCount: number;
  mintedCount: number;
}

/** Shorten a pubkey to `F7k2...9xMp` form. */
function shortPubkey(pk: string): string {
  if (pk.length <= 10) return pk;
  return `${pk.slice(0, 4)}\u2026${pk.slice(-4)}`;
}

/** FAILURE_LABELS — human-readable copy for each failure code. */
const FAILURE_LABELS: Record<FailureReason, string> = {
  user_rejected: "WALLET SIGNATURE REJECTED",
  insufficient_balance: "INSUFFICIENT BALANCE",
  blockhash_expired: "BLOCKHASH EXPIRED",
  tx_reverted: "TRANSACTION REVERTED ON-CHAIN",
  rpc_degraded: "SOLANA RPC DEGRADED",
  quote_expired_hard: "QUOTE EXPIRED",
  lock_lost: "LOCK LOST",
  dev_slot_taken: "SLOT TAKEN",
  signature_invalid: "SIGNATURE MISMATCH",
  unknown: "UNKNOWN ERROR",
};

export function MintModal({
  open,
  onClose,
  workItemId,
  ticker,
  role,
  dates,
  proofCount,
  mintedCount,
}: MintModalProps) {
  const [step, setStep] = useState<MintStep>(1);
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  /** Quote ID from /api/quote. */
  const [quoteId, setQuoteId] = useState<string | null>(null);
  /** Amount in token units from quote response. */
  const [amountUi, setAmountUi] = useState<string | null>(null);
  /** DEV-ONLY: toggle outcome between success/failure. */
  const [forceOutcome, setForceOutcome] = useState<"ok" | "fail">("ok");

  const { state: sign, start: startSign, reset: resetSign } = useSignFlow();
  const connected = useConnected();
  const { wallet: walletAdapter } = useWallet();

  const shellRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  const maxMints = 4;
  const availableMints = maxMints - mintedCount;
  const basePrice = BASE_PRICES_USD.mint;
  const discountedPrice = priceFor("mint", "LASTSHFT");
  const selectedPrice = priceFor("mint", token as PaymentToken);

  // ─── Reset on close ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setStep(1);
      setToken("LASTSHFT");
      setQuoteId(null);
      setAmountUi(null);
      setForceOutcome("ok");
      resetSign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Step 3 → 4 auto-advance on terminal sign phase ──────────────
  useEffect(() => {
    if (step === 3 && (sign.phase === "confirmed" || sign.phase === "failed")) {
      setStep(4);
    }
  }, [step, sign.phase]);

  // ─── ESC to close (blocked during signing) ────────────────────────
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
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
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [open, sign.phase, onClose]);

  // ─── Quote + signing pipeline ─────────────────────────────────────
  const fetchQuoteAndSign = useCallback(async () => {
    if (!connected) return;
    setStep(3);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "mint",
          token,
          work_item_id: workItemId,
          pubkey: connected.pubkey,
        }),
      });
      const body = await res.json().catch(() => ({})) as {
        ok?: boolean;
        quote_id?: string;
        amount_ui?: number;
        reason?: string;
      };

      if (!res.ok || body.ok === false) {
        // Can't proceed — treat as unknown failure
        resetSign();
        setStep(4);
        return;
      }

      const qid = body.quote_id!;
      setQuoteId(qid);
      setAmountUi(body.amount_ui != null ? String(body.amount_ui) : null);

      // Kick off signing
      startSign({
        quoteId: qid,
        pubkey: connected.pubkey,
        handle: ticker,
        ticker,
        path: "collab",
        signTransactionBase64: async (txBase64) => {
          const adapter = walletAdapter?.adapter as
            | { signTransaction?: (tx: unknown) => Promise<unknown> }
            | undefined;
          if (!adapter?.signTransaction) {
            // Dev mock passthrough
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
          bytes.forEach((b: number) => (bin += String.fromCharCode(b)));
          return btoa(bin);
        },
      });
    } catch {
      resetSign();
      setStep(4);
    }
  }, [connected, token, workItemId, ticker, walletAdapter, startSign, resetSign]);

  // ─── Step navigation ──────────────────────────────────────────────
  const handleContinueToReview = useCallback(() => {
    if (step === 1) setStep(2);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step === 2) setStep(1);
  }, [step]);

  const handleConfirmAndPay = useCallback(() => {
    if (step === 2) {
      fetchQuoteAndSign();
    }
  }, [step, fetchQuoteAndSign]);

  const handleRetry = useCallback(() => {
    resetSign();
    setQuoteId(null);
    setAmountUi(null);
    fetchQuoteAndSign();
  }, [resetSign, fetchQuoteAndSign]);

  if (!open) return null;

  const isSuccess = sign.phase === "confirmed";
  const isFailed = sign.phase === "failed";

  // ─── Log lines for step 3 ────────────────────────────────────────
  const logLines = buildLogLines(sign.phase);

  return (
    <div
      className="mm-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mm-bar-title"
    >
      <div
        className="mm-shell"
        ref={shellRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TITLEBAR */}
        <div className="mm-bar">
          <div className="mm-bar-left">
            <div className="mm-dots" aria-hidden="true">
              <span className="mm-dot-r" />
              <span className="mm-dot-y" />
              <span className="mm-dot-g" />
            </div>
            <span className="mm-bar-title" id="mm-bar-title">
              lastproof — mint work item
            </span>
          </div>
          <div className="mm-bar-right">
            <span className="mm-pulse" aria-hidden="true" />
            MINT
            <button
              type="button"
              className="mm-bar-close"
              onClick={onClose}
              aria-label="Close mint modal"
            >
              CLOSE
            </button>
          </div>
        </div>

        {/* REF ROW: connected wallet pill + step counter */}
        <div className="mm-ref-row">
          {connected ? (
            <div className="mm-conn-pill">
              <span className="mm-conn-dot" />
              <span className="mm-conn-label">CONNECTED</span>
              <span className="mm-conn-addr">
                {connected.canonical.toUpperCase()} &middot; {shortPubkey(connected.pubkey)}
              </span>
            </div>
          ) : (
            <span />
          )}
          <span className="mm-step-counter">
            STEP <span className="mm-step-now">{step}</span> / 4
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="mm-progress-wrap">
          <div className="mm-bar-track">
            <div
              className="mm-bar-fill"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* BODY */}
        <div className="mm-body">
          {step === 1 && (
            <Step1Info
              ticker={ticker}
              role={role}
              dates={dates}
              proofCount={proofCount}
              basePrice={basePrice}
              discountedPrice={discountedPrice}
              token={token}
              onPickToken={setToken}
            />
          )}
          {step === 2 && (
            <Step2Review
              ticker={ticker}
              role={role}
              availableMints={availableMints}
              token={token}
              selectedPrice={selectedPrice}
              pubkey={connected?.pubkey ?? ""}
              amountUi={amountUi}
            />
          )}
          {step === 3 && (
            <Step3Pending logLines={logLines} />
          )}
          {step === 4 && (
            <Step4Outcome
              isSuccess={isSuccess}
              ticker={ticker}
              role={role}
              proofCount={proofCount}
              token={token}
              amountUi={amountUi}
              selectedPrice={selectedPrice}
              sign={sign}
              onRetry={handleRetry}
              onClose={onClose}
              forceOutcome={forceOutcome}
              onToggleOutcome={() =>
                setForceOutcome((o) => (o === "ok" ? "fail" : "ok"))
              }
            />
          )}
        </div>

        {/* CTA ROW — steps 1 and 2 only */}
        {step === 1 && (
          <div className="mm-cta-row">
            <button
              type="button"
              className="mm-cta"
              onClick={handleContinueToReview}
              disabled={availableMints <= 0 || proofCount < 1}
            >
              &gt; CONTINUE TO REVIEW
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="mm-cta-row">
            <button
              type="button"
              className="mm-btn-back"
              onClick={handleBack}
            >
              &larr; BACK
            </button>
            <button
              type="button"
              className="mm-cta"
              onClick={handleConfirmAndPay}
            >
              CONFIRM &amp; PAY &rarr;
            </button>
          </div>
        )}

        {/* Fine print */}
        {(step === 1 || step === 2) && (
          <div className="mm-fine">
            MINTING IS PERMANENT &middot; MAX 4 PER PROFILE &middot; REQUIRES 1+ PROOF
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Info + Token Select ──────────────────────────────────────

function Step1Info({
  ticker,
  role,
  dates,
  proofCount,
  basePrice,
  discountedPrice,
  token,
  onPickToken,
}: {
  ticker: string;
  role: string;
  dates: string;
  proofCount: number;
  basePrice: number;
  discountedPrice: number;
  token: ProofTokenKey;
  onPickToken: (t: ProofTokenKey) => void;
}) {
  return (
    <>
      <div className="mm-eyebrow"> MINT THIS WORK ON-CHAIN</div>
      <h2 className="mm-head">
        Mint <span className="mm-green">{ticker}</span>
      </h2>
      <p className="mm-sub">
        Minting locks this work item permanently on-chain. Minted items get a
        gold badge, appear first on your profile, and can never be deleted or
        edited.
      </p>

      {/* Work item card */}
      <div className="mm-proj-card">
        <div className="mm-proj-ticker">{ticker}</div>
        <div className="mm-proj-meta">
          <div className="mm-proj-role">{role}</div>
          <div className="mm-proj-dates">{dates}</div>
        </div>
        <div className="mm-proj-tags">
          <span className="mm-proj-tag mm-proj-tag-proofs">
            {proofCount} PROOF{proofCount !== 1 ? "S" : ""}
          </span>
          <span className="mm-proj-tag mm-proj-tag-current">CURRENT</span>
        </div>
      </div>

      {/* Mint explainer card */}
      <div className="mm-info-card">
        <div className="mm-info-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          WHAT MINTING DOES
        </div>
        <div className="mm-info-body">
          <ul>
            <li><b>Gold MINTED badge</b> on your public profile</li>
            <li><b>Pinned to top</b> of your work item list</li>
            <li><b>Permanent &amp; immutable</b> — cannot be edited or removed</li>
            <li><b>Max 4 minted items</b> per profile — choose wisely</li>
          </ul>
        </div>
      </div>

      {/* Pricing row */}
      <div className="mm-price-row">
        <div className="mm-price-item">
          <div className="mm-price-amount mm-base">
            ${basePrice.toFixed(2)}
          </div>
          <div className="mm-price-label">SOL / USDT</div>
        </div>
        <div className="mm-price-divider" />
        <div className="mm-price-item">
          <div className="mm-price-amount mm-disc">
            ${discountedPrice.toFixed(2)}
          </div>
          <div className="mm-price-label">
            WITH <span className="mm-hl">$LASTSHFT</span> &middot; {LASTSHFT_DISCOUNT_LABEL}
          </div>
        </div>
      </div>

      {/* Token selector */}
      <div className="mm-token-grid">
        {PROOF_TOKENS.map((t) => {
          const isSelected = token === t.key;
          const price = priceFor("mint", t.key as PaymentToken);
          return (
            <button
              key={t.key}
              type="button"
              className={`mm-token-card${isSelected ? " mm-selected" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onPickToken(t.key);
              }}
            >
              {t.hasDiscountBadge && (
                <span className="mm-discount-pill">{LASTSHFT_DISCOUNT_LABEL}</span>
              )}
              <div className="mm-tc-left">
                <div className={`mm-token-icon${t.key === "USDT" ? " mm-token-icon-usdt" : ""}`}>
                  {t.key === "LASTSHFT" ? "LP" : t.key === "SOL" ? "SOL" : "$"}
                </div>
                <div className="mm-token-meta">
                  <div className="mm-token-name">{t.label}</div>
                  <div className="mm-token-sub">
                    {t.key === "LASTSHFT" ? "LASTSHIFT TOKEN" : t.key}
                  </div>
                </div>
              </div>
              <div className="mm-tc-right">
                <div className={`mm-token-price${t.hasDiscountBadge ? " mm-discount" : ""}`}>
                  {t.hasDiscountBadge && (
                    <span className="mm-token-strike">${basePrice.toFixed(2)}</span>
                  )}
                  <span>${price.toFixed(2)}</span>
                </div>
                {t.key === "LASTSHFT" && (
                  <a
                    className="mm-buy-btn"
                    href={BUY_LASTSHFT_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    BUY $LASTSHFT &#8599;
                  </a>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mm-field-help" style={{ textAlign: "center", marginTop: 12 }}>
        PAYMENT GOES TO $LASTSHFT AR WALLET &middot; REQUIRES AT LEAST 1 PROOF
      </div>
    </>
  );
}

// ─── Step 2: Review + Confirm ─────────────────────────────────────────

function Step2Review({
  ticker,
  role,
  availableMints,
  token,
  selectedPrice,
  pubkey,
  amountUi,
}: {
  ticker: string;
  role: string;
  availableMints: number;
  token: ProofTokenKey;
  selectedPrice: number;
  pubkey: string;
  amountUi: string | null;
}) {
  const tokenInfo = PROOF_TOKENS.find((t) => t.key === token)!;
  const isDiscount = token === "LASTSHFT";

  return (
    <>
      <div className="mm-eyebrow"> REVIEW BEFORE YOU SIGN</div>
      <h2 className="mm-head">
        One last <span className="mm-gold">look.</span>
      </h2>
      <p className="mm-sub">
        Confirm everything below. Once minted, this work item is locked
        permanently. No edits, no deletes.
      </p>

      <div className="mm-review-card">
        <div className="mm-review-row">
          <span className="mm-review-key">WORK ITEM</span>
          <span className="mm-review-val mm-green">
            {ticker} &middot; {role}
          </span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">AVAILABLE MINTS</span>
          <span className="mm-review-val mm-green">
            {availableMints} OF 4
          </span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">RESULT</span>
          <span className="mm-review-val mm-gold">PERMANENT GOLD MINTED BADGE</span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">FROM WALLET</span>
          <span className="mm-review-val">{shortPubkey(pubkey).toUpperCase()}</span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">TO</span>
          <span className="mm-review-val">$LASTSHFT AR WALLET</span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">PAY WITH</span>
          <span className="mm-review-val">
            {tokenInfo.label}
            {isDiscount ? ` (\u2212${Math.round(LASTSHFT_DISCOUNT * 100)}%)` : ""}
          </span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">AMOUNT</span>
          <span className="mm-review-val mm-gold">
            ${selectedPrice.toFixed(2)}
            {amountUi ? ` = ${amountUi} ${tokenInfo.label}` : ""}
            <span className="mm-live-pill">
              <span className="mm-live-dot" />
              LIVE
            </span>
          </span>
        </div>
      </div>

      <div className="mm-field-help" style={{ textAlign: "center", marginTop: 10 }}>
        PRICE LOCKED AT SIGNATURE &middot; MINTING IS IRREVERSIBLE
      </div>
    </>
  );
}

// ─── Step 3: Pending ──────────────────────────────────────────────────

interface LogLine {
  text: string;
  status: "ok" | "pending";
}

function buildLogLines(phase: SignPhase): LogLine[] {
  const lines: LogLine[] = [];

  const phases: { phase: SignPhase; label: string }[] = [
    { phase: "building", label: "QUOTE LOCKED" },
    { phase: "awaiting_signature", label: "BUILDING TRANSACTION" },
    { phase: "broadcasting", label: "AWAITING WALLET SIGNATURE" },
    { phase: "confirming", label: "BROADCASTING TO SOLANA" },
  ];

  const phaseOrder: SignPhase[] = [
    "idle",
    "building",
    "awaiting_signature",
    "broadcasting",
    "confirming",
    "confirmed",
    "failed",
  ];

  const currentIdx = phaseOrder.indexOf(phase);

  for (const p of phases) {
    const idx = phaseOrder.indexOf(p.phase);
    if (currentIdx > idx) {
      lines.push({ text: p.label, status: "ok" });
    } else if (currentIdx === idx) {
      lines.push({ text: `${p.label}...`, status: "pending" });
    }
    // Skip lines for phases we haven't reached yet
  }

  if (phase === "confirming") {
    lines.push({ text: "WAITING FOR ON-CHAIN CONFIRMATION...", status: "pending" });
  }

  return lines;
}

function Step3Pending({ logLines }: { logLines: LogLine[] }) {
  return (
    <>
      <div className="mm-eyebrow"> CONFIRMING ON-CHAIN</div>
      <h2 className="mm-head">
        Minting <span className="mm-gold">in progress.</span>
      </h2>
      <p className="mm-sub">
        Your wallet signed the transaction. Waiting for on-chain confirmation.
      </p>

      <div className="mm-pending-wrap">
        <div className="mm-spinner" />
        <div className="mm-pending-status">CONFIRMING TRANSACTION&hellip;</div>
        <div className="mm-pending-log">
          {logLines.map((line, i) => (
            <div
              key={i}
              className={line.status === "ok" ? "mm-log-ok" : "mm-log-pending"}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>

      <div className="mm-field-help" style={{ textAlign: "center", marginTop: 14 }}>
        DO NOT CLOSE THIS WINDOW &middot; AVERAGE CONFIRMATION: 5&ndash;15 SECONDS
      </div>
    </>
  );
}

// ─── Step 4: Outcome ──────────────────────────────────────────────────

function Step4Outcome({
  isSuccess,
  ticker,
  role,
  proofCount,
  token,
  amountUi,
  selectedPrice,
  sign,
  onRetry,
  onClose,
  forceOutcome,
  onToggleOutcome,
}: {
  isSuccess: boolean;
  ticker: string;
  role: string;
  proofCount: number;
  token: ProofTokenKey;
  amountUi: string | null;
  selectedPrice: number;
  sign: { phase: SignPhase; failure: FailureReason | null; solscanUrl: string | null; signature: string | null };
  onRetry: () => void;
  onClose: () => void;
  forceOutcome: "ok" | "fail";
  onToggleOutcome: () => void;
}) {
  const tokenInfo = PROOF_TOKENS.find((t) => t.key === token)!;

  // In dev, allow toggling between success/fail outcomes
  const showSuccess =
    process.env.NODE_ENV !== "production"
      ? forceOutcome === "ok"
      : isSuccess;

  const failureLabel = sign.failure
    ? FAILURE_LABELS[sign.failure]
    : "UNKNOWN ERROR";

  const shortSig = sign.signature
    ? `${sign.signature.slice(0, 4)}\u2026${sign.signature.slice(-4)}`
    : null;

  return (
    <>
      {showSuccess ? (
        <div className="mm-done-wrap">
          <div className="mm-done-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="mm-eyebrow" style={{ color: "var(--mm-gold)" }}>
            MINTED ON-CHAIN
          </div>
          <h2 className="mm-head">
            <span className="mm-green">{ticker}</span> has been{" "}
            <span className="mm-gold">Minted.</span>
          </h2>
          <p className="mm-sub">
            Your work item is now permanently locked on-chain with a gold MINTED
            badge. It will appear pinned at the top of your public profile.
          </p>

          <div className="mm-summary">
            <div className="mm-ps-row">
              <span className="mm-ps-key">WORK ITEM</span>
              <span className="mm-ps-val mm-green">
                {ticker} &middot; {role}
              </span>
            </div>
            <div className="mm-ps-row">
              <span className="mm-ps-key">STATUS</span>
              <span className="mm-ps-val mm-gold">MINTED &#10022;</span>
            </div>
            <div className="mm-ps-row">
              <span className="mm-ps-key">PROOFS</span>
              <span className="mm-ps-val mm-green">{proofCount} VERIFIED</span>
            </div>
            <div className="mm-ps-row">
              <span className="mm-ps-key">PAID</span>
              <span className="mm-ps-val">
                {amountUi ? `${amountUi} ${tokenInfo.label}` : ""} (${selectedPrice.toFixed(2)})
              </span>
            </div>
            {sign.solscanUrl && shortSig && (
              <div className="mm-ps-row">
                <span className="mm-ps-key">SOLSCAN</span>
                <span className="mm-ps-val">
                  <a href={sign.solscanUrl} target="_blank" rel="noreferrer">
                    {shortSig} &#8599;
                  </a>
                </span>
              </div>
            )}
          </div>

          <div className="mm-ok-actions">
            <button
              type="button"
              className="mm-cta mm-ok-back"
              onClick={onClose}
            >
              &gt; BACK TO UPDATE PROFILE
            </button>
          </div>
        </div>
      ) : (
        <div className="mm-done-wrap">
          <div className="mm-done-check mm-fail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div className="mm-eyebrow" style={{ color: "var(--mm-red)" }}>
            TRANSACTION FAILED
          </div>
          <h2 className="mm-head">
            Mint did <span className="mm-red">not broadcast.</span>
          </h2>
          <p className="mm-sub">
            Nothing was charged. The transaction either reverted on-chain or was
            rejected by your wallet. You can retry below.
          </p>

          <div className="mm-summary">
            <div className="mm-ps-row">
              <span className="mm-ps-key">WORK ITEM</span>
              <span className="mm-ps-val mm-green">
                {ticker} &middot; {role}
              </span>
            </div>
            <div className="mm-ps-row">
              <span className="mm-ps-key">ERROR</span>
              <span className="mm-ps-val" style={{ color: "var(--mm-red)" }}>
                {failureLabel}
              </span>
            </div>
            <div className="mm-ps-row">
              <span className="mm-ps-key">CHARGED</span>
              <span className="mm-ps-val mm-green">$0.00 &middot; NOTHING SENT</span>
            </div>
            {sign.solscanUrl && shortSig && (
              <div className="mm-ps-row">
                <span className="mm-ps-key">SOLSCAN</span>
                <span className="mm-ps-val">
                  <a href={sign.solscanUrl} target="_blank" rel="noreferrer">
                    {shortSig} (failed) &#8599;
                  </a>
                </span>
              </div>
            )}
          </div>

          <div className="mm-fail-actions">
            <button
              type="button"
              className="mm-cta mm-fail-retry"
              onClick={onRetry}
            >
              &gt; RETRY MINT
            </button>
            <button
              type="button"
              className="mm-cta mm-fail-close"
              onClick={onClose}
            >
              &gt; BACK TO UPDATE PROFILE
            </button>
          </div>
        </div>
      )}

      {/* Dev-only outcome toggle */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mm-outcome-toggle">
          <button type="button" onClick={onToggleOutcome}>
            &#8635; TOGGLE OUTCOME (WIREFRAME)
          </button>
        </div>
      )}
    </>
  );
}
