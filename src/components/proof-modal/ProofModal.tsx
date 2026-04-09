"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import "./proof-modal.css";
import type { ProofPath, ProofStep } from "./types";
import { useEligibilityStream } from "./useEligibilityStream";
import { useQuoteRefresh } from "./useQuoteRefresh";
import { useSignFlow, type SignPhase } from "./useSignFlow";
import type { ProofQuote, FailureReason } from "./types";
import { useConnected, type ConnectedWallet } from "@/lib/wallet/use-connected";
import { WALLET_META, WALLET_ORDER, shouldUseDeepLinks } from "@/lib/wallet/deep-link";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";
import {
  PROOF_TOKENS,
  PROOF_BASE_PRICE_USD,
  LASTSHFT_DISCOUNT_LABEL,
  BUY_LASTSHFT_URL,
  getProofPriceUsd,
  type ProofTokenKey,
} from "@/lib/proof-tokens";

/** Comment char cap — matches backend spec §3 step 3 (NOT Twitter's 280). */
const COMMENT_MAX = 140;

/**
 * ProofModal — the "VERIFY THIS WORK" modal.
 *
 * MINIMAL SHELL. This commit only covers:
 *   - step 1 (path select)
 *   - step 5 (eligibility stream, wired to the mock SSE endpoint)
 *   - step 6 placeholder (review — coming next commit)
 *   - ineligible auto-disconnect banner
 *
 * Skipped for follow-up commits (stubbed):
 *   - step 2 wallet picker (needs real adapter integration)
 *   - step 3 comment
 *   - step 4 token select + pricing
 *   - step 6 review card + live price ticker
 *   - step 7 wallet signature
 *   - step 8 outcomes (success + 10-code failure branch tree)
 *
 * Visual canon: wireframes/lastproof-proof-modal.html
 * Contract canon: docs/PROOF-MODAL-SPEC-REPLY.md (797d1b9)
 */

export interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  workItemId: string;
  ticker: string;
  handle: string;
}

export function ProofModal({ open, onClose, workItemId, ticker, handle }: ProofModalProps) {
  const [step, setStep] = useState<ProofStep>(1);
  const [path, setPath] = useState<ProofPath | null>(null);
  const [comment, setComment] = useState<string>("");
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  /**
   * Tracks which token the currently-cached eligibility stream was
   * run for. When the user changes token on step 4 and advances to
   * step 5, we compare `token` vs `streamedToken` and re-fire if they
   * differ. Null when no stream has been kicked off yet.
   */
  const [streamedToken, setStreamedToken] = useState<ProofTokenKey | null>(null);
  /** WIREFRAME-ONLY toggle — lets us flip mock scenario without a real wallet. */
  const [forceIneligible, setForceIneligible] = useState(false);
  /**
   * DEV-ONLY: mock wallet bypass. Lets us smoke-test steps 3+ in a
   * headless browser where wallet extensions don't exist. Tree-shaken
   * in production builds via `process.env.NODE_ENV !== "production"`.
   */
  const [mockConnected, setMockConnected] = useState<ConnectedWallet | null>(null);

  const { state: elig, start, reset } = useEligibilityStream();
  const { state: sign, start: startSign, reset: resetSign } = useSignFlow();
  const realConnected = useConnected();
  const { wallet: walletAdapter } = useWallet();
  const connected = realConnected ?? mockConnected;

  /**
   * Abandon-on-close plumbing. Per backend reply §6:
   *   - modal close during steps 1–4 → no /abandon call (no quote yet)
   *   - modal close during steps 5–7 pre-broadcast → fire /abandon
   *   - modal close during step 7 post-broadcast → skip (quote consumed)
   *   - modal close during step 8 → skip (lock already released)
   * /abandon is idempotent; backend returns {released:false} for
   * already-consumed quotes, which is a no-op we ignore.
   */
  const fireAbandon = useCallback((quoteId: string) => {
    try {
      fetch("/api/mock/proof/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
        keepalive: true,
      }).catch(() => {
        /* fire-and-forget */
      });
    } catch {
      /* noop */
    }
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      // Only call /abandon if we have a quote AND haven't broadcast yet.
      const hasQuote = elig.quote?.quote_id;
      const preBroadcast =
        sign.phase === "idle" ||
        sign.phase === "building" ||
        sign.phase === "awaiting_signature";
      if (hasQuote && preBroadcast && (step === 5 || step === 6 || step === 7)) {
        fireAbandon(elig.quote!.quote_id);
      }
      setStep(1);
      setPath(null);
      setComment("");
      setToken("LASTSHFT");
      setStreamedToken(null);
      setForceIneligible(false);
      setMockConnected(null);
      reset();
      resetSign();
    }
    // Intentionally only re-run on `open` changes — inner state snapshot
    // reads are fine via closure capture at close time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Step 7 → 8 auto-advance on confirmed OR failed terminal phase.
  useEffect(() => {
    if (step === 7 && (sign.phase === "confirmed" || sign.phase === "failed")) {
      setStep(8);
    }
  }, [step, sign.phase]);

  // Keyboard: ESC closes the modal (unless we're mid-signing — users
  // shouldn't be able to bail after the wallet prompt is up). Also
  // restores focus to whatever element opened the modal on close.
  const openerRef = useRef<Element | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    // Focus the modal shell on open so screen readers announce the
    // dialog label and keyboard users tab into the modal, not the
    // page behind it.
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Block ESC during awaiting_signature / broadcasting / confirming
      // to prevent a mid-flight abandon. User can still click close
      // explicitly if they really want to bail.
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
      // Restore focus to the element that opened the modal.
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [open, sign.phase, onClose]);

  /**
   * Step 2 → 3 auto-advance + eligibility prefetch (Option A per spec §5).
   * As soon as a wallet is connected we fire `/eligibility` with the
   * default token (LASTSHFT) so the stream can run in the background
   * while the user writes their comment on step 3. Saves ~3.5s of
   * terminal-stream wall clock that the user would otherwise watch
   * on step 5.
   */
  useEffect(() => {
    if (step === 2 && connected && path) {
      setStep(3);
      start({
        path,
        token,
        scenario: forceIneligible ? "ineligible" : "eligible",
        pubkey: connected.pubkey,
        project: ticker,
      });
      setStreamedToken(token);
    }
    // token/forceIneligible intentionally omitted — we only want this
    // to fire on connect, not on every token flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, connected, path]);

  const handleContinue = useCallback(() => {
    if (step === 1 && path) {
      setStep(2);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 4) {
      // Re-fire eligibility if the user changed token away from the
      // one the background stream was run against. Mock hits warm
      // cache for everything except the balance row (~200ms).
      if (path && connected && token !== streamedToken) {
        start({
          path,
          token,
          scenario: forceIneligible ? "ineligible" : "eligible",
          pubkey: connected.pubkey,
          project: ticker,
        });
        setStreamedToken(token);
      }
      setStep(5);
      return;
    }
    if (step === 5 && elig.status === "done" && elig.eligible) {
      setStep(6);
    }
  }, [
    step,
    path,
    elig.status,
    elig.eligible,
    connected,
    token,
    streamedToken,
    start,
    forceIneligible,
    ticker,
  ]);

  /**
   * Kicks off the step 7 signing pipeline against the currently-held
   * quote. Used by step 6's SIGN button AND by step 8's retry CTAs
   * (user_rejected, blockhash_expired, rpc_degraded, unknown).
   *
   * NOTE: re-uses the same quote_id. Backend's /build-tx is idempotent
   * per quote within its TTL — safe to call multiple times as long as
   * the quote hasn't hit `quote_expired_hard` or `lock_lost`. Those
   * two failure modes route through handleRefreshQuote instead.
   */
  const kickOffSigning = useCallback(() => {
    if (!elig.quote || !path || !connected) return;
    setStep(7);
    startSign({
      quoteId: elig.quote.quote_id,
      pubkey: connected.pubkey,
      handle,
      ticker,
      path,
      signTransactionBase64: async (txBase64) => {
        const adapter = walletAdapter?.adapter as
          | { signTransaction?: (tx: unknown) => Promise<unknown> }
          | undefined;
        if (!adapter?.signTransaction || mockConnected) {
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
  }, [elig.quote, path, connected, handle, ticker, walletAdapter, mockConnected, startSign]);

  /**
   * Step 8 recovery: user needs a fresh quote. Routes back to step 4,
   * clears the streamed-token marker so the 4→5 transition re-fires
   * eligibility against a new quote. Used by quote_expired_hard,
   * lock_lost, dev_slot_taken (COLLAB path retry only).
   */
  const handleRefreshQuote = useCallback(() => {
    resetSign();
    setStreamedToken(null);
    setStep(4);
  }, [resetSign]);

  /**
   * Step 8 recovery: user needs to change token (insufficient_balance).
   * Back to step 4 but keeps the current eligibility stream cached —
   * re-fires only if they actually pick a different token.
   */
  const handleChangeToken = useCallback(() => {
    resetSign();
    setStep(4);
  }, [resetSign]);

  const handleTryNewWallet = useCallback(() => {
    reset();
    setStep(1);
    setPath(null);
    setComment("");
    setToken("LASTSHFT");
    setStreamedToken(null);
    setForceIneligible(false);
    setMockConnected(null);
  }, [reset]);

  const handleToggleIneligible = useCallback(() => {
    // Re-fire the stream with the flipped scenario, reusing the
    // currently-selected token + pubkey.
    if (!path || !connected) return;
    const next = !forceIneligible;
    setForceIneligible(next);
    start({
      path,
      token,
      scenario: next ? "ineligible" : "eligible",
      pubkey: connected.pubkey,
      project: ticker,
    });
    setStreamedToken(token);
  }, [path, connected, forceIneligible, token, start, ticker]);

  if (!open) return null;

  const commentTooLong = comment.length > COMMENT_MAX;
  const continueDisabled =
    (step === 1 && !path) ||
    (step === 3 && commentTooLong) ||
    (step === 5 && (elig.status !== "done" || !elig.eligible));

  // Steps 2/6/7/8 drive their own CTAs. Hide the global continue bar.
  const hideCta =
    step === 2 ||
    step === 6 ||
    step === 7 ||
    step === 8 ||
    (step === 5 && elig.status === "done" && !elig.eligible);

  return (
    <div
      className="pm-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-bar-title"
    >
      <div
        className="pm-shell"
        ref={shellRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-bar">
          <span className="pm-bar-title" id="pm-bar-title">
            LASTPROOF · VERIFY THIS WORK
          </span>
          <button type="button" className="pm-bar-close" onClick={onClose}>
            CLOSE
          </button>
        </div>

        <div className="pm-body">
          {step === 1 && (
            <Step1PathSelect
              path={path}
              onPick={setPath}
              ticker={ticker}
              handle={handle}
            />
          )}
          {step === 2 && (
            <Step2WalletPicker
              onBack={() => setStep(1)}
              onDevMockConnect={
                process.env.NODE_ENV !== "production"
                  ? () =>
                      setMockConnected({
                        adapterName: "DevMock",
                        pubkey: "F7k2QJm9Np8xWv3sH5cB4aRtY6eZu1oKdL2fVgXpN9xMp",
                        canonical: "phantom",
                        supportsTransferRequestUri: true,
                      })
                  : undefined
              }
            />
          )}
          {step === 3 && (
            <Step3Comment
              comment={comment}
              onChange={setComment}
              tooLong={commentTooLong}
            />
          )}
          {step === 4 && (
            <Step4TokenPicker
              path={path!}
              token={token}
              onPick={setToken}
            />
          )}
          {step === 5 && (
            <Step5Eligibility
              path={path!}
              elig={elig}
              onTryNewWallet={handleTryNewWallet}
              forceIneligible={forceIneligible}
              onToggleIneligible={handleToggleIneligible}
            />
          )}
          {step === 6 && elig.quote && path && (
            <Step6Review
              initialQuote={elig.quote}
              path={path}
              ticker={ticker}
              handle={handle}
              comment={comment}
              pubkey={connected?.pubkey ?? ""}
              onStartOver={handleTryNewWallet}
              onSign={kickOffSigning}
            />
          )}
          {step === 7 && <Step7Signing sign={sign} />}
          {step === 8 && (
            <Step8Outcome
              sign={sign}
              onRetrySign={kickOffSigning}
              onRefreshQuote={handleRefreshQuote}
              onChangeToken={handleChangeToken}
              onStartOver={handleTryNewWallet}
              onClose={onClose}
            />
          )}
        </div>

        {!hideCta && (
          <div className="pm-cta-bar">
            <button
              type="button"
              className="pm-cta"
              disabled={continueDisabled}
              onClick={handleContinue}
            >
              &gt; CONTINUE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────────

function Step1PathSelect({
  path,
  onPick,
  ticker,
  handle,
}: {
  path: ProofPath | null;
  onPick: (p: ProofPath) => void;
  ticker: string;
  handle: string;
}) {
  return (
    <>
      <div className="pm-eyebrow">PROOF THIS WORK</div>
      <h2 className="pm-head">
        Which side were you <span className="pm-accent">on?</span>
      </h2>
      <p className="pm-sub">
        You&apos;re about to leave a permanent on-chain proof that <b>@{handle}</b> worked on{" "}
        <b>{ticker}</b>. Pick the path that matches your relationship to the project.
      </p>
      <div className="pm-paths">
        <button
          type="button"
          className={`pm-path-card${path === "collab" ? " pm-selected" : ""}`}
          onClick={() => onPick("collab")}
        >
          <div className="pm-path-title">COLLABORATOR</div>
          <div className="pm-path-desc">
            You worked alongside them on {ticker}. No token-level claim.
          </div>
          <div className="pm-path-price">$1 · $0.60 with $LASTSHFT</div>
        </button>
        <button
          type="button"
          className={`pm-path-card${path === "dev" ? " pm-selected" : ""}`}
          onClick={() => onPick("dev")}
        >
          <div className="pm-path-title">DEV</div>
          <div className="pm-path-desc">
            You deployed or co-founded {ticker}. Wallet verified against mint authority + first-5
            holders.
          </div>
          <div className="pm-path-price">$5 · $3 with $LASTSHFT</div>
        </button>
      </div>
    </>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────────

/**
 * Wallet picker.
 *
 * Renders the four-wallet static allowlist merged with the live
 * `useWallet().wallets` array (which is populated by
 * `useStandardWalletAdapters()` under the hood — Jupiter + Binance
 * appear here after they self-register via Wallet Standard).
 *
 * Click handler branches:
 *   - allowlisted + adapter present → `select()` + `connect()`
 *   - allowlisted + adapter missing  → on desktop: install hint;
 *                                      on mobile: deep-link bounce
 *
 * Once connected, the parent auto-advances to step 5 via effect.
 * Picker shows a transient "connecting" row while the adapter
 * negotiates.
 */
function Step2WalletPicker({
  onBack,
  onDevMockConnect,
}: {
  onBack: () => void;
  onDevMockConnect?: () => void;
}) {
  const { wallets, select, connect, connecting, wallet: selectedWallet } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const useDeepLinks = useMemo(() => shouldUseDeepLinks(), []);

  /**
   * Map canonical wallet id → live adapter (if registered). Lookup is
   * loose via classifyWallet so adapter-name variants ("Jupiter
   * Mobile", "Binance Wallet", etc.) all funnel into the right slot.
   */
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
      setErr(null);
      const live = liveByCanonical.get(canonical);
      if (!live) {
        setErr(
          `${WALLET_META[canonical].label} isn't available in this browser. Install the extension or open this page inside the wallet app.`,
        );
        return;
      }
      try {
        select(live.adapter.name);
        // `connect()` reads from the currently-selected wallet; the
        // select() call above is synchronous state so this is safe.
        await connect();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "wallet connect failed");
      }
    },
    [liveByCanonical, select, connect],
  );

  return (
    <>
      <div className="pm-eyebrow">CONNECT YOUR WALLET</div>
      <h2 className="pm-head">
        Pick a <span className="pm-accent">wallet.</span>
      </h2>
      <p className="pm-sub">
        One wallet, one proof per project. We&apos;ll verify it hasn&apos;t proofed this project
        before you sign — no gas until you approve.
      </p>

      <div className="pm-wallets">
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
                className="pm-wallet"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="pm-wallet-label">{meta.label}</span>
                <span className="pm-wallet-hint">OPEN IN APP →</span>
              </a>
            );
          }

          return (
            <button
              key={id}
              type="button"
              className={`pm-wallet${isConnecting ? " pm-connecting" : ""}`}
              onClick={() => handleClick(id)}
              disabled={connecting}
            >
              <span className="pm-wallet-label">{meta.label}</span>
              <span className="pm-wallet-hint">
                {isConnecting ? "CONNECTING…" : live ? "DETECTED" : "NOT INSTALLED"}
              </span>
            </button>
          );
        })}
      </div>

      {err && (
        <div className="pm-inel" style={{ marginTop: 14 }}>
          {err}
        </div>
      )}

      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
        onClick={onBack}
      >
        ← BACK
      </button>

      {onDevMockConnect && (
        <button
          type="button"
          className="pm-cta-ghost"
          style={{
            marginTop: 10,
            padding: "8px 12px",
            fontSize: 10,
            letterSpacing: "0.1em",
            width: "100%",
          }}
          onClick={onDevMockConnect}
          data-testid="pm-dev-mock-connect"
        >
          DEV: SKIP WALLET (MOCK)
        </button>
      )}
    </>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────────

function Step3Comment({
  comment,
  onChange,
  tooLong,
}: {
  comment: string;
  onChange: (s: string) => void;
  tooLong: boolean;
}) {
  const remaining = COMMENT_MAX - comment.length;
  return (
    <>
      <div className="pm-eyebrow">LEAVE A NOTE</div>
      <h2 className="pm-head">
        Add a <span className="pm-accent">receipt.</span>
      </h2>
      <p className="pm-sub">
        One line about what you shipped with them. Optional. Lives on the public profile next to the
        proof. No URLs, no emoji spam.
      </p>

      <div className="pm-comment-wrap">
        <textarea
          className="pm-comment"
          placeholder="e.g. Shipped the meme engine with them — 40k impressions in week 1."
          value={comment}
          onChange={(e) => onChange(e.target.value)}
          maxLength={COMMENT_MAX + 20 /* soft cap, hard cap enforced by disabled CTA */}
        />
        <div className={`pm-comment-count${tooLong ? " pm-over" : ""}`}>
          {remaining} / {COMMENT_MAX}
        </div>
      </div>
      <div className="pm-comment-hint">
        Optional — skip to continue. Eligibility is running in the background while you type.
      </div>
    </>
  );
}

// ─── Step 4 ─────────────────────────────────────────────────────────────

function Step4TokenPicker({
  path,
  token,
  onPick,
}: {
  path: ProofPath;
  token: ProofTokenKey;
  onPick: (t: ProofTokenKey) => void;
}) {
  const basePrice = PROOF_BASE_PRICE_USD[path];
  return (
    <>
      <div className="pm-eyebrow">PICK YOUR TOKEN</div>
      <h2 className="pm-head">
        Pay with <span className="pm-accent">$LASTSHFT</span> — 40% off.
      </h2>
      <p className="pm-sub">
        Three options, all permissionless. Paying in $LASTSHFT unlocks the operator discount and
        routes straight to the buy-back wallet.
      </p>

      <div className="pm-tokens">
        {PROOF_TOKENS.map((t) => {
          const price = getProofPriceUsd(path, t.key);
          const selected = t.key === token;
          return (
            <button
              key={t.key}
              type="button"
              className={`pm-token${selected ? " pm-selected" : ""}`}
              onClick={() => onPick(t.key)}
            >
              <span className="pm-token-label">
                {t.label}
                {t.hasDiscountBadge && (
                  <span className="pm-token-badge">{LASTSHFT_DISCOUNT_LABEL}</span>
                )}
              </span>
              <span className="pm-token-price">
                {t.hasDiscountBadge && (
                  <span className="pm-token-strike">${basePrice.toFixed(2)}</span>
                )}
                ${price.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      <a
        className="pm-buy-lastshft"
        href={BUY_LASTSHFT_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        BUY $LASTSHFT ↗
      </a>
    </>
  );
}

// ─── Step 5 ─────────────────────────────────────────────────────────────

function Step5Eligibility({
  path,
  elig,
  onTryNewWallet,
  forceIneligible,
  onToggleIneligible,
}: {
  path: ProofPath;
  elig: ReturnType<typeof useEligibilityStream>["state"];
  onTryNewWallet: () => void;
  forceIneligible: boolean;
  onToggleIneligible: () => void;
}) {
  const role = path === "dev" ? "dev" : "collaborator";
  const isIneligible = elig.status === "done" && !elig.eligible;

  return (
    <>
      <div className="pm-eyebrow">VERIFYING YOUR WALLET</div>
      <h2 className="pm-head">
        Quick <span className="pm-accent">eligibility check.</span>
      </h2>
      <p className="pm-sub">
        One wallet, one proof per project. We check that this wallet hasn&apos;t already proofed this
        project before you sign.
      </p>

      <div
        className={`pm-term${isIneligible ? " pm-fail" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="pm-term-line">
          &gt; lastproof verify --wallet F7k2…9xMp --project {path === "dev" ? "$LASTSHFT" : "$LASTSHFT"} --role {role}
        </div>
        {elig.checks.map((c) => {
          const cls =
            c.ok === true ? "pm-ok" : c.ok === false ? "pm-no" : "pm-neutral";
          const mark = c.ok === true ? "[✓]" : c.ok === false ? "[✗]" : "[–]";
          return (
            <div key={c.id} className={`pm-term-line ${cls}`}>
              {`  ${mark} ${c.label.padEnd(14, " ")}  ${c.detail}`}
            </div>
          );
        })}
        {elig.status === "done" && elig.eligible && (
          <div className="pm-term-line pm-done">
            &gt; {path === "dev" ? "dev wallet verified" : "all checks passed"} · ready to sign
            <span className="pm-term-cursor">█</span>
          </div>
        )}
        {elig.status === "done" && !elig.eligible && (
          <div className="pm-term-line pm-err">
            &gt; ERROR: wallet not eligible for {role} proof on this project
          </div>
        )}
        {elig.status === "error" && (
          <div className="pm-term-line pm-err">&gt; ERROR: {elig.error}</div>
        )}
      </div>

      {isIneligible && (
        <div className="pm-inel">
          <div>● YOU&apos;VE BEEN AUTOMATICALLY DISCONNECTED</div>
          <div style={{ marginTop: 10, color: "var(--pm-dim)" }}>
            To file a <b>DEV proof</b>, the connected wallet must match at least one on-chain signal
            for this project: <b>MINT-AUTHORITY</b>, <b>DEPLOYER</b>, or <b>FIRST-5 HOLDER</b>.{" "}
            <i>FOUNDER MULTISIG check lands in v1.1.</i>
          </div>
          <button
            type="button"
            className="pm-cta"
            style={{ marginTop: 14 }}
            onClick={onTryNewWallet}
          >
            &gt; TRY A NEW WALLET
          </button>
        </div>
      )}

      {/* WIREFRAME-ONLY toggle to flip scenario without a real wallet */}
      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
        onClick={onToggleIneligible}
      >
        ⟳ TOGGLE ELIGIBILITY (DEV-ONLY) · currently{" "}
        {forceIneligible ? "INELIGIBLE" : "ELIGIBLE"}
      </button>
    </>
  );
}

// ─── Step 6 ─────────────────────────────────────────────────────────────

/**
 * Review-before-sign card with a live price ticker.
 *
 * Polls `/api/proof/quote/:id/refresh` every 5s while mounted. Renders
 * the current locked amount, a countdown to `expires_at`, and a
 * price-flash animation every time the refresh returns a different
 * `amount_ui`. Hard-expired state replaces the card with a red
 * dashed banner + manual REFRESH PRICE button. Lock-lost and
 * slot-taken flows bounce the user back to step 1 (next commit
 * will route them into the step 8 failure tree instead).
 */
function Step6Review({
  initialQuote,
  path,
  ticker,
  handle,
  comment,
  pubkey,
  onStartOver,
  onSign,
}: {
  initialQuote: ProofQuote;
  path: ProofPath;
  ticker: string;
  handle: string;
  comment: string;
  pubkey: string;
  onStartOver: () => void;
  onSign: () => void;
}) {
  const { state: refresh, manualRefresh } = useQuoteRefresh({
    initialQuote,
    enabled: true,
  });
  const quote = refresh.quote;

  // Flash animation trigger — whenever `amount_ui` changes, pulse
  // the ticker green for 400ms.
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

  // Countdown timer, 1hz.
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
  const shortPubkey = pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : "—";
  const shortQuoteId = `${quote.quote_id.slice(0, 6)}…${quote.quote_id.slice(-4)}`;

  // Lock-lost / slot-taken: bounce back. Follow-up commit routes
  // these into step 8 failure outcomes instead.
  useEffect(() => {
    if (refresh.lockLost || refresh.slotTaken) {
      onStartOver();
    }
  }, [refresh.lockLost, refresh.slotTaken, onStartOver]);

  return (
    <>
      <div className="pm-eyebrow">REVIEW BEFORE YOU SIGN</div>
      <h2 className="pm-head">
        One last <span className="pm-accent">look.</span>
      </h2>
      <p className="pm-sub">
        Price updates live. Your wallet will ask you to approve this exact amount.
      </p>

      <div className="pm-review">
        <div className="pm-review-row">
          <span className="pm-review-key">OPERATOR</span>
          <span className="pm-review-val">@{handle}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">PROJECT</span>
          <span className="pm-review-val">{ticker}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">PATH</span>
          <span className="pm-review-val">{path.toUpperCase()}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">WALLET</span>
          <span className="pm-review-val pm-mono">{shortPubkey}</span>
        </div>
        <div className="pm-review-row">
          <span className="pm-review-key">QUOTE ID</span>
          <span className="pm-review-val pm-mono">{shortQuoteId}</span>
        </div>
        {comment && (
          <div className="pm-review-row">
            <span className="pm-review-key">NOTE</span>
            <span className="pm-review-val" style={{ maxWidth: "60%" }}>
              &ldquo;{comment}&rdquo;
            </span>
          </div>
        )}
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
        <div className="pm-comment-hint" style={{ color: "var(--pm-red)", marginTop: 8 }}>
          refresh error: {refresh.error}
        </div>
      )}

      <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
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

// ─── Step 7 ─────────────────────────────────────────────────────────────

/**
 * Signing ladder. Rungs map to SignPhase:
 *   building             → BUILDING TRANSACTION
 *   awaiting_signature   → AWAITING WALLET SIGNATURE
 *   broadcasting         → BROADCASTING
 *   confirming           → CONFIRMING
 *   confirmed            → (auto-advances to step 8)
 *   failed               → (auto-advances to step 8 failure card)
 */
function Step7Signing({ sign }: { sign: ReturnType<typeof useSignFlow>["state"] }) {
  const rungs: { key: SignPhase; label: string }[] = [
    { key: "building", label: "BUILDING TRANSACTION" },
    { key: "awaiting_signature", label: "AWAITING WALLET SIGNATURE" },
    { key: "broadcasting", label: "BROADCASTING" },
    { key: "confirming", label: "CONFIRMING ON-CHAIN" },
  ];
  const order: SignPhase[] = [
    "idle",
    "building",
    "awaiting_signature",
    "broadcasting",
    "confirming",
    "confirmed",
    "failed",
  ];
  const idx = order.indexOf(sign.phase);

  return (
    <>
      <div className="pm-eyebrow">SIGNING ON-CHAIN</div>
      <h2 className="pm-head">
        Hold <span className="pm-accent">steady.</span>
      </h2>
      <p className="pm-sub">
        Don&apos;t close this window. Your wallet will prompt you to approve. After you sign, we
        broadcast and wait for confirmation.
      </p>

      <div className="pm-ladder" role="status" aria-live="polite" aria-atomic="false">
        {rungs.map((r) => {
          const rungIdx = order.indexOf(r.key);
          const active = r.key === sign.phase;
          const done = rungIdx < idx && sign.phase !== "idle";
          const mark = done ? "✓" : active ? "◆" : " ";
          const cls = active ? "pm-rung pm-active" : done ? "pm-rung pm-done" : "pm-rung";
          return (
            <div key={r.key} className={cls}>
              <span className="pm-rung-mark">{mark}</span>
              <span className="pm-rung-label">{r.label}</span>
              {active && sign.phase === "confirming" && (
                <span className="pm-rung-meta">{Math.floor(sign.elapsedMs / 100) / 10}s</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Step 8 ─────────────────────────────────────────────────────────────

/**
 * Outcome card. Renders either the success card (signature + Solscan
 * link) or a generic failure card keyed on `sign.failure`. The full
 * 10-code failure branch tree with tailored copy per code lands in a
 * follow-up commit — this commit ships the skeleton so end-to-end
 * step 7 → 8 is functional.
 */
function Step8Outcome({
  sign,
  onRetrySign,
  onRefreshQuote,
  onChangeToken,
  onStartOver,
  onClose,
}: {
  sign: ReturnType<typeof useSignFlow>["state"];
  onRetrySign: () => void;
  onRefreshQuote: () => void;
  onChangeToken: () => void;
  onStartOver: () => void;
  onClose: () => void;
}) {
  if (sign.phase === "confirmed") {
    return (
      <>
        <div className="pm-eyebrow">PROOF MINTED</div>
        <h2 className="pm-head">
          It&apos;s <span className="pm-accent">on-chain.</span>
        </h2>
        <div className="pm-outcome pm-success">
          <div className="pm-outcome-mark">✓</div>
          <div className="pm-outcome-title">CONFIRMED</div>
          <div className="pm-outcome-sub">
            Your proof is permanent. It&apos;s on the profile now and the operator gets a
            notification.
          </div>
          {sign.signature && (
            <div className="pm-outcome-sig">
              {sign.signature.slice(0, 14)}…{sign.signature.slice(-14)}
            </div>
          )}
          {sign.solscanUrl && (
            <a href={sign.solscanUrl} target="_blank" rel="noopener noreferrer">
              VIEW ON SOLSCAN ↗
            </a>
          )}
        </div>
        <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
          <button type="button" className="pm-cta" onClick={onClose}>
            &gt; DONE
          </button>
        </div>
      </>
    );
  }

  // Failure — full 10-code tree. Each code maps to tailored copy plus
  // a primary recovery action and an optional secondary fallback.
  const reason: FailureReason = sign.failure ?? "unknown";
  const copy = FAILURE_COPY[reason] ?? FAILURE_COPY.unknown;

  const runAction = (kind: RecoveryKind) => {
    switch (kind) {
      case "retry_sign":
        onRetrySign();
        return;
      case "refresh_quote":
        onRefreshQuote();
        return;
      case "change_token":
        onChangeToken();
        return;
      case "start_over":
        onStartOver();
        return;
      case "close":
        onClose();
        return;
    }
  };

  return (
    <>
      <div className="pm-eyebrow">PROOF NOT MINTED</div>
      <h2 className="pm-head">
        Something <span className="pm-accent">didn&apos;t land.</span>
      </h2>
      <div className="pm-outcome pm-fail">
        <div className="pm-outcome-mark">!</div>
        <div className="pm-outcome-title">{copy.title}</div>
        <div className="pm-outcome-sub">{copy.sub}</div>
        <div className="pm-outcome-sig">reason: {reason}</div>
      </div>
      <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
        <button
          type="button"
          className="pm-cta"
          onClick={() => runAction(copy.primary.kind)}
        >
          &gt; {copy.primary.label}
        </button>
      </div>
      {copy.secondary && (
        <button
          type="button"
          className="pm-cta-ghost"
          style={{ marginTop: 10, padding: "8px 12px", fontSize: 11 }}
          onClick={() => runAction(copy.secondary!.kind)}
        >
          {copy.secondary.label}
        </button>
      )}
    </>
  );
}

/**
 * Failure recovery action kinds, consumed by Step8Outcome's recovery
 * dispatch. Each FailureReason maps to a primary (and optional
 * secondary) Recovery below. Keep these aligned with the handlers
 * wired in ProofModal — adding a new kind means wiring a new prop.
 */
type RecoveryKind =
  | "retry_sign"        // same quote, re-run step 7 (build-tx is idempotent)
  | "refresh_quote"     // back to step 4 with cleared stream → new quote
  | "change_token"      // back to step 4, stream preserved unless they flip
  | "start_over"        // wipe everything back to step 1
  | "close";            // abandon, close modal

interface Recovery {
  kind: RecoveryKind;
  label: string;
}

/**
 * Full 10-code failure tree. Each code → tailored title/sub plus a
 * primary recovery action and an optional secondary fallback.
 *
 * Recovery routing logic:
 *   - retry_sign     → user-recoverable failures where the same quote
 *                      is still valid (wallet declined, transient RPC,
 *                      transient blockhash). Same quote_id is re-used;
 *                      /build-tx is idempotent within quote TTL.
 *   - refresh_quote  → quote itself is dead (expired, lock released,
 *                      dev slot gone). Route back to step 4 to pick
 *                      up a fresh eligibility + quote stream.
 *   - change_token   → balance shortfall. User may want to swap to
 *                      a token they hold more of.
 *   - start_over     → adversarial / hard failures. Wipe state, force
 *                      the user to reconnect their wallet fresh.
 *   - close          → nothing to recover, abandon cleanly.
 */
const FAILURE_COPY: Record<
  FailureReason,
  { title: string; sub: string; primary: Recovery; secondary?: Recovery }
> = {
  user_rejected: {
    title: "YOU CANCELLED",
    sub: "You declined the signature in your wallet. No money moved. The quote is still live — try again when you're ready.",
    primary: { kind: "retry_sign", label: "TRY SIGNING AGAIN" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  insufficient_balance: {
    title: "INSUFFICIENT BALANCE",
    sub: "This wallet doesn't hold enough to cover the proof cost plus network fees. Pick a different token or top this one up.",
    primary: { kind: "change_token", label: "PICK A DIFFERENT TOKEN" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  blockhash_expired: {
    title: "BLOCKHASH EXPIRED",
    sub: "The signed transaction sat too long before landing. A fresh tx will be built and signed — one more tap.",
    primary: { kind: "retry_sign", label: "RETRY" },
    secondary: { kind: "start_over", label: "START OVER" },
  },
  tx_reverted: {
    title: "TRANSACTION REVERTED",
    sub: "The network rejected the transaction. This usually means your balance changed between signing and broadcast. Start over with a fresh check.",
    primary: { kind: "start_over", label: "START OVER" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  rpc_degraded: {
    title: "NETWORK DEGRADED",
    sub: "Solana RPC is unhealthy right now. Your quote is still locked — wait a moment, then retry.",
    primary: { kind: "retry_sign", label: "RETRY" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  quote_expired_hard: {
    title: "QUOTE EXPIRED",
    sub: "Your locked price timed out before the tx landed. Grab a fresh quote — takes a few seconds.",
    primary: { kind: "refresh_quote", label: "GET A FRESH QUOTE" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  lock_lost: {
    title: "SESSION DROPPED",
    sub: "Your proof-session lock was released — usually a long network stall. Nothing was charged. Grab a fresh quote to try again.",
    primary: { kind: "refresh_quote", label: "GET A FRESH QUOTE" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  dev_slot_taken: {
    title: "DEV SLOT CLAIMED",
    sub: "Another wallet claimed the DEV proof slot for this project while you were signing. Only one dev proof per project. You can still file a COLLAB proof from the start.",
    primary: { kind: "start_over", label: "TRY AS COLLABORATOR" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  signature_invalid: {
    title: "SIGNATURE REJECTED",
    sub: "The signed transaction didn't match what the backend expected. This is usually a stale wallet adapter. Reconnect your wallet and start fresh.",
    primary: { kind: "start_over", label: "RECONNECT WALLET" },
    secondary: { kind: "close", label: "CLOSE" },
  },
  unknown: {
    title: "SOMETHING WENT WRONG",
    sub: "An unexpected error occurred. Nothing has been charged. You can retry the signing step or close out.",
    primary: { kind: "retry_sign", label: "TRY AGAIN" },
    secondary: { kind: "close", label: "CLOSE" },
  },
};
