"use client";

/**
 * PaymentModal V2 — paste-verify payment flow for subscription, handle_change, mint.
 *
 * Same UX pattern as proof flow: no wallet connect, no signing popups.
 * User sees treasury address + amount → pays in any wallet → pastes TX → backend verifies.
 *
 * 5 screens:
 *   1. Token select (LASTSHFT 40% off, SOL, USDT)
 *   2. Send payment (treasury address + exact amount + copy buttons)
 *   3. Paste TX receipt (Solscan URL or raw signature)
 *   4. Terminal verification (animated cascade)
 *   5. Outcome (confirmed receipt or failure with recovery)
 */

import { useCallback, useEffect, useState } from "react";
import {
  BASE_PRICES_USD,
  LASTSHFT_DISCOUNT,
  type PaymentKindPriced,
  type PaymentToken,
} from "@/lib/pricing";
import "./payment-modal.css";

type PayScreen = 1 | 2 | 3 | 4 | 5;

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

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";

const SESSION_STORAGE_PREFIX = "lp_pay_session_";

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  kind: PaymentKindPriced;
  metadata?: Record<string, unknown>;
  onSuccess?: (txSignature: string) => void;
}

export function PaymentModal({ open, onClose, kind, metadata, onSuccess }: PaymentModalProps) {
  const [screen, setScreen] = useState<PayScreen>(1);
  const [token, setToken] = useState<PaymentToken>("LASTSHFT");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<Record<string, unknown> | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [failureAttempt, setFailureAttempt] = useState(0);
  const [failureCheck, setFailureCheck] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [showFailure, setShowFailure] = useState(false);

  // Session anti-scam
  const [sessionId, setSessionId] = useState<string | null>(null);
  const storageKey = `${SESSION_STORAGE_PREFIX}${kind}_${metadata?.refId ?? "default"}`;

  // Derive profile_id and ref_id from metadata
  const profileId = (metadata?.profileId as string) ?? undefined;
  const refId = (metadata?.refId as string) ?? undefined;

  // Reset on close + lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setScreen(1);
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
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Create session on open
  useEffect(() => {
    if (!open) return;

    // Check localStorage for existing session
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
      body: JSON.stringify({
        kind,
        profile_id: profileId,
        ref_id: refId,
      }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; session_id?: string; opened_at?: string }) => {
        if (data.ok && data.session_id) {
          setSessionId(data.session_id);
          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify({ session_id: data.session_id, opened_at: data.opened_at }),
            );
          } catch { /* storage full */ }
        }
      })
      .catch(() => { /* session creation failed */ });
  }, [open, kind, profileId, refId, storageKey]);

  const handleSubmit = useCallback(
    async (signatureInput: string) => {
      if (!sessionId) return;
      try {
        const res = await fetch("/api/payment/paste-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: signatureInput,
            kind,
            token,
            profile_id: profileId,
            ref_id: refId,
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
          silent_duplicate?: boolean;
        };

        if (!data.ok) {
          setFailureAttempt((a) => a + 1);
          setFailureCheck(data.error ?? "unknown");
          setFailureDetail(data.error ?? "Submission failed.");
          setShowFailure(true);
          return;
        }

        // Instant verify (webhook cache hit) or silent duplicate
        if (data.status === "verified" && data.payment_id) {
          try { localStorage.removeItem(storageKey); } catch {}
          setPaymentData({
            payment_id: data.payment_id,
            sender_wallet: data.sender_wallet ?? "",
            tx_signature: signatureInput,
          });
          setScreen(5);
          if (onSuccess) onSuccess(signatureInput);
          return;
        }

        setVerificationId(data.verification_id!);
        setShowFailure(false);
        setScreen(4);
      } catch {
        setFailureAttempt((a) => a + 1);
        setFailureCheck("network");
        setFailureDetail("Failed to reach the server. Check your connection.");
        setShowFailure(true);
      }
    },
    [kind, token, profileId, refId, sessionId, failureAttempt, storageKey, onSuccess],
  );

  const handleVerified = useCallback(
    (data: Record<string, unknown>, sUrl: string | null) => {
      try { localStorage.removeItem(storageKey); } catch {}
      setPaymentData(data);
      setSolscanUrl(sUrl);
      setScreen(5);
      if (onSuccess && data.tx_signature) {
        onSuccess(data.tx_signature as string);
      }
    },
    [storageKey, onSuccess],
  );

  const handleTerminalFailed = useCallback(
    (check: string, detail: string, attempt: number) => {
      setFailureAttempt(attempt);
      setFailureCheck(check);
      setFailureDetail(detail);
      setShowFailure(true);
      setScreen(3);
    },
    [],
  );

  const handleBack = useCallback(() => {
    if (screen === 2) setScreen(1);
    else if (screen === 3) setScreen(2);
  }, [screen]);

  if (!open) return null;

  const barTitle = KIND_LABELS[kind] ?? kind;

  return (
    <div className="pay-backdrop">
      <div className="pay-shell">
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
          {screen === 1 && (
            <PayStepToken
              kind={kind}
              token={token}
              onSelect={setToken}
              onContinue={() => setScreen(2)}
            />
          )}
          {screen === 2 && (
            <PayStepSend kind={kind} token={token} />
          )}
          {screen === 3 && (
            <PayStepPaste
              onSubmit={handleSubmit}
              failureCheck={showFailure ? failureCheck : null}
              failureDetail={showFailure ? failureDetail : null}
              failureAttempt={failureAttempt}
            />
          )}
          {screen === 4 && verificationId && (
            <PayStepTerminal
              verificationId={verificationId}
              kind={kind}
              onVerified={handleVerified}
              onFailed={handleTerminalFailed}
            />
          )}
          {screen === 5 && (
            <PayStepOutcome
              paymentData={paymentData}
              solscanUrl={solscanUrl}
              kind={kind}
              onClose={onClose}
            />
          )}
        </div>

        {/* Navigation bar for screens 1-3 */}
        {(screen === 2 || screen === 3) && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 36px 32px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
            <button type="button" className="pay-cta-ghost" onClick={handleBack}>
              &larr; BACK
            </button>
            {screen === 2 && (
              <button type="button" className="pay-cta" style={{ flex: 1, marginLeft: 10 }} onClick={() => setScreen(3)}>
                &gt; SUBMIT TRANSACTION RECEIPT
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen 1: Token Select ──────────────────────────────────────────────

function PayStepToken({
  kind,
  token,
  onSelect,
  onContinue,
}: {
  kind: PaymentKindPriced;
  token: PaymentToken;
  onSelect: (t: PaymentToken) => void;
  onContinue: () => void;
}) {
  const baseUsd = BASE_PRICES_USD[kind];
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

// ─── Screen 2: Send Payment (Treasury Address + Amount) ──────────────────

function PayStepSend({
  kind,
  token,
}: {
  kind: PaymentKindPriced;
  token: PaymentToken;
}) {
  const [copied, setCopied] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number | null>(null);
  const [rateUsd, setRateUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUsd = BASE_PRICES_USD[kind];
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
      const formatted = formatTokenAmount(tokenAmount, token);
      navigator.clipboard.writeText(formatted).catch(() => {});
    }
  }, [tokenAmount, token]);

  if (!TREASURY_WALLET) {
    return (
      <>
        <div className="pay-eyebrow" style={{ color: "var(--pm-red)" }}>&gt; CONFIGURATION ERROR</div>
        <h2 className="pay-head">Treasury address not configured.</h2>
        <p className="pay-sub">Contact support — this should not happen in production.</p>
      </>
    );
  }

  return (
    <>
      <div className="pay-eyebrow">&gt; SEND PAYMENT</div>
      <h2 className="pay-head">
        Send and <span className="pay-accent">come back.</span>
      </h2>

      <div className="pay-review">
        <div className="pay-review-row">
          <span className="pay-review-key">SEND TO</span>
          <span className="pay-review-val" style={{ fontSize: 10, wordBreak: "break-all", fontFamily: "monospace" }}>
            {TREASURY_WALLET}
            <button
              type="button"
              className="pay-cta-ghost"
              style={{ marginLeft: 8, padding: "2px 8px", fontSize: 9 }}
              onClick={handleCopy}
            >
              {copied ? "COPIED \u2713" : "COPY"}
            </button>
          </span>
        </div>
        <div className="pay-review-row">
          <span className="pay-review-key">AMOUNT</span>
          <span className="pay-review-val pay-accent" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {loading ? (
              <span style={{ opacity: 0.5 }}>calculating\u2026</span>
            ) : tokenAmount !== null ? (
              <>
                <span>
                  {formatTokenAmount(tokenAmount, token)} {token}
                </span>
                <button
                  type="button"
                  className="pay-cta-ghost"
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
        <div className="pay-review-row">
          <span className="pay-review-key">USD VALUE</span>
          <span className="pay-review-val">
            ${priceUsd.toFixed(2)}
            {rateUsd !== null && token !== "USDT" && (
              <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 10 }}>
                (1 {token} \u2248 ${rateUsd.toFixed(token === "LASTSHFT" ? 6 : 2)})
              </span>
            )}
          </span>
        </div>
        {token === "LASTSHFT" && (
          <div className="pay-review-row">
            <span className="pay-review-key">DISCOUNT</span>
            <span className="pay-review-val pay-green">40% OFF</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: "var(--pm-dim)" }}>
        <div>&bull; Send the exact amount in one transaction</div>
        <div>&bull; Save your Solscan link or TX signature</div>
        <div>&bull; Come back here when you&apos;re done</div>
      </div>
    </>
  );
}

// ─── Screen 3: Paste TX Receipt ──────────────────────────────────────────

const DENIAL_MESSAGES: Record<string, string> = {
  tx_not_found: "TRANSACTION NOT FOUND ON SOLANA",
  tx_failed_onchain: "TRANSACTION FAILED ON-CHAIN",
  wrong_recipient: "PAYMENT NOT SENT TO LASTPROOF TREASURY",
  amount_too_low: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_too_high: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_not_found: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  tx_before_session: "Nice try. Scamming will die in web3.",
  rpc_error: "VERIFICATION INTERRUPTED \u2014 TRY AGAIN",
  config_error: "SYSTEM CONFIGURATION ERROR \u2014 CONTACT SUPPORT",
  network: "FAILED TO REACH SERVER \u2014 CHECK YOUR CONNECTION",
};

function PayStepPaste({
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

  const showFailure = failureCheck !== null;

  return (
    <>
      <div className="pay-eyebrow">&gt; VERIFY YOUR PAYMENT</div>
      <h2 className="pay-head">
        Paste your <span className="pay-accent">transaction.</span>
      </h2>

      {showFailure && (
        <div className="pay-error" style={{
          borderLeft: "2px solid var(--pm-red, #ef4444)",
          borderRadius: 0,
          background: "rgba(239,68,68,0.05)",
        }}>
          <strong>&gt; \u2715 {DENIAL_MESSAGES[failureCheck] ?? failureDetail ?? "VERIFICATION FAILED"}</strong>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 9, letterSpacing: "0.12em", color: "var(--pm-dim)", marginBottom: 6 }}>
          TRANSACTION SIGNATURE
        </label>
        <textarea
          placeholder="Paste Solscan URL or transaction signature\u2026"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="url"
          style={{
            width: "100%",
            minHeight: 56,
            fontSize: 11,
            fontFamily: "inherit",
            background: "transparent",
            border: "1px solid var(--pm-line)",
            borderRadius: 6,
            color: "var(--pm-fg)",
            padding: "10px 12px",
            resize: "vertical",
          }}
        />
        <div style={{ fontSize: 9, color: "var(--pm-dim)", letterSpacing: "0.1em", marginTop: 4 }}>
          SOLSCAN &middot; SOLANA EXPLORER &middot; SOLANA.FM &middot; RAW SIGNATURE
        </div>
      </div>

      <button
        type="button"
        className="pay-cta"
        disabled={!input.trim() || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "> SUBMITTING\u2026" : "> SUBMIT"}
      </button>

      {showFailure && failureAttempt === 2 && (
        <div style={{ fontSize: 9, color: "var(--pm-dim)", letterSpacing: "0.1em", marginTop: 6 }}>
          NEXT SUBMIT RUNS ADDITIONAL CHECKS INCLUDING INNER INSTRUCTIONS
        </div>
      )}

      {showFailure && failureAttempt >= 3 && (
        <div style={{ marginTop: 12 }}>
          <a
            className="pay-cta-ghost"
            style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "8px 12px", fontSize: 11 }}
            href={`mailto:reportclaims@lastproof.app?subject=Payment%20Verification%20Failed%20\u2014%20${encodeURIComponent(failureCheck ?? "unknown")}&body=${encodeURIComponent(`Check: ${failureCheck}\nDetail: ${failureDetail}\nAttempts: ${failureAttempt}`)}`}
          >
            &gt; OPEN SUPPORT TICKET
          </a>
        </div>
      )}
    </>
  );
}

// ─── Screen 4: Terminal Verification ─────────────────────────────────────

interface StatusResponse {
  ok: boolean;
  status: "queued" | "processing" | "verified" | "failed";
  failure_check?: string;
  failure_detail?: string;
  attempt_number?: number;
  payment_id?: string;
  solscan_url?: string | null;
  sender_pubkey?: string | null;
  payment_data?: Record<string, unknown> | null;
}

const VERIFY_CHECKS = [
  "SCANNING SOLANA MAINNET FOR TX...",
  "TX LOCATED",
  "CHECKING RECIPIENT... \u2713 CONFIRMED",
  "CHECKING AMOUNT... \u2713 CONFIRMED",
  "CHECKING TIME WINDOW... \u2713 CONFIRMED",
  "ALL CHECKS PASSED",
];

const DEPLOY_LINES = (kind: string, paymentData: Record<string, unknown>) => [
  `PROCESSING ${kind.toUpperCase()} PAYMENT...`,
  "WRITING TO PAYMENT LEDGER...",
  `PAYMENT ID: ${String(paymentData.payment_id ?? "").slice(0, 8)}\u2026`,
  "UPDATING OPERATOR PROFILE...",
  "PAYMENT CONFIRMED \u2014 LIVE ON PROFILE",
];

interface TerminalLine {
  text: string;
  status: "ok" | "fail" | "pending" | "info";
}

function PayStepTerminal({
  verificationId,
  kind,
  onVerified,
  onFailed,
}: {
  verificationId: string;
  kind: string;
  onVerified: (data: Record<string, unknown>, solscanUrl: string | null) => void;
  onFailed: (check: string, detail: string, attempt: number) => void;
}) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: "INITIATING PAYMENT VERIFICATION...", status: "info" },
  ]);
  const [phase, setPhase] = useState<"verifying" | "deploying" | "done" | "failed">("verifying");
  const [doneData, setDoneData] = useState<{ data: Record<string, unknown>; url: string | null } | null>(null);

  useEffect(() => {
    let done = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const cascadeTimers: ReturnType<typeof setInterval>[] = [];

    function cascadeLines(newLines: TerminalLine[], delayMs: number, onDone?: () => void) {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= newLines.length) {
          clearInterval(timer);
          onDone?.();
          return;
        }
        setLines((prev) => [...prev, newLines[i]!]);
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

          const checkLines: TerminalLine[] = VERIFY_CHECKS.map((text) => ({
            text: `> ${text}`,
            status: "ok" as const,
          }));
          cascadeLines(checkLines, 250, () => {
            setPhase("deploying");
            const deployLines: TerminalLine[] = DEPLOY_LINES(kind, data.payment_data!).map(
              (text) => ({ text: `> ${text}`, status: "ok" as const }),
            );
            cascadeLines(deployLines, 300, () => {
              setPhase("done");
              setDoneData({ data: data.payment_data!, url: data.solscan_url ?? null });
            });
          });
        }

        if (data.status === "failed") {
          done = true;
          if (pollTimer) clearInterval(pollTimer);
          const failCheck = data.failure_check ?? "unknown";
          const failDetail = data.failure_detail ?? "Verification failed.";
          const denialMsg = DENIAL_MESSAGES[failCheck] ?? failDetail;

          setLines((prev) => [
            ...prev,
            { text: `> \u2715 ${denialMsg}`, status: "fail" },
          ]);
          setPhase("failed");
          setTimeout(() => onFailed(failCheck, failDetail, data.attempt_number ?? 1), 1500);
        }
      } catch {
        // Silently retry on next poll
      }
    }

    poll();
    pollTimer = setInterval(poll, 2500);

    return () => {
      done = true;
      if (pollTimer) clearInterval(pollTimer);
      cascadeTimers.forEach((t) => clearInterval(t));
    };
  }, [verificationId, kind, onFailed]);

  const handleConfirm = useCallback(() => {
    if (doneData) {
      onVerified(doneData.data, doneData.url);
    }
  }, [doneData, onVerified]);

  return (
    <>
      <div style={{
        background: "rgba(0,0,0,0.3)",
        border: "1px solid var(--pm-line)",
        borderRadius: 6,
        padding: "14px 16px",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.8,
        maxHeight: 300,
        overflowY: "auto",
        marginBottom: 14,
      }}>
        <div style={{ opacity: 0.5 }}>
          &gt; lastproof verify --payment {verificationId.slice(0, 8)}\u2026
        </div>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: line.status === "ok" ? "var(--pm-green)" :
                   line.status === "fail" ? "var(--pm-red)" :
                   "var(--pm-fg)",
          }}>
            {line.text}
          </div>
        ))}
        {phase === "verifying" && (
          <div style={{ color: "var(--pm-fg)" }}>
            {"  > WAITING FOR VERIFICATION"}
            <AnimatedDots />
          </div>
        )}
      </div>

      {phase === "done" && (
        <button type="button" className="pay-cta-green" onClick={handleConfirm}>
          &gt; CONFIRM
        </button>
      )}

      {phase !== "done" && phase !== "failed" && (
        <div style={{ fontSize: 9, color: "var(--pm-dim)", letterSpacing: "0.1em", textAlign: "center" }}>
          DO NOT CLOSE THIS WINDOW &middot; VERIFICATION IN PROGRESS
        </div>
      )}
    </>
  );
}

// ─── Screen 5: Outcome ───────────────────────────────────────────────────

function PayStepOutcome({
  paymentData,
  solscanUrl,
  kind,
  onClose,
}: {
  paymentData: Record<string, unknown> | null;
  solscanUrl: string | null;
  kind: string;
  onClose: () => void;
}) {
  const txSig = (paymentData?.tx_signature as string) ?? "";
  const short = txSig ? txSig.slice(0, 8) + "\u2026" + txSig.slice(-8) : "";
  const url = solscanUrl ?? (txSig ? `https://solscan.io/tx/${txSig}` : null);

  return (
    <div className="pay-confirmed">
      <div className="pay-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="pay-eyebrow" style={{ textAlign: "center" }}>&gt; PAYMENT CONFIRMED</div>
      <h2 className="pay-head" style={{ textAlign: "center" }}>Done.</h2>
      <p className="pay-sub" style={{ textAlign: "center" }}>
        Your {KIND_LABELS[kind]?.toLowerCase() ?? "payment"} has been confirmed on-chain.
      </p>

      {(short || url) && (
        <div className="pay-review" style={{ marginBottom: 18 }}>
          {short && (
            <div className="pay-review-row">
              <span className="pay-review-key">Signature</span>
              <span className="pay-review-val" style={{ fontFamily: "monospace", fontSize: 11 }}>
                {short}
              </span>
            </div>
          )}
          {url && (
            <div className="pay-review-row">
              <span className="pay-review-key">Explorer</span>
              <span className="pay-review-val">
                <a
                  href={url}
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

// ─── Helpers ─────────────────────────────────────────────────────────────

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
