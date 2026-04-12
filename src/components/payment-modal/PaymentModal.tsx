"use client";

/**
 * PaymentModal — generic payment flow for subscription, handle_change, mint.
 *
 * 5 steps (simpler than ProofModal — no SSE eligibility, no path, no comment):
 *   1. Token select (LASTSHFT 40% off, SOL, USDT)
 *   2. Wallet connect (reuses deep-link infra from proof modal)
 *   3. Review (kind label, amount, token, quote expiry countdown)
 *   4. Signing (build-tx → sign → broadcast → confirm via usePaymentFlow)
 *   5. Outcome (confirmed or failed with recovery CTAs)
 *
 * Props:
 *   kind — "subscription" | "handle_change" | "mint"
 *   metadata — passed to /api/quote (e.g. { refId: newHandle })
 *   onSuccess — called with txSignature on confirmed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { useConnected, type ConnectedWallet } from "@/lib/wallet/use-connected";
import { WALLET_META, WALLET_ORDER, shouldUseDeepLinks } from "@/lib/wallet/deep-link";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";
import { usePaymentFlow, type PaymentPhase, type PaymentFailure } from "@/hooks/usePaymentFlow";
import {
  BASE_PRICES_USD,
  LASTSHFT_DISCOUNT,
  type PaymentKindPriced,
  type PaymentToken,
} from "@/lib/pricing";
import "./payment-modal.css";

type PayStep = 1 | 2 | 3 | 4 | 5;

const KIND_LABELS: Record<string, string> = {
  subscription: "PREMIUM SUBSCRIPTION",
  handle_change: "HANDLE CHANGE",
  mint: "MINT WORK ITEM",
};

const KIND_DESCRIPTIONS: Record<string, string> = {
  subscription: "30 days of premium — tier display, HIRE button, Grid visibility.",
  handle_change: "Change your public @handle. 90-day cooldown after change.",
  mint: "Mint this work item to feature it on your profile.",
};

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  kind: PaymentKindPriced;
  metadata?: Record<string, unknown>;
  onSuccess?: (txSignature: string) => void;
}

export function PaymentModal({ open, onClose, kind, metadata, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<PayStep>(1);
  const [token, setToken] = useState<PaymentToken>("LASTSHFT");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteExpiry, setQuoteExpiry] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const connected = useConnected();
  const { wallet: walletAdapter } = useWallet();
  const { state: pay, start: startPay, reset: resetPay } = usePaymentFlow();

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setToken("LASTSHFT");
      setQuoteId(null);
      setQuoteExpiry(null);
      setQuoteAmount(null);
      setQuoteLoading(false);
      setErr(null);
      resetPay();
    }
  }, [open, resetPay]);

  // Auto-advance from signing to outcome
  useEffect(() => {
    if (step === 4 && pay.phase === "confirmed") {
      setStep(5);
      if (pay.signature && onSuccess) {
        onSuccess(pay.signature);
      }
    }
    if (step === 4 && pay.phase === "failed") {
      setStep(5);
    }
  }, [step, pay.phase, pay.signature, onSuccess]);

  // Issue quote when advancing from wallet → review
  const issueQuote = useCallback(async () => {
    setQuoteLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, token, metadata }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.reason ?? "Failed to get quote");
        setQuoteLoading(false);
        return false;
      }
      setQuoteId(data.quote.id);
      setQuoteExpiry(data.quote.expiresAt);
      setQuoteAmount(data.quote.expectedToken);
      setQuoteLoading(false);
      return true;
    } catch {
      setErr("Network error — try again");
      setQuoteLoading(false);
      return false;
    }
  }, [kind, token, metadata]);

  // Start signing
  const handleSign = useCallback(async () => {
    if (!quoteId || !connected) return;
    setStep(4);
    const adapter = walletAdapter?.adapter as
      | { signTransaction?: (tx: unknown) => Promise<unknown> }
      | undefined;
    await startPay({
      quoteId,
      pubkey: connected.pubkey,
      signTransactionBase64: async (txBase64) => {
        if (!adapter?.signTransaction) return txBase64;
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
  }, [quoteId, connected, walletAdapter, startPay]);

  if (!open) return null;

  const baseUsd = BASE_PRICES_USD[kind];
  const barTitle = KIND_LABELS[kind] ?? kind;

  return (
    <div className="pay-backdrop" onClick={onClose}>
      <div className="pay-shell" onClick={(e) => e.stopPropagation()}>
        {/* Titlebar */}
        <div className="pay-bar">
          <div className="pay-bar-left">
            <div className="pay-dots">
              <span className="pay-dot-r" />
              <span className="pay-dot-y" />
              <span className="pay-dot-g" />
            </div>
            <span className="pay-bar-title">{barTitle.toLowerCase()}</span>
          </div>
          <button type="button" className="pay-bar-close" onClick={onClose}>
            ESC
          </button>
        </div>

        <div className="pay-body">
          {step === 1 && (
            <StepToken
              kind={kind}
              baseUsd={baseUsd}
              token={token}
              onSelect={setToken}
              onContinue={() => setStep(connected ? 3 : 2)}
            />
          )}
          {step === 2 && (
            <StepWallet
              connected={connected}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepReview
              kind={kind}
              token={token}
              baseUsd={baseUsd}
              quoteAmount={quoteAmount}
              quoteExpiry={quoteExpiry}
              quoteLoading={quoteLoading}
              connected={connected}
              err={err}
              onBack={() => setStep(connected ? 1 : 2)}
              onIssueQuote={issueQuote}
              onSign={handleSign}
            />
          )}
          {step === 4 && <StepSigning phase={pay.phase} />}
          {step === 5 && (
            <StepOutcome
              phase={pay.phase}
              failure={pay.failure}
              signature={pay.signature}
              solscanUrl={pay.solscanUrl}
              onClose={onClose}
              onRetry={() => {
                resetPay();
                setQuoteId(null);
                setStep(1);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Token Select ─────────────────────────────────────────────────

function StepToken({
  kind,
  baseUsd,
  token,
  onSelect,
  onContinue,
}: {
  kind: PaymentKindPriced;
  baseUsd: number;
  token: PaymentToken;
  onSelect: (t: PaymentToken) => void;
  onContinue: () => void;
}) {
  const discountUsd = +(baseUsd * (1 - LASTSHFT_DISCOUNT)).toFixed(2);

  const tokens: Array<{ key: PaymentToken; label: string; sub: string; price: number; isDiscount: boolean }> = [
    { key: "LASTSHFT", label: "$LASTSHFT", sub: "40% off — default", price: discountUsd, isDiscount: true },
    { key: "SOL", label: "SOL", sub: "Solana native", price: baseUsd, isDiscount: false },
    { key: "USDT", label: "USDT", sub: "Stablecoin", price: baseUsd, isDiscount: false },
  ];

  return (
    <>
      <div className="pay-eyebrow">&gt; SELECT TOKEN</div>
      <h2 className="pay-head">
        {KIND_LABELS[kind] ?? kind}
      </h2>
      <p className="pay-sub">{KIND_DESCRIPTIONS[kind] ?? ""}</p>

      <div className="pay-tokens">
        {tokens.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pay-token${token === t.key ? " pay-selected" : ""}`}
            onClick={() => onSelect(t.key)}
          >
            <div className="pay-token-meta">
              <span className="pay-token-name">{t.label}</span>
              <span className="pay-token-sub">{t.sub}</span>
            </div>
            <span className={`pay-token-price${t.isDiscount ? " pay-discount" : ""}`}>
              ${t.price.toFixed(2)}
              {t.isDiscount && <span className="pay-token-strike">${baseUsd.toFixed(2)}</span>}
            </span>
            {t.isDiscount && <span className="pay-token-badge">40% OFF</span>}
          </button>
        ))}
      </div>

      <button type="button" className="pay-cta" onClick={onContinue}>
        &gt; CONTINUE
      </button>
    </>
  );
}

// ─── Step 2: Wallet Connect ───────────────────────────────────────────────

function StepWallet({
  connected,
  onBack,
  onContinue,
}: {
  connected: ConnectedWallet | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { wallets, select, connect, connecting, wallet: selectedWallet } = useWallet();
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const useDeepLinks = useMemo(() => shouldUseDeepLinks(), []);

  const liveByCanonical = useMemo(() => {
    const map = new Map<KnownWallet, Wallet>();
    for (const w of wallets) {
      const c = classifyWallet(w.adapter.name).canonical;
      if (c && !map.has(c)) map.set(c, w);
    }
    return map;
  }, [wallets]);

  const handleClick = useCallback(
    async (canonical: KnownWallet) => {
      setWalletErr(null);
      const live = liveByCanonical.get(canonical);
      if (!live) {
        setWalletErr(
          `${WALLET_META[canonical].label} isn't available. Install the extension or open inside the wallet app.`,
        );
        return;
      }
      try {
        select(live.adapter.name);
        await connect();
      } catch (e) {
        setWalletErr(e instanceof Error ? e.message : "wallet connect failed");
      }
    },
    [liveByCanonical, select, connect],
  );

  // Auto-advance when wallet connects
  useEffect(() => {
    if (connected) onContinue();
  }, [connected, onContinue]);

  return (
    <>
      <div className="pay-eyebrow">&gt; CONNECT WALLET</div>
      <h2 className="pay-head">
        Pick a <span className="pay-accent">wallet.</span>
      </h2>
      <p className="pay-sub">
        Connect your wallet to sign the transaction. LASTPROOF never holds your keys.
      </p>

      <div className="pay-wallets">
        {WALLET_ORDER.map((id) => {
          const meta = WALLET_META[id];
          const live = liveByCanonical.get(id);
          const isConnecting =
            connecting && selectedWallet?.adapter.name === live?.adapter.name;

          if (useDeepLinks && !live) {
            const href =
              typeof window !== "undefined" ? meta.buildDeepLink(window.location.href) : "#";
            return (
              <a
                key={id}
                className="pay-wallet"
                href={href}
                rel="noopener noreferrer"
              >
                <span className="pay-wallet-label">{meta.label}</span>
                <span className="pay-wallet-hint">OPEN IN APP &rarr;</span>
              </a>
            );
          }

          return (
            <button
              key={id}
              type="button"
              className="pay-wallet"
              onClick={() => handleClick(id)}
              disabled={connecting}
            >
              <span className="pay-wallet-label">{meta.label}</span>
              <span className="pay-wallet-hint">
                {isConnecting ? "CONNECTING\u2026" : live ? "DETECTED" : "NOT INSTALLED"}
              </span>
            </button>
          );
        })}
      </div>

      {walletErr && <div className="pay-error">{walletErr}</div>}

      <button type="button" className="pay-cta-ghost" onClick={onBack}>
        &larr; BACK
      </button>
    </>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────

function StepReview({
  kind,
  token,
  baseUsd,
  quoteAmount,
  quoteExpiry,
  quoteLoading,
  connected,
  err,
  onBack,
  onIssueQuote,
  onSign,
}: {
  kind: PaymentKindPriced;
  token: PaymentToken;
  baseUsd: number;
  quoteAmount: number | null;
  quoteExpiry: string | null;
  quoteLoading: boolean;
  connected: ConnectedWallet | null;
  err: string | null;
  onBack: () => void;
  onIssueQuote: () => Promise<boolean>;
  onSign: () => void;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const priceUsd = token === "LASTSHFT"
    ? +(baseUsd * (1 - LASTSHFT_DISCOUNT)).toFixed(2)
    : baseUsd;

  // Fetch quote on mount if not already fetched
  useEffect(() => {
    if (!quoteExpiry && !quoteLoading) {
      onIssueQuote();
    }
  }, [quoteExpiry, quoteLoading, onIssueQuote]);

  // Countdown timer
  useEffect(() => {
    if (!quoteExpiry) return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(quoteExpiry).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
    update();
    timerRef.current = window.setInterval(update, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [quoteExpiry]);

  const expired = countdown !== null && countdown <= 0;
  const short = connected
    ? connected.pubkey.slice(0, 6) + "\u2026" + connected.pubkey.slice(-4)
    : "";

  return (
    <>
      <div className="pay-eyebrow">&gt; REVIEW &amp; PAY</div>
      <h2 className="pay-head">
        Confirm your <span className="pay-accent">payment.</span>
      </h2>

      {connected && (
        <div className="pay-connected">
          <div className="pay-connected-dot" />
          <div>
            <div className="pay-connected-label">
              {connected.adapterName?.toUpperCase() ?? "WALLET"} &middot; CONNECTED
            </div>
            <div className="pay-connected-addr">{short}</div>
          </div>
        </div>
      )}

      <div className="pay-review">
        <div className="pay-review-row">
          <span className="pay-review-key">Type</span>
          <span className="pay-review-val">{KIND_LABELS[kind] ?? kind}</span>
        </div>
        <div className="pay-review-row">
          <span className="pay-review-key">Token</span>
          <span className="pay-review-val">{token === "LASTSHFT" ? "$LASTSHFT" : token}</span>
        </div>
        <div className="pay-review-row">
          <span className="pay-review-key">Amount</span>
          <span className="pay-review-val">
            {quoteAmount != null ? `${quoteAmount} ${token}` : `$${priceUsd.toFixed(2)} USD`}
          </span>
        </div>
        {token === "LASTSHFT" && (
          <div className="pay-review-row">
            <span className="pay-review-key">Discount</span>
            <span className="pay-review-val pay-green">40% OFF</span>
          </div>
        )}
      </div>

      {countdown !== null && (
        <div className={`pay-timer${countdown < 15 ? " pay-timer-warn" : ""}`}>
          {expired
            ? "QUOTE EXPIRED — go back and retry"
            : `Quote expires in ${countdown}s`}
        </div>
      )}

      {err && <div className="pay-error">{err}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button type="button" className="pay-cta-ghost" onClick={onBack} style={{ flex: "0 0 auto" }}>
          &larr; BACK
        </button>
        <button
          type="button"
          className="pay-cta"
          style={{ flex: 1 }}
          disabled={quoteLoading || expired || !quoteExpiry}
          onClick={onSign}
        >
          {quoteLoading ? "GETTING QUOTE\u2026" : "> SIGN & PAY"}
        </button>
      </div>
    </>
  );
}

// ─── Step 4: Signing ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<PaymentPhase, string> = {
  idle: "PREPARING\u2026",
  building: "BUILDING TRANSACTION\u2026",
  awaiting_signature: "WAITING FOR WALLET SIGNATURE\u2026",
  broadcasting: "BROADCASTING TO SOLANA\u2026",
  confirming: "CONFIRMING ON-CHAIN\u2026",
  confirmed: "CONFIRMED",
  failed: "FAILED",
};

function StepSigning({ phase }: { phase: PaymentPhase }) {
  return (
    <div className="pay-phase">
      <div className="pay-spinner" />
      <div className="pay-phase-label">{PHASE_LABELS[phase]}</div>
      <p className="pay-sub" style={{ marginTop: 12 }}>
        {phase === "awaiting_signature"
          ? "Check your wallet for the signature prompt."
          : "Do not close this window."}
      </p>
    </div>
  );
}

// ─── Step 5: Outcome ──────────────────────────────────────────────────────

const FAILURE_MESSAGES: Record<PaymentFailure, string> = {
  user_rejected: "You cancelled the transaction in your wallet.",
  insufficient_balance: "Not enough balance to cover this payment.",
  blockhash_expired: "Transaction expired before confirmation. Try again.",
  tx_reverted: "Transaction reverted on-chain. Funds were not taken.",
  rpc_degraded: "Solana RPC is slow or unreachable. Try again shortly.",
  quote_expired_hard: "Quote expired. Go back and request a new one.",
  lock_lost: "Quote was already used. Go back and request a new one.",
  signature_invalid: "Wallet signature did not match. Try reconnecting.",
  unknown: "Something went wrong. Try again.",
};

function StepOutcome({
  phase,
  failure,
  signature,
  solscanUrl,
  onClose,
  onRetry,
}: {
  phase: PaymentPhase;
  failure: PaymentFailure | null;
  signature: string | null;
  solscanUrl: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (phase === "confirmed") {
    const short = signature
      ? signature.slice(0, 8) + "\u2026" + signature.slice(-8)
      : "";

    return (
      <div className="pay-confirmed">
        <div className="pay-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="pay-eyebrow" style={{ textAlign: "center" }}>&gt; PAYMENT CONFIRMED</div>
        <h2 className="pay-head">Done.</h2>
        <p className="pay-sub">
          Your payment has been confirmed on-chain.
        </p>

        {signature && (
          <div className="pay-review" style={{ marginBottom: 18 }}>
            <div className="pay-review-row">
              <span className="pay-review-key">Signature</span>
              <span className="pay-review-val" style={{ fontFamily: "monospace", fontSize: 11 }}>
                {short}
              </span>
            </div>
            {solscanUrl && (
              <div className="pay-review-row">
                <span className="pay-review-key">Explorer</span>
                <span className="pay-review-val">
                  <a
                    href={solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--pm-accent)", textDecoration: "none" }}
                  >
                    SOLSCAN &rarr;
                  </a>
                </span>
              </div>
            )}
          </div>
        )}

        <button type="button" className="pay-cta-green" onClick={onClose}>
          &gt; CLOSE
        </button>
      </div>
    );
  }

  // Failed
  return (
    <>
      <div className="pay-eyebrow" style={{ color: "var(--pm-red)" }}>&gt; PAYMENT FAILED</div>
      <h2 className="pay-head">Something went wrong.</h2>
      <div className="pay-error">
        {failure ? FAILURE_MESSAGES[failure] : "Unknown error."}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button type="button" className="pay-cta-ghost" onClick={onClose} style={{ flex: "0 0 auto" }}>
          CLOSE
        </button>
        <button type="button" className="pay-cta" style={{ flex: 1 }} onClick={onRetry}>
          &gt; TRY AGAIN
        </button>
      </div>
    </>
  );
}
