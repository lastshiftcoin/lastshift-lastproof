"use client";

/**
 * HandleChangeModal — 6-screen paste-verify flow for handle changes ($100).
 *
 * Screens:
 *   1. Eligibility check (cooldown gate — blocks if on cooldown)
 *   2. Handle setup (onboarding-style input with live availability)
 *   3. Token select ($100/$60 with LASTSHFT)
 *   4. Send payment (treasury address + exact amount)
 *   5. Paste TX + submit
 *   6. Terminal cascade → outcome (receipt with cooldown notice)
 *
 * The modal owns the ENTIRE handle change flow — IdentityCard just opens it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDebugLog } from "@/lib/debug/useDebugLog";
import "./handle-change-modal.css";
import {
  PROOF_TOKENS,
  LASTSHFT_DISCOUNT_LABEL,
  BUY_LASTSHFT_URL,
  type ProofTokenKey,
} from "@/lib/proof-tokens";
import {
  BASE_PRICES_USD,
  LASTSHFT_DISCOUNT,
  HANDLE_CHANGE_COOLDOWN_DAYS,
  priceFor,
  type PaymentToken,
} from "@/lib/pricing";

type HcStep = 1 | 2 | 3 | 4 | 5 | 6;

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";
const SESSION_STORAGE_PREFIX = "lp_hc_session_";

export interface HandleChangeModalProps {
  open: boolean;
  onClose: () => void;
  oldHandle: string;
  onSuccess?: () => void;
}

const DENIAL_MESSAGES: Record<string, string> = {
  tx_not_found: "TRANSACTION NOT FOUND ON SOLANA",
  tx_failed_onchain: "TRANSACTION FAILED ON-CHAIN",
  wrong_recipient: "PAYMENT NOT SENT TO LASTPROOF TREASURY",
  amount_too_low: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_too_high: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_not_found: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  tx_before_session: "Nice try. Scamming will die in web3.",
  rpc_error: "VERIFICATION INTERRUPTED — TRY AGAIN",
};

export function HandleChangeModal({
  open,
  onClose,
  oldHandle,
  onSuccess,
}: HandleChangeModalProps) {
  const [step, setStep] = useState<HcStep>(1);
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");

  // Screen 1: cooldown
  const [cooldown, setCooldown] = useState<{ eligible: boolean; daysRemaining: number } | null>(null);
  const [cooldownLoading, setCooldownLoading] = useState(true);

  // Screen 2: handle input
  const [newHandle, setNewHandle] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [validating, setValidating] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paste-verify state
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<Record<string, unknown> | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [failureAttempt, setFailureAttempt] = useState(0);
  const [failureCheck, setFailureCheck] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [showFailure, setShowFailure] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const debug = useDebugLog();
  useEffect(() => {
    if (open) debug.log("proof_flow", "handle_change_modal_open", { oldHandle });
    return () => { if (open) { debug.log("proof_flow", "handle_change_modal_close", { step }); debug.flush(); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const basePrice = BASE_PRICES_USD.handle_change;
  const discountedPrice = priceFor("handle_change", "LASTSHFT");
  const shellRef = useRef<HTMLDivElement | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1); setToken("LASTSHFT"); setCooldown(null); setCooldownLoading(true);
      setNewHandle(null); setHandleInput(""); setHandleStatus("idle");
      setValidating(false); setScreenError(null);
      setVerificationId(null); setPaymentData(null); setSolscanUrl(null);
      setFailureAttempt(0); setFailureCheck(null); setFailureDetail(null);
      setShowFailure(false); setConfirmed(false); setSessionId(null);
    }
  }, [open]);

  // Fetch cooldown on open
  useEffect(() => {
    if (!open) return;
    setCooldownLoading(true);
    fetch("/api/dashboard/handle-change")
      .then((r) => r.json())
      .then((data: { cooldown?: { eligible: boolean; daysRemaining: number } }) => {
        if (data.cooldown) setCooldown(data.cooldown);
        setCooldownLoading(false);
      })
      .catch(() => setCooldownLoading(false));
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && step < 6) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  // ─── Screen 2: handle input with debounced availability ───────────
  const onHandleInputChange = useCallback((val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    setHandleInput(clean);
    setHandleStatus("idle");
    setScreenError(null);

    if (handleCheckTimer.current) clearTimeout(handleCheckTimer.current);
    if (clean.length < 3) return;

    setHandleStatus("checking");
    handleCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-handle?handle=${clean}`);
        const data = await res.json();
        setHandleStatus(data.available ? "available" : "taken");
      } catch {
        setHandleStatus("idle");
      }
    }, 400);
  }, []);

  // ─── Screen 2 → 3: validate handle then advance ──────────────────
  const handleValidateAndContinue = useCallback(async () => {
    if (!handleInput || handleStatus !== "available") return;
    setValidating(true);
    setScreenError(null);

    try {
      const res = await fetch("/api/dashboard/handle-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newHandle: handleInput }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "cooldown_active") {
          setCooldown({ eligible: false, daysRemaining: data.daysRemaining ?? 0 });
          setStep(1);
        } else if (data.error === "handle_taken") {
          setHandleStatus("taken");
          setScreenError("That handle was just taken.");
        } else {
          setScreenError(data.error || "Handle validation failed.");
        }
        return;
      }

      const data = await res.json();
      setNewHandle(data.validatedHandle);
      setStep(3);
    } catch {
      setScreenError("Handle change failed — please try again.");
    } finally {
      setValidating(false);
    }
  }, [handleInput, handleStatus]);

  // ─── Create session when advancing to Screen 4 ────────────────────
  const advanceToSend = useCallback(() => {
    if (!newHandle) return;
    const key = `${SESSION_STORAGE_PREFIX}${newHandle}`;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as { session_id: string };
        setSessionId(parsed.session_id);
        setStep(4);
        return;
      }
    } catch {}

    fetch("/api/payment/session-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "handle_change", ref_id: newHandle }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; session_id?: string; opened_at?: string }) => {
        if (data.ok && data.session_id) {
          setSessionId(data.session_id);
          debug.log("proof_flow", "handle_change_session_start_ok", { session_id: data.session_id });
          try { localStorage.setItem(key, JSON.stringify({ session_id: data.session_id, opened_at: data.opened_at })); } catch {}
          setStep(4);
        }
      })
      .catch((err) => { debug.log("error", "handle_change_session_start_failed", { error: String(err) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newHandle]);

  // ─── Submit TX ────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (signatureInput: string) => {
      if (!sessionId || !newHandle) return;
      debug.log("proof_flow", "handle_change_submit", { token, newHandle, attempt: failureAttempt });
      const key = `${SESSION_STORAGE_PREFIX}${newHandle}`;
      try {
        const res = await fetch("/api/payment/paste-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: signatureInput, kind: "handle_change", token,
            ref_id: newHandle, session_id: sessionId, deep: failureAttempt >= 1,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean; verification_id?: string; error?: string;
          status?: string; payment_id?: string; sender_wallet?: string;
        };

        if (!data.ok) {
          debug.log("error", "handle_change_submit_failed", { error: data.error, attempt: failureAttempt + 1 });
          setFailureAttempt((a) => a + 1);
          setFailureCheck(data.error ?? "unknown");
          setFailureDetail(data.error ?? "Submission failed.");
          setShowFailure(true);
          return;
        }

        debug.log("proof_flow", "handle_change_submit_ok", { status: data.status, instant: data.status === "verified" });
        if (data.status === "verified" && data.payment_id) {
          try { localStorage.removeItem(key); } catch {}
          setPaymentData({ payment_id: data.payment_id, sender_wallet: data.sender_wallet ?? "", tx_signature: signatureInput });
          setConfirmed(true);
          setStep(6);
          return;
        }

        setVerificationId(data.verification_id!);
        setShowFailure(false);
        setStep(6);
      } catch (err) {
        debug.log("error", "handle_change_submit_network_error", { error: String(err), attempt: failureAttempt + 1 });
        setFailureAttempt((a) => a + 1);
        setFailureCheck("network");
        setFailureDetail("Failed to reach the server.");
        setShowFailure(true);
      }
    },
    [token, newHandle, sessionId, failureAttempt, debug],
  );

  const handleVerified = useCallback(
    (data: Record<string, unknown>, sUrl: string | null) => {
      debug.log("proof_flow", "handle_change_verified", { payment_id: data.payment_id, newHandle });
      if (newHandle) { try { localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${newHandle}`); } catch {} }
      setPaymentData(data);
      setSolscanUrl(sUrl);
      setConfirmed(true);
    },
    [newHandle, debug],
  );

  const handleTerminalFailed = useCallback(
    (check: string, detail: string, attempt: number) => {
      debug.log("error", "handle_change_terminal_failed", { check, detail, attempt });
      setFailureAttempt(attempt);
      setFailureCheck(check);
      setFailureDetail(detail);
      setShowFailure(true);
      setStep(5);
    },
    [debug],
  );

  const handleBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
    else if (step === 5) { setStep(4); setShowFailure(false); }
  }, [step]);

  if (!open) return null;

  const cooldownDate = new Date(Date.now() + HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return createPortal(
    <div className="hc-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hc-shell" ref={shellRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="hc-bar">
          <div className="hc-bar-left">
            <div className="hc-dots" aria-hidden="true"><span className="hc-dot-r" /><span className="hc-dot-y" /><span className="hc-dot-g" /></div>
            <span className="hc-bar-title">lastproof — handle change</span>
          </div>
          <div className="hc-bar-right">
            <button type="button" className="hc-bar-close" onClick={onClose}>CLOSE</button>
          </div>
        </div>

        <div className="hc-ref-row">
          <span />
          <span className="hc-step-counter">STEP <span className="hc-step-now">{step}</span> / 6</span>
        </div>
        <div className="hc-progress-wrap">
          <div className="hc-bar-track">
            <div className="hc-bar-fill" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </div>

        <div className="hc-body">
          {step === 1 && (
            <HcStep1Eligibility
              cooldown={cooldown}
              cooldownLoading={cooldownLoading}
              basePrice={basePrice}
              discountedPrice={discountedPrice}
            />
          )}
          {step === 2 && (
            <HcStep2HandleInput
              oldHandle={oldHandle}
              handleInput={handleInput}
              handleStatus={handleStatus}
              onInputChange={onHandleInputChange}
              screenError={screenError}
            />
          )}
          {step === 3 && newHandle && (
            <HcStep3Token
              oldHandle={oldHandle}
              newHandle={newHandle}
              basePrice={basePrice}
              discountedPrice={discountedPrice}
              token={token}
              onPickToken={setToken}
            />
          )}
          {step === 4 && (
            <HcStep4Send token={token as PaymentToken} />
          )}
          {step === 5 && (
            <HcStep5Paste
              onSubmit={handleSubmit}
              failureCheck={showFailure ? failureCheck : null}
              failureDetail={showFailure ? failureDetail : null}
              failureAttempt={failureAttempt}
            />
          )}
          {step === 6 && !confirmed && verificationId && (
            <HcStep6Terminal
              verificationId={verificationId}
              oldHandle={oldHandle}
              newHandle={newHandle ?? ""}
              onVerified={handleVerified}
              onFailed={handleTerminalFailed}
            />
          )}
          {step === 6 && confirmed && (
            <HcOutcome
              oldHandle={oldHandle}
              newHandle={newHandle ?? ""}
              paymentData={paymentData}
              solscanUrl={solscanUrl}
              token={token}
              cooldownDate={cooldownDate}
              onClose={() => { onClose(); onSuccess?.(); window.location.reload(); }}
            />
          )}
        </div>

        {/* CTA ROW */}
        {step === 1 && cooldown?.eligible && (
          <div className="hc-cta-row">
            <button type="button" className="hc-cta" onClick={() => setStep(2)}>&gt; NEXT</button>
          </div>
        )}
        {step === 2 && (
          <div className="hc-cta-row" style={{ display: "flex", gap: 10 }}>
            <button type="button" className="hc-btn-back" onClick={handleBack}>&larr; BACK</button>
            <button type="button" className="hc-cta" style={{ flex: 1 }}
              disabled={handleStatus !== "available" || handleInput.length < 3 || validating}
              onClick={handleValidateAndContinue}>
              {validating ? "> VALIDATING…" : "> NEXT"}
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="hc-cta-row" style={{ display: "flex", gap: 10 }}>
            <button type="button" className="hc-btn-back" onClick={handleBack}>&larr; BACK</button>
            <button type="button" className="hc-cta" style={{ flex: 1 }} onClick={advanceToSend}>&gt; CONTINUE</button>
          </div>
        )}
        {(step === 4 || step === 5) && (
          <div className="hc-cta-row" style={{ display: "flex", gap: 10 }}>
            <button type="button" className="hc-btn-back" onClick={handleBack}>&larr; BACK</button>
            {step === 4 && (
              <button type="button" className="hc-cta" style={{ flex: 1 }} onClick={() => setStep(5)}>
                &gt; SUBMIT TRANSACTION RECEIPT
              </button>
            )}
          </div>
        )}

        {step <= 3 && (
          <div className="hc-fine">HANDLE CHANGE IS PERMANENT · 90-DAY COOLDOWN · $100 / $60 WITH $LASTSHFT</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Screen 1: Eligibility Check ────────────────────────────────────────

function HcStep1Eligibility({
  cooldown, cooldownLoading, basePrice, discountedPrice,
}: {
  cooldown: { eligible: boolean; daysRemaining: number } | null;
  cooldownLoading: boolean;
  basePrice: number;
  discountedPrice: number;
}) {
  if (cooldownLoading) {
    return (
      <>
        <div className="hc-eyebrow">&gt; HANDLE CHANGE</div>
        <h2 className="hc-head">Checking <span className="hc-accent">eligibility</span><AnimatedDots /></h2>
      </>
    );
  }

  if (cooldown && !cooldown.eligible) {
    return (
      <>
        <div className="hc-eyebrow">&gt; HANDLE CHANGE</div>
        <h2 className="hc-head">Cooldown <span className="hc-red">active.</span></h2>
        <div className="hc-warning">
          <strong>⚠ {cooldown.daysRemaining} DAYS REMAINING</strong>
          <p>Handle changes are limited to once every 90 days. You cannot change your handle until the cooldown expires.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hc-eyebrow">&gt; HANDLE CHANGE</div>
      <h2 className="hc-head">Change your <span className="hc-accent">@handle.</span></h2>
      <p className="hc-sub">
        This costs <strong>${basePrice}</strong> (or <strong>${discountedPrice}</strong> with $LASTSHFT).
        A 90-day cooldown starts after each change.
      </p>
      <div className="hc-warning">
        <strong>⚠ 90-DAY COOLDOWN</strong>
        <p>You will not be able to change your handle again for 90 days after this change. Choose carefully.</p>
      </div>
    </>
  );
}

// ─── Screen 2: Handle Input (onboarding-style) ─────────────────────────

function HcStep2HandleInput({
  oldHandle, handleInput, handleStatus, onInputChange, screenError,
}: {
  oldHandle: string;
  handleInput: string;
  handleStatus: "idle" | "checking" | "available" | "taken";
  onInputChange: (val: string) => void;
  screenError: string | null;
}) {
  const wrapClass = handleStatus === "available" ? "hc-handle-wrap ok" :
    handleStatus === "taken" ? "hc-handle-wrap taken" : "hc-handle-wrap";

  const statusClass = handleStatus === "available" ? "hc-handle-status ok" :
    handleStatus === "taken" ? "hc-handle-status taken" : "hc-handle-status";

  const statusText = handleStatus === "checking" ? "CHECKING..." :
    handleStatus === "available" ? "AVAILABLE" :
    handleStatus === "taken" ? "TAKEN" : "3-20 CHARS";

  return (
    <>
      <div className="hc-eyebrow">&gt; PICK YOUR NEW HANDLE</div>
      <h2 className="hc-head">
        Current: <span className="hc-dim">@{oldHandle}</span>
      </h2>

      {screenError && (
        <div className="hc-error"><strong>{screenError}</strong></div>
      )}

      <label className="hc-field-help" style={{ display: "block", marginBottom: 8 }}>YOUR NEW HANDLE</label>
      <div className={wrapClass}>
        <div className="hc-handle-prefix">
          lastproof.app/<span className="hc-at">@</span>
        </div>
        <input
          className="hc-handle-input"
          type="text"
          value={handleInput}
          onChange={(e) => onInputChange(e.target.value)}
          maxLength={20}
          placeholder="yourhandle"
          autoFocus
        />
        <div className={statusClass}>
          <span className="hc-check-dot" />
          {statusText}
        </div>
      </div>

      <div className="hc-field-help" style={{ marginTop: 8 }}>
        3–20 characters · lowercase · letters, numbers, underscores
      </div>
    </>
  );
}

// ─── Screen 3: Token Select ─────────────────────────────────────────────

function HcStep3Token({
  oldHandle, newHandle, basePrice, discountedPrice, token, onPickToken,
}: {
  oldHandle: string; newHandle: string; basePrice: number; discountedPrice: number;
  token: ProofTokenKey; onPickToken: (t: ProofTokenKey) => void;
}) {
  return (
    <>
      <div className="hc-eyebrow">&gt; SELECT TOKEN</div>
      <h2 className="hc-head">
        <span className="hc-dim">@{oldHandle}</span> → <span className="hc-accent">@{newHandle}</span>
      </h2>

      <div className="hc-price-row">
        <div className="hc-price-item">
          <div className="hc-price-amount">${basePrice.toFixed(0)}</div>
          <div className="hc-price-label">SOL / USDT</div>
        </div>
        <div className="hc-price-divider" />
        <div className="hc-price-item">
          <div className="hc-price-amount hc-disc">${discountedPrice.toFixed(0)}</div>
          <div className="hc-price-label">WITH <span className="hc-accent">$LASTSHFT</span> · {LASTSHFT_DISCOUNT_LABEL}</div>
        </div>
      </div>

      <div className="hc-tokens">
        {PROOF_TOKENS.map((t) => {
          const isSelected = token === t.key;
          const price = priceFor("handle_change", t.key as PaymentToken);
          return (
            <button key={t.key} type="button" className={`hc-token${isSelected ? " hc-selected" : ""}`} onClick={() => onPickToken(t.key)}>
              <div className="hc-token-meta"><span className="hc-token-name">{t.label}</span></div>
              <span className={`hc-token-price${t.hasDiscountBadge ? " hc-discount" : ""}`}>
                ${price.toFixed(0)}
                {t.hasDiscountBadge && <span className="hc-token-strike">${basePrice.toFixed(0)}</span>}
              </span>
              {t.hasDiscountBadge && <span className="hc-token-badge">{LASTSHFT_DISCOUNT_LABEL}</span>}
            </button>
          );
        })}
      </div>
      <div className="hc-field-help" style={{ textAlign: "center" }}>
        <a href={BUY_LASTSHFT_URL} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)", textDecoration: "none" }}>NEED $LASTSHFT? → BUY HERE ↗</a>
      </div>
    </>
  );
}

// ─── Screen 4: Send Payment ─────────────────────────────────────────────

function HcStep4Send({ token }: { token: PaymentToken }) {
  const [copied, setCopied] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number | null>(null);
  const [rateUsd, setRateUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUsd = BASE_PRICES_USD.handle_change;
  const priceUsd = token === "LASTSHFT" ? +(baseUsd * (1 - LASTSHFT_DISCOUNT)).toFixed(2) : baseUsd;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payment/convert?kind=handle_change&token=${token}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; token_amount?: number; rate_usd?: number }) => {
        if (data.ok) { setTokenAmount(data.token_amount ?? null); setRateUsd(data.rate_usd ?? null); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <>
      <div className="hc-eyebrow">&gt; SEND PAYMENT</div>
      <h2 className="hc-head">Send and <span className="hc-accent">come back.</span></h2>
      <div className="hc-review">
        <div className="hc-review-row">
          <span className="hc-review-key">SEND TO</span>
          <span className="hc-review-val" style={{ fontSize: 10, wordBreak: "break-all", fontFamily: "var(--mono)" }}>
            {TREASURY_WALLET}
            <button type="button" className="hc-btn-back" style={{ marginLeft: 8, padding: "2px 8px", fontSize: 9 }}
              onClick={() => { navigator.clipboard.writeText(TREASURY_WALLET).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }}>
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </span>
        </div>
        <div className="hc-review-row">
          <span className="hc-review-key">AMOUNT</span>
          <span className="hc-review-val hc-accent" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? <span style={{ opacity: 0.5 }}>calculating…</span> : tokenAmount !== null ? (
              <>
                <span>{formatTokenAmount(tokenAmount, token)} {token}</span>
                <button type="button" className="hc-btn-back" style={{ padding: "2px 8px", fontSize: 9 }}
                  onClick={() => navigator.clipboard.writeText(formatTokenAmount(tokenAmount, token)).catch(() => {})}>COPY</button>
              </>
            ) : <span>${priceUsd.toFixed(2)} in {token}</span>}
          </span>
        </div>
        <div className="hc-review-row">
          <span className="hc-review-key">USD VALUE</span>
          <span className="hc-review-val">
            ${priceUsd.toFixed(2)}
            {rateUsd !== null && token !== "USDT" && (
              <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 10 }}>(1 {token} ≈ ${rateUsd.toFixed(token === "LASTSHFT" ? 6 : 2)})</span>
            )}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: "var(--hc-dim)" }}>
        <div>• Send the exact amount in one transaction</div>
        <div>• Save your Solscan link or TX signature</div>
        <div>• Come back here when you&apos;re done</div>
      </div>
    </>
  );
}

// ─── Screen 5: Paste TX ─────────────────────────────────────────────────

function HcStep5Paste({ onSubmit, failureCheck, failureDetail, failureAttempt }: {
  onSubmit: (sig: string) => void; failureCheck: string | null; failureDetail: string | null; failureAttempt: number;
}) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasFailure = failureCheck !== null;

  return (
    <>
      <div className="hc-eyebrow">&gt; VERIFY YOUR PAYMENT</div>
      <h2 className="hc-head">Paste your <span className="hc-accent">transaction.</span></h2>
      {hasFailure && <div className="hc-error"><strong>&gt; ✕ {DENIAL_MESSAGES[failureCheck] ?? failureDetail ?? "VERIFICATION FAILED"}</strong></div>}
      <div style={{ marginBottom: 12 }}>
        <label className="hc-field-help" style={{ display: "block", marginBottom: 6 }}>TRANSACTION SIGNATURE</label>
        <textarea placeholder="Paste Solscan URL or transaction signature…" value={input} onChange={(e) => setInput(e.target.value)} inputMode="url" className="hc-paste-input" />
        <div className="hc-field-help" style={{ marginTop: 4 }}>SOLSCAN · SOLANA EXPLORER · SOLANA.FM · RAW SIGNATURE</div>
      </div>
      <button type="button" className="hc-cta" disabled={!input.trim() || submitting}
        onClick={async () => { const t = input.trim(); if (!t || submitting) return; setSubmitting(true); await onSubmit(t); setSubmitting(false); }}>
        {submitting ? "> SUBMITTING…" : "> SUBMIT"}
      </button>
      {hasFailure && failureAttempt >= 3 && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a className="hc-btn-back" style={{ display: "inline-block", textDecoration: "none", padding: "8px 12px", fontSize: 11 }}
            href={`mailto:reportclaims@lastshift.ai?subject=Handle%20Change%20Failed&body=${encodeURIComponent(`Check: ${failureCheck}\nDetail: ${failureDetail}`)}`}>
            &gt; OPEN SUPPORT TICKET
          </a>
        </div>
      )}
    </>
  );
}

// ─── Screen 6: Terminal Cascade ─────────────────────────────────────────

interface StatusResponse { ok: boolean; status: string; failure_check?: string; failure_detail?: string; attempt_number?: number; payment_data?: Record<string, unknown> | null; solscan_url?: string | null; }
interface TermLine { text: string; status: "ok" | "fail" | "info"; }

const CHECKS = ["SCANNING SOLANA MAINNET FOR TX...", "TX LOCATED", "CHECKING RECIPIENT... ✓ CONFIRMED", "CHECKING AMOUNT... ✓ CONFIRMED", "CHECKING TIME WINDOW... ✓ CONFIRMED", "ALL CHECKS PASSED"];
const DEPLOY = (o: string, n: string) => ["PROCESSING HANDLE CHANGE...", `UPDATING @${o} → @${n}...`, "RECORDING TO HANDLE HISTORY...", "STARTING 90-DAY COOLDOWN...", "HANDLE CHANGE CONFIRMED — LIVE ON PROFILE"];

function HcStep6Terminal({ verificationId, oldHandle, newHandle, onVerified, onFailed }: {
  verificationId: string; oldHandle: string; newHandle: string;
  onVerified: (data: Record<string, unknown>, url: string | null) => void;
  onFailed: (check: string, detail: string, attempt: number) => void;
}) {
  const [lines, setLines] = useState<TermLine[]>([{ text: "INITIATING HANDLE CHANGE VERIFICATION...", status: "info" }]);
  const [phase, setPhase] = useState<"verifying" | "deploying" | "done" | "failed">("verifying");
  const [doneData, setDoneData] = useState<{ data: Record<string, unknown>; url: string | null } | null>(null);

  useEffect(() => {
    let done = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const timers: ReturnType<typeof setInterval>[] = [];

    function cascade(nl: TermLine[], ms: number, cb?: () => void) {
      let i = 0;
      const t = setInterval(() => { if (i >= nl.length) { clearInterval(t); cb?.(); return; } const l = nl[i]; if (l) setLines((p) => [...p, l]); i++; }, ms);
      timers.push(t);
    }

    async function poll() {
      if (done) return;
      try {
        const res = await fetch(`/api/payment/paste-verify/status?id=${verificationId}`);
        if (!res.ok) return;
        const d = (await res.json()) as StatusResponse;
        if (d.status === "verified" && d.payment_data) {
          done = true; if (pollTimer) clearInterval(pollTimer);
          cascade(CHECKS.map((t) => ({ text: `> ${t}`, status: "ok" as const })), 250, () => {
            setPhase("deploying");
            cascade(DEPLOY(oldHandle, newHandle).map((t) => ({ text: `> ${t}`, status: "ok" as const })), 300, () => {
              setPhase("done"); setDoneData({ data: d.payment_data!, url: d.solscan_url ?? null });
            });
          });
        }
        if (d.status === "failed") {
          done = true; if (pollTimer) clearInterval(pollTimer);
          const msg = DENIAL_MESSAGES[d.failure_check ?? ""] ?? d.failure_detail ?? "Verification failed.";
          setLines((p) => [...p, { text: `> ✕ ${msg}`, status: "fail" }]);
          setPhase("failed");
          setTimeout(() => onFailed(d.failure_check ?? "unknown", d.failure_detail ?? "", d.attempt_number ?? 1), 1500);
        }
      } catch {}
    }

    poll(); pollTimer = setInterval(poll, 2500);
    return () => { done = true; if (pollTimer) clearInterval(pollTimer); timers.forEach((t) => clearInterval(t)); };
  }, [verificationId, oldHandle, newHandle, onFailed]);

  return (
    <>
      <div className="hc-term">
        <div style={{ opacity: 0.5 }}>&gt; lastproof handle-change --tx {verificationId.slice(0, 8)}…</div>
        {lines.map((l, i) => <div key={i} style={{ color: l.status === "ok" ? "var(--hc-green)" : l.status === "fail" ? "var(--hc-red)" : "var(--hc-fg)" }}>{l.text}</div>)}
        {phase === "verifying" && <div style={{ color: "var(--hc-fg)" }}>{"  > WAITING FOR VERIFICATION"}<AnimatedDots /></div>}
      </div>
      {phase === "done" && doneData && <button type="button" className="hc-cta" style={{ marginTop: 14 }} onClick={() => onVerified(doneData.data, doneData.url)}>&gt; CONFIRM</button>}
      {phase !== "done" && phase !== "failed" && <div className="hc-field-help" style={{ textAlign: "center", marginTop: 14 }}>DO NOT CLOSE THIS WINDOW · VERIFICATION IN PROGRESS</div>}
    </>
  );
}

// ─── Outcome ────────────────────────────────────────────────────────────

function HcOutcome({ oldHandle, newHandle, paymentData, solscanUrl, token, cooldownDate, onClose }: {
  oldHandle: string; newHandle: string; paymentData: Record<string, unknown> | null;
  solscanUrl: string | null; token: ProofTokenKey; cooldownDate: string; onClose: () => void;
}) {
  const txSig = (paymentData?.tx_signature as string) ?? "";
  const url = solscanUrl ?? (txSig ? `https://solscan.io/tx/${txSig}` : null);
  const shortSig = txSig.length > 12 ? `${txSig.slice(0, 4)}…${txSig.slice(-4)}` : txSig;

  return (
    <div style={{ textAlign: "center" }}>
      <div className="hc-done-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
      <div className="hc-eyebrow" style={{ color: "var(--hc-green)" }}>HANDLE CHANGED</div>
      <h2 className="hc-head"><span className="hc-dim">@{oldHandle}</span> → <span className="hc-accent">@{newHandle}</span></h2>
      <div className="hc-review" style={{ textAlign: "left" }}>
        <div className="hc-review-row"><span className="hc-review-key">OLD HANDLE</span><span className="hc-review-val">@{oldHandle}</span></div>
        <div className="hc-review-row"><span className="hc-review-key">NEW HANDLE</span><span className="hc-review-val hc-accent">@{newHandle}</span></div>
        <div className="hc-review-row"><span className="hc-review-key">TOKEN</span><span className="hc-review-val">{token}</span></div>
        {url && shortSig && <div className="hc-review-row"><span className="hc-review-key">SOLSCAN</span><span className="hc-review-val"><a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--hc-accent)", textDecoration: "none" }}>{shortSig} ↗</a></span></div>}
      </div>
      <div className="hc-cooldown-notice">YOUR 90-DAY COOLDOWN HAS STARTED<div className="hc-cooldown-date">Next eligible: {cooldownDate}</div></div>
      <button type="button" className="hc-cta" onClick={onClose}>&gt; BACK TO DASHBOARD</button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function AnimatedDots() {
  const [count, setCount] = useState(1);
  useEffect(() => { const t = setInterval(() => setCount((c) => (c % 3) + 1), 500); return () => clearInterval(t); }, []);
  return <span style={{ display: "inline-block", width: "1.5em" }}>{".".repeat(count)}</span>;
}

function formatTokenAmount(amount: number, token: PaymentToken): string {
  if (token === "USDT") return amount.toFixed(2);
  if (token === "SOL") return amount.toFixed(6);
  if (amount >= 100) return amount.toFixed(2);
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(6);
}
