"use client";

/**
 * MintModal — 5-step mint flow with paste-verify architecture.
 *
 * Steps:
 *   1. Info + Token Select (work item card, mint explainer, pricing, token picker) — KEPT FROM V1
 *   2. Send Payment (treasury address + exact token amount + COPY)
 *   3. Paste TX (Solscan URL or raw signature + SUBMIT)
 *   4. Terminal Cascade (poll verification status, animate checks)
 *   5. Outcome (minted receipt or failure with retry)
 *
 * Visual canon: wireframes/lastproof-mint-modal.html (Screen 1)
 * Gold theme. All CSS classes `mm-` prefixed.
 * No wallet connect. No adapter. No signing popups.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDebugLog } from "@/lib/debug/useDebugLog";
import "./mint-modal.css";
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

type MintStep = 1 | 2 | 3 | 4 | 5;

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";
const SESSION_STORAGE_PREFIX = "lp_mint_session_";

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

/** Denial messages — factual, no detail leakage. */
const DENIAL_MESSAGES: Record<string, string> = {
  tx_not_found: "TRANSACTION NOT FOUND ON SOLANA",
  tx_failed_onchain: "TRANSACTION FAILED ON-CHAIN",
  wrong_recipient: "PAYMENT NOT SENT TO LASTPROOF TREASURY",
  amount_too_low: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_too_high: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_not_found: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  tx_before_session: "Nice try. Scamming will die in web3.",
  rpc_error: "VERIFICATION INTERRUPTED — TRY AGAIN",
  config_error: "SYSTEM CONFIGURATION ERROR — CONTACT SUPPORT",
  network: "FAILED TO REACH SERVER — CHECK YOUR CONNECTION",
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
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<Record<string, unknown> | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [failureAttempt, setFailureAttempt] = useState(0);
  const [failureCheck, setFailureCheck] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [showFailure, setShowFailure] = useState(false);

  const debug = useDebugLog();
  useEffect(() => {
    if (open) debug.log("proof_flow", "mint_modal_open", { workItemId, ticker });
    return () => { if (open) { debug.log("proof_flow", "mint_modal_close", { step }); debug.flush(); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Session anti-scam
  const [sessionId, setSessionId] = useState<string | null>(null);
  const storageKey = `${SESSION_STORAGE_PREFIX}${workItemId}`;

  const maxMints = 4;
  const availableMints = maxMints - mintedCount;
  const basePrice = BASE_PRICES_USD.mint;
  const discountedPrice = priceFor("mint", "LASTSHFT");

  const shellRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setToken("LASTSHFT");
      setVerificationId(null);
      setPaymentData(null);
      setSolscanUrl(null);
      setFailureAttempt(0);
      setFailureCheck(null);
      setFailureDetail(null);
      setShowFailure(false);
      setSessionId(null);
    }
  }, [open]);

  // Create session on open
  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { session_id: string; opened_at: string };
        setSessionId(parsed.session_id);
        return;
      }
    } catch { /* no stored session */ }

    fetch("/api/payment/session-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "mint", ref_id: workItemId }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; session_id?: string; opened_at?: string }) => {
        if (data.ok && data.session_id) {
          setSessionId(data.session_id);
          try {
            localStorage.setItem(storageKey, JSON.stringify({ session_id: data.session_id, opened_at: data.opened_at }));
          } catch { /* storage full */ }
        }
      })
      .catch(() => {});
  }, [open, workItemId, storageKey]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step < 4) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, step, onClose]);

  // ─── Submit TX signature ──────────────────────────────────────────
  const handleSubmit = useCallback(
    async (signatureInput: string) => {
      if (!sessionId) return;
      debug.log("proof_flow", "mint_submit", { token, workItemId, attempt: failureAttempt });
      try {
        const res = await fetch("/api/payment/paste-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: signatureInput,
            kind: "mint",
            token,
            ref_id: workItemId,
            session_id: sessionId,
            deep: failureAttempt >= 1,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          verification_id?: string;
          error?: string;
          status?: string;
          payment_id?: string;
          sender_wallet?: string;
        };

        if (!data.ok) {
          debug.log("error", "mint_submit_failed", { error: data.error, attempt: failureAttempt + 1 });
          setFailureAttempt((a) => a + 1);
          setFailureCheck(data.error ?? "unknown");
          setFailureDetail(data.error ?? "Submission failed.");
          setShowFailure(true);
          return;
        }

        debug.log("proof_flow", "mint_submit_ok", { status: data.status, instant: data.status === "verified" });
        // Instant verify (webhook cache hit)
        if (data.status === "verified" && data.payment_id) {
          try { localStorage.removeItem(storageKey); } catch {}
          setPaymentData({
            payment_id: data.payment_id,
            sender_wallet: data.sender_wallet ?? "",
            tx_signature: signatureInput,
          });
          setStep(5);
          return;
        }

        setVerificationId(data.verification_id!);
        setShowFailure(false);
        setStep(4);
      } catch {
        setFailureAttempt((a) => a + 1);
        setFailureCheck("network");
        setFailureDetail("Failed to reach the server.");
        setShowFailure(true);
      }
    },
    [token, workItemId, sessionId, failureAttempt, storageKey],
  );

  const handleVerified = useCallback(
    (data: Record<string, unknown>, sUrl: string | null) => {
      debug.log("proof_flow", "mint_verified", { payment_id: data.payment_id, solscan: sUrl });
      try { localStorage.removeItem(storageKey); } catch {}
      setPaymentData(data);
      setSolscanUrl(sUrl);
      setStep(5);
    },
    [storageKey, debug],
  );

  const handleTerminalFailed = useCallback(
    (check: string, detail: string, attempt: number) => {
      debug.log("error", "mint_terminal_failed", { check, detail, attempt });
      setFailureAttempt(attempt);
      setFailureCheck(check);
      setFailureDetail(detail);
      setShowFailure(true);
      setStep(3);
    },
    [debug],
  );

  const handleBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) { setStep(2); setShowFailure(false); }
  }, [step]);

  if (!open) return null;

  return createPortal(
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

        {/* STEP COUNTER + PROGRESS */}
        <div className="mm-ref-row">
          <span />
          <span className="mm-step-counter">
            STEP <span className="mm-step-now">{step}</span> / 5
          </span>
        </div>
        <div className="mm-progress-wrap">
          <div className="mm-bar-track">
            <div className="mm-bar-fill" style={{ width: `${(step / 5) * 100}%` }} />
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
            <Step2Send kind="mint" token={token as PaymentToken} />
          )}
          {step === 3 && (
            <Step3Paste
              onSubmit={handleSubmit}
              failureCheck={showFailure ? failureCheck : null}
              failureDetail={showFailure ? failureDetail : null}
              failureAttempt={failureAttempt}
            />
          )}
          {step === 4 && verificationId && (
            <Step4Terminal
              verificationId={verificationId}
              onVerified={handleVerified}
              onFailed={handleTerminalFailed}
            />
          )}
          {step === 5 && (
            <Step5Outcome
              paymentData={paymentData}
              solscanUrl={solscanUrl}
              ticker={ticker}
              role={role}
              proofCount={proofCount}
              token={token}
              onClose={() => { onClose(); window.location.reload(); }}
            />
          )}
        </div>

        {/* CTA ROW */}
        {step === 1 && (
          <div className="mm-cta-row">
            <button
              type="button"
              className="mm-cta"
              onClick={() => setStep(2)}
              disabled={availableMints <= 0 || proofCount < 1}
            >
              &gt; CONTINUE TO REVIEW
            </button>
          </div>
        )}
        {(step === 2 || step === 3) && (
          <div className="mm-cta-row" style={{ display: "flex", gap: 10 }}>
            <button type="button" className="mm-btn-back" onClick={handleBack}>
              &larr; BACK
            </button>
            {step === 2 && (
              <button type="button" className="mm-cta" style={{ flex: 1 }} onClick={() => setStep(3)}>
                &gt; SUBMIT TRANSACTION RECEIPT
              </button>
            )}
          </div>
        )}

        {/* Fine print */}
        {step <= 2 && (
          <div className="mm-fine">
            MINTING IS PERMANENT &middot; MAX 4 PER PROFILE &middot; REQUIRES 1+ PROOF
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Screen 1: Info + Token Select (KEPT FROM V1) ───────────────────────

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

// ─── Screen 2: Send Payment ─────────────────────────────────────────────

function Step2Send({ kind, token }: { kind: string; token: PaymentToken }) {
  const [copied, setCopied] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number | null>(null);
  const [rateUsd, setRateUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUsd = BASE_PRICES_USD[kind as keyof typeof BASE_PRICES_USD] ?? 1;
  const priceUsd = token === "LASTSHFT"
    ? +(baseUsd * (1 - LASTSHFT_DISCOUNT)).toFixed(2)
    : baseUsd;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payment/convert?kind=${kind}&token=${token}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; token_amount?: number; rate_usd?: number }) => {
        if (data.ok) {
          setTokenAmount(data.token_amount ?? null);
          setRateUsd(data.rate_usd ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [kind, token]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(TREASURY_WALLET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);

  const handleCopyAmount = useCallback(() => {
    if (tokenAmount !== null) {
      navigator.clipboard.writeText(formatTokenAmount(tokenAmount, token)).catch(() => {});
    }
  }, [tokenAmount, token]);

  return (
    <>
      <div className="mm-eyebrow">&gt; SEND PAYMENT</div>
      <h2 className="mm-head">
        Send and <span className="mm-gold">come back.</span>
      </h2>

      <div className="mm-review-card">
        <div className="mm-review-row">
          <span className="mm-review-key">SEND TO</span>
          <span className="mm-review-val" style={{ fontSize: 10, wordBreak: "break-all", fontFamily: "var(--mono)" }}>
            {TREASURY_WALLET}
            <button
              type="button"
              className="mm-btn-back"
              style={{ marginLeft: 8, padding: "2px 8px", fontSize: 9 }}
              onClick={handleCopy}
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">AMOUNT</span>
          <span className="mm-review-val mm-gold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? (
              <span style={{ opacity: 0.5 }}>calculating…</span>
            ) : tokenAmount !== null ? (
              <>
                <span>{formatTokenAmount(tokenAmount, token)} {token}</span>
                <button
                  type="button"
                  className="mm-btn-back"
                  style={{ padding: "2px 8px", fontSize: 9 }}
                  onClick={handleCopyAmount}
                >
                  COPY
                </button>
              </>
            ) : (
              <span>${priceUsd.toFixed(2)} in {token}</span>
            )}
          </span>
        </div>
        <div className="mm-review-row">
          <span className="mm-review-key">USD VALUE</span>
          <span className="mm-review-val">
            ${priceUsd.toFixed(2)}
            {rateUsd !== null && token !== "USDT" && (
              <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 10 }}>
                (1 {token} ≈ ${rateUsd.toFixed(token === "LASTSHFT" ? 6 : 2)})
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: "var(--mm-sub)" }}>
        <div>• Send the exact amount in one transaction</div>
        <div>• Save your Solscan link or TX signature</div>
        <div>• Come back here when you&apos;re done</div>
      </div>
    </>
  );
}

// ─── Screen 3: Paste TX ─────────────────────────────────────────────────

function Step3Paste({
  onSubmit,
  failureCheck,
  failureDetail,
  failureAttempt,
}: {
  onSubmit: (signature: string) => void;
  failureCheck: string | null;
  failureDetail: string | null;
  failureAttempt: number;
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    await onSubmit(trimmed);
    setSubmitting(false);
  }, [input, submitting, onSubmit]);

  const hasFailure = failureCheck !== null;

  return (
    <>
      <div className="mm-eyebrow">&gt; VERIFY YOUR PAYMENT</div>
      <h2 className="mm-head">
        Paste your <span className="mm-gold">transaction.</span>
      </h2>

      {hasFailure && (
        <div style={{
          marginBottom: 14,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--mm-red)",
          borderLeft: "2px solid var(--mm-red)",
          background: "rgba(255,84,112,0.05)",
        }}>
          <strong>&gt; ✕ {DENIAL_MESSAGES[failureCheck] ?? failureDetail ?? "VERIFICATION FAILED"}</strong>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label className="mm-field-help" style={{ display: "block", marginBottom: 6 }}>
          TRANSACTION SIGNATURE
        </label>
        <textarea
          placeholder="Paste Solscan URL or transaction signature…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="url"
          className="mm-paste-input"
        />
        <div className="mm-field-help" style={{ marginTop: 4 }}>
          SOLSCAN · SOLANA EXPLORER · SOLANA.FM · RAW SIGNATURE
        </div>
      </div>

      <button
        type="button"
        className="mm-cta"
        disabled={!input.trim() || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "> SUBMITTING…" : "> SUBMIT"}
      </button>

      {hasFailure && failureAttempt >= 3 && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a
            className="mm-btn-back"
            style={{ display: "inline-block", textDecoration: "none", padding: "8px 12px", fontSize: 11 }}
            href={`mailto:reportclaims@lastproof.app?subject=Mint%20Verification%20Failed&body=${encodeURIComponent(`Check: ${failureCheck}\nDetail: ${failureDetail}\nAttempts: ${failureAttempt}`)}`}
          >
            &gt; OPEN SUPPORT TICKET
          </a>
        </div>
      )}
    </>
  );
}

// ─── Screen 4: Terminal Cascade ─────────────────────────────────────────

interface StatusResponse {
  ok: boolean;
  status: "queued" | "processing" | "verified" | "failed";
  failure_check?: string;
  failure_detail?: string;
  attempt_number?: number;
  payment_id?: string;
  solscan_url?: string | null;
  payment_data?: Record<string, unknown> | null;
}

interface TerminalLine {
  text: string;
  status: "ok" | "fail" | "info";
}

const VERIFY_CHECKS = [
  "SCANNING SOLANA MAINNET FOR TX...",
  "TX LOCATED",
  "CHECKING RECIPIENT... ✓ CONFIRMED",
  "CHECKING AMOUNT... ✓ CONFIRMED",
  "CHECKING TIME WINDOW... ✓ CONFIRMED",
  "ALL CHECKS PASSED",
];

const DEPLOY_LINES = [
  "PROCESSING MINT PAYMENT...",
  "WRITING TO PAYMENT LEDGER...",
  "SETTING MINTED FLAG ON WORK ITEM...",
  "UPDATING OPERATOR PROFILE...",
  "MINT CONFIRMED — LIVE ON PROFILE",
];

function Step4Terminal({
  verificationId,
  onVerified,
  onFailed,
}: {
  verificationId: string;
  onVerified: (data: Record<string, unknown>, solscanUrl: string | null) => void;
  onFailed: (check: string, detail: string, attempt: number) => void;
}) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: "INITIATING MINT VERIFICATION...", status: "info" },
  ]);
  const [phase, setPhase] = useState<"verifying" | "deploying" | "done" | "failed">("verifying");
  const [doneData, setDoneData] = useState<{ data: Record<string, unknown>; url: string | null } | null>(null);

  useEffect(() => {
    let done = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const cascadeTimers: ReturnType<typeof setInterval>[] = [];

    function cascade(newLines: TerminalLine[], delayMs: number, onDone?: () => void) {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= newLines.length) { clearInterval(timer); onDone?.(); return; }
        const line = newLines[i];
        if (line) setLines((prev) => [...prev, line]);
        i++;
      }, delayMs);
      cascadeTimers.push(timer);
    }

    async function poll() {
      if (done) return;
      try {
        const res = await fetch(`/api/payment/paste-verify/status?id=${verificationId}`);
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;

        if (data.status === "verified" && data.payment_data) {
          done = true;
          if (pollTimer) clearInterval(pollTimer);

          cascade(
            VERIFY_CHECKS.map((t) => ({ text: `> ${t}`, status: "ok" as const })),
            250,
            () => {
              setPhase("deploying");
              cascade(
                DEPLOY_LINES.map((t) => ({ text: `> ${t}`, status: "ok" as const })),
                300,
                () => {
                  setPhase("done");
                  setDoneData({ data: data.payment_data!, url: data.solscan_url ?? null });
                },
              );
            },
          );
        }

        if (data.status === "failed") {
          done = true;
          if (pollTimer) clearInterval(pollTimer);
          const msg = DENIAL_MESSAGES[data.failure_check ?? ""] ?? data.failure_detail ?? "Verification failed.";
          setLines((prev) => [...prev, { text: `> ✕ ${msg}`, status: "fail" }]);
          setPhase("failed");
          setTimeout(() => onFailed(data.failure_check ?? "unknown", data.failure_detail ?? "", data.attempt_number ?? 1), 1500);
        }
      } catch { /* retry next poll */ }
    }

    poll();
    pollTimer = setInterval(poll, 2500);
    return () => {
      done = true;
      if (pollTimer) clearInterval(pollTimer);
      cascadeTimers.forEach((t) => clearInterval(t));
    };
  }, [verificationId, onFailed]);

  return (
    <>
      <div className="mm-term">
        <div style={{ opacity: 0.5 }}>&gt; lastproof mint --tx {verificationId.slice(0, 8)}…</div>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: line.status === "ok" ? "var(--mm-green)" : line.status === "fail" ? "var(--mm-red)" : "var(--mm-fg)",
          }}>
            {line.text}
          </div>
        ))}
        {phase === "verifying" && (
          <div style={{ color: "var(--mm-fg)" }}>
            {"  > WAITING FOR VERIFICATION"}<AnimatedDots />
          </div>
        )}
      </div>

      {phase === "done" && doneData && (
        <button
          type="button"
          className="mm-cta mm-ok-back"
          style={{ marginTop: 14 }}
          onClick={() => onVerified(doneData.data, doneData.url)}
        >
          &gt; CONFIRM
        </button>
      )}

      {phase !== "done" && phase !== "failed" && (
        <div className="mm-field-help" style={{ textAlign: "center", marginTop: 14 }}>
          DO NOT CLOSE THIS WINDOW · VERIFICATION IN PROGRESS
        </div>
      )}
    </>
  );
}

// ─── Screen 5: Outcome ──────────────────────────────────────────────────

function Step5Outcome({
  paymentData,
  solscanUrl,
  ticker,
  role,
  proofCount,
  token,
  onClose,
}: {
  paymentData: Record<string, unknown> | null;
  solscanUrl: string | null;
  ticker: string;
  role: string;
  proofCount: number;
  token: ProofTokenKey;
  onClose: () => void;
}) {
  const txSig = (paymentData?.tx_signature as string) ?? "";
  const url = solscanUrl ?? (txSig ? `https://solscan.io/tx/${txSig}` : null);
  const shortSig = txSig.length > 12 ? `${txSig.slice(0, 4)}…${txSig.slice(-4)}` : txSig;

  return (
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
          <span className="mm-ps-val mm-green">{ticker} · {role}</span>
        </div>
        <div className="mm-ps-row">
          <span className="mm-ps-key">STATUS</span>
          <span className="mm-ps-val mm-gold">MINTED ✦</span>
        </div>
        <div className="mm-ps-row">
          <span className="mm-ps-key">PROOFS</span>
          <span className="mm-ps-val mm-green">{proofCount} VERIFIED</span>
        </div>
        <div className="mm-ps-row">
          <span className="mm-ps-key">TOKEN</span>
          <span className="mm-ps-val">{token}</span>
        </div>
        {url && shortSig && (
          <div className="mm-ps-row">
            <span className="mm-ps-key">SOLSCAN</span>
            <span className="mm-ps-val">
              <a href={url} target="_blank" rel="noreferrer">{shortSig} ↗</a>
            </span>
          </div>
        )}
      </div>

      <div className="mm-ok-actions">
        <button type="button" className="mm-cta mm-ok-back" onClick={onClose}>
          &gt; BACK TO DASHBOARD
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function AnimatedDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ display: "inline-block", width: "1.5em" }}>{".".repeat(count)}</span>;
}

function formatTokenAmount(amount: number, token: PaymentToken): string {
  if (token === "USDT") return amount.toFixed(2);
  if (token === "SOL") return amount.toFixed(6);
  if (amount >= 100) return amount.toFixed(2);
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(6);
}
