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
import { WALLET_META, WALLET_ORDER, detectWalletEnvironment } from "@/lib/wallet/deep-link";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";
import { PasteVerifyFlow } from "./flows/paste-verify/PasteVerifyFlow";
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
 * All 8 steps implemented:
 *   1. Path select (collab / dev)
 *   2. Wallet picker (Phantom, Solflare, Jupiter, Binance + deep links)
 *   3. Comment (140 char receipt)
 *   4. Token select + pricing ($1 collab, $5 dev, 40% off with $LASTSHFT)
 *   5. Eligibility stream (SSE against mock or real endpoint)
 *   6. Review card + live price ticker via useQuoteRefresh
 *   7. Signing pipeline (build-tx → sign → broadcast → poll) via useSignFlow
 *   8. Outcomes (confirmed + 10-code failure branch tree with recovery CTAs)
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
  /** Profile owner's terminal wallet — used to block self-proofing. */
  ownerWallet: string;
}

export function ProofModal({ open, onClose, workItemId, ticker, handle, ownerWallet }: ProofModalProps) {
  const [step, setStep] = useState<ProofStep>(1);
  const [selectedWallet, setSelectedWallet] = useState<KnownWallet | null>(null);
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
   * Self-proof guard — operators cannot proof their own work.
   * True when the connected wallet matches the profile owner's terminal wallet.
   * Client-side fast guard; the backend eligibility endpoint is the source of truth.
   */
  const isSelfProof = Boolean(
    connected && ownerWallet && connected.pubkey === ownerWallet,
  );

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
      fetch("/api/proof/abandon", {
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
      if (hasQuote && preBroadcast && (step === 6 || step === 7 || step === 8)) {
        fireAbandon(elig.quote!.quote_id);
      }
      setStep(1);
      setSelectedWallet(null);
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
    if (step === 8 && (sign.phase === "confirmed" || sign.phase === "failed")) {
      setStep(9);
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
   * Eligibility prefetch (Option A per spec §5). As soon as a wallet is
   * connected on step 2 we fire `/eligibility` with the default token
   * (LASTSHFT) so the stream can run in the background while the user
   * reads the verified-state card and writes their comment on step 3.
   * Saves ~3.5s of terminal-stream wall clock on step 5.
   *
   * Per user decision A (transparency): we do NOT auto-advance out of
   * step 2. The verified-state card stays visible until the user
   * explicitly clicks CONTINUE. Going fast here creates doubt.
   */
  // Eligibility prefetch: fires when wallet connected (step 1 done) +
  // path selected (step 2 done). Runs in background while user writes
  // comment on step 3.
  useEffect(() => {
    if (step === 3 && connected && path) {
      start({
        path,
        token,
        scenario: forceIneligible ? "ineligible" : "eligible",
        pubkey: connected.pubkey,
        project: ticker,
        workItemId,
      });
      setStreamedToken(token);
    }
    // token/forceIneligible intentionally omitted — we only want this
    // to fire on path select, not on every token flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, connected, path]);

  const handleContinue = useCallback(() => {
    // Step 3 (path select) → step 4
    if (step === 3 && path) {
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
    if (step === 5) {
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
          workItemId,
        });
        setStreamedToken(token);
      }
      setStep(6);
      return;
    }
    if (step === 6 && elig.status === "done" && elig.eligible) {
      setStep(7);
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
    setStep(5);
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
      workItemId,
    });
    setStreamedToken(token);
  }, [path, connected, forceIneligible, token, start, ticker, workItemId]);

  if (!open) return null;

  const commentTooLong = comment.length > COMMENT_MAX;
  const continueDisabled =
    (step === 3 && !path) ||
    (step === 4 && commentTooLong) ||
    (step === 6 && (elig.status !== "done" || !elig.eligible));

  // Steps 1/2/7/8/9 drive their own CTAs. Hide the global continue bar.
  const hideCta =
    step === 1 ||
    step === 2 ||
    step === 7 ||
    step === 8 ||
    step === 9 ||
    (step === 6 && elig.status === "done" && !elig.eligible);

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
          <div className="pm-bar-left">
            <div className="pm-dots" aria-hidden="true">
              <span className="pm-dot-r" />
              <span className="pm-dot-y" />
              <span className="pm-dot-g" />
            </div>
            <span className="pm-bar-title" id="pm-bar-title">
              lastproof — verify this work
            </span>
          </div>
          <div className="pm-bar-right">
            <span className="pm-pulse" aria-hidden="true" />
            PROOF
            <button
              type="button"
              className="pm-bar-close"
              onClick={onClose}
              aria-label="Close proof modal"
            >
              CLOSE
            </button>
          </div>
        </div>

        {/* Steps 1-2: wallet select + connect. Step 3+: PasteVerifyFlow takes over.
            All wallet/platform combos (including Phantom on Android) use the same
            paste-to-verify flow. Each branch owns its own ref-row + progress bar. */}
        {step <= 2 ? (
          <>
            <div className="pm-ref-row">
              <span />
              <span className="pm-step-counter">
                STEP <span className="pm-step-now">{step}</span> / 7
              </span>
            </div>
            <div className="pm-progress-wrap">
              <div className="pm-bar-track">
                <div className="pm-bar-fill" style={{ width: `${(step / 7) * 100}%` }} />
              </div>
            </div>
            <div className="pm-body">
              {step === 1 && (
                <Step1WalletSelect
                  onSelect={(id) => { setSelectedWallet(id); setStep(2); }}
                />
              )}
              {step === 2 && selectedWallet && (
                <Step2WalletPicker
                  onBack={() => { setSelectedWallet(null); setStep(1); }}
                  connected={connected}
                  isSelfProof={isSelfProof}
                  onContinue={() => setStep(3)}
                  selectedWallet={selectedWallet}
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
            </div>
          </>
        ) : connected ? (
          <PasteVerifyFlow
            workItemId={workItemId}
            ticker={ticker}
            handle={handle}
            connected={connected}
            onClose={onClose}
            stepOffset={2}
            totalSteps={7}
            onBackToWalletSelect={() => {
              setSelectedWallet(null);
              setStep(1);
              setPath(null);
              setComment("");
              setToken("LASTSHFT");
              setStreamedToken(null);
              setForceIneligible(false);
              setMockConnected(null);
              reset();
              resetSign();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────────

/**
 * Project context card. Rendered anchored at the top of the body on
 * steps 1 and 3 per wireframe canon (.proj-card). Ticker on the left,
 * role + dates in the middle, a CURRENT tag on the right.
 *
 * `role` and `dates` are placeholders until the public profile hands
 * them down through props — today the ticker is the only real value.
 */
function ProjCard({
  ticker,
  role,
  dates,
}: {
  ticker: string;
  role?: string;
  dates?: string;
}) {
  return (
    <div className="pm-proj-card">
      <div className="pm-proj-ticker">{ticker}</div>
      <div className="pm-proj-meta">
        <div className="pm-proj-role">{role ?? "COLLABORATOR"}</div>
        <div className="pm-proj-dates">{dates ?? "PROJECT PROOF"}</div>
      </div>
      <div className="pm-proj-tags">
        <span className="pm-proj-tag pm-proj-tag-current">CURRENT</span>
      </div>
    </div>
  );
}

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
      <div className="pm-eyebrow">&gt; VERIFY THIS WORK ON-CHAIN</div>
      <h2 className="pm-head">
        You&apos;re proofing <span className="pm-accent">@{handle}</span>.
      </h2>
      <p className="pm-sub">
        Pick the path that matches your relationship to <b>{ticker}</b>. Proofs are permanent —
        you can&apos;t edit, delete, or refund after signature.
      </p>
      <ProjCard ticker={ticker} />
      <div className="pm-paths">
        <button
          type="button"
          className={`pm-path-card${path === "collab" ? " pm-selected" : ""}`}
          onClick={() => onPick("collab")}
        >
          <span className="pm-path-lim">1 PER WALLET</span>
          <div className="pm-path-title">COLLABORATOR</div>
          <div className="pm-path-price">$1</div>
          <div className="pm-path-desc">
            You worked alongside them on {ticker}. No token-level claim.
          </div>
        </button>
        <button
          type="button"
          className={`pm-path-card pm-path-dev${path === "dev" ? " pm-selected" : ""}`}
          onClick={() => onPick("dev")}
        >
          <span className="pm-path-lim">1 DEV PROOF / PROJECT</span>
          <div className="pm-path-title">DEV</div>
          <div className="pm-path-price">$5</div>
          <div className="pm-path-desc">
            You deployed or co-founded {ticker}. Wallet verified against mint
            authority + first-5 holders.
          </div>
        </button>
      </div>
      <div className="pm-field-help">
        1 WALLET PER PROJECT · 1 DEV PROOF PER PROJECT · PERMANENT ON-CHAIN
      </div>
    </>
  );
}

// ─── Step 1: Wallet Select (no connection) ────────────────────────────────

/**
 * Pure selection — user picks which wallet they want to use.
 * No connection attempt. System silently detects desktop vs mobile.
 * Step 2 handles the actual connection for the selected wallet.
 */
function Step1WalletSelect({ onSelect }: { onSelect: (id: KnownWallet) => void }) {
  return (
    <>
      <div className="pm-eyebrow">&gt; SELECT YOUR WALLET</div>
      <h2 className="pm-head">
        Which <span className="pm-accent">wallet?</span>
      </h2>
      <p className="pm-sub">
        Pick the wallet you&apos;ll use to sign and pay. We&apos;ll connect it on the
        next screen.
      </p>

      <div className="pm-wallets">
        {WALLET_ORDER.map((id) => {
          const meta = WALLET_META[id];
          return (
            <button
              key={id}
              type="button"
              className="pm-wallet"
              onClick={() => onSelect(id)}
            >
              <span className="pm-wallet-label">{meta.label}</span>
              <span className="pm-wallet-hint">SELECT &rarr;</span>
            </button>
          );
        })}
      </div>

      <div className="pm-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 9, letterSpacing: "0.1em" }}>
        LASTPROOF NEVER HOLDS OR CUSTODIES FUNDS
      </div>
    </>
  );
}

// ─── Step 2: Connect Wallet ───────────────────────────────────────────────

/**
 * Wallet connection screen for the selected wallet.
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
  connected,
  isSelfProof,
  onContinue,
  selectedWallet: targetWallet,
  onDevMockConnect,
}: {
  onBack: () => void;
  connected: ConnectedWallet | null;
  isSelfProof: boolean;
  onContinue: () => void;
  selectedWallet: KnownWallet;
  onDevMockConnect?: () => void;
}) {
  const { wallets, select, connect, connecting, wallet: selectedWallet } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const walletEnv = useMemo(() => detectWalletEnvironment(), []);

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

  // Verified state — wallet just connected. Per user decision A, we do
  // NOT auto-advance. Show a transparent confirmation card and let the
  // user click CONTINUE to proceed. Going fast creates doubt.
  if (connected) {
    const short =
      connected.pubkey.slice(0, 6) + "…" + connected.pubkey.slice(-4);
    const walletLabel = connected.adapterName?.toUpperCase() ?? "WALLET";
    return (
      <>
        <div className="pm-eyebrow">&gt; WALLET CONNECTED</div>
        <h2 className="pm-head">
          Locked in with <span className="pm-green">{walletLabel}</span>.
        </h2>
        <p className="pm-sub">
          We&apos;ve got the wallet address. Next we&apos;ll check eligibility
          in the background while you write your receipt.
        </p>

        <div className="pm-wallet-verified">
          <div className="pm-wv-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="pm-wv-title">{walletLabel} · CONNECTED</div>
          <div className="pm-wv-addr">
            <b>{short}</b>
          </div>
          <div className="pm-wv-sub">
            LASTPROOF never holds your keys. Every action routes through your
            wallet for signature.
          </div>
          {isSelfProof ? (
            <div className="pm-self-proof-block">
              <div className="pm-self-proof-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="pm-self-proof-msg">
                You cannot verify your own work. Proofs must come from someone
                else&apos;s wallet to maintain trust.
              </div>
              <button
                type="button"
                className="pm-cta pm-cta-dim"
                onClick={onBack}
              >
                &gt; GO BACK
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pm-cta pm-cta-green"
              onClick={onContinue}
              data-testid="pm-wv-continue"
            >
              &gt; CONTINUE
            </button>
          )}
        </div>
      </>
    );
  }

  const targetMeta = WALLET_META[targetWallet];
  const targetLive = liveByCanonical.get(targetWallet);
  const targetConnecting =
    connecting && selectedWallet?.adapter.name === targetLive?.adapter.name;

  return (
    <>
      <div className="pm-eyebrow">&gt; CONNECT {targetMeta.label.toUpperCase()}</div>
      <h2 className="pm-head">
        Connect <span className="pm-accent">{targetMeta.label}.</span>
      </h2>
      <p className="pm-sub">
        One wallet, one proof per project. We&apos;ll verify it hasn&apos;t proofed this project
        before you sign — no gas until you approve.
      </p>

      <div className="pm-wallets">
        {/* Mobile browser: deep-link / app-link for this wallet */}
        {walletEnv === "mobile-browser" ? (
          <a
            className="pm-wallet"
            href={typeof window !== "undefined" ? targetMeta.buildDeepLink(window.location.href) : "#"}
            rel="noopener noreferrer"
          >
            <span className="pm-wallet-label">{targetMeta.label}</span>
            <span className="pm-wallet-hint">
              {targetMeta.hasBrowseLink ? "OPEN IN APP →" : "GET APP →"}
            </span>
            <span className="pm-wallet-hint" style={{ fontSize: 8, marginTop: 2, display: "block", color: "#5a5e73" }}>
              {targetMeta.mobileSub}
            </span>
          </a>
        ) : (
          /* Desktop or in-app browser: adapter connect for this wallet */
          <button
            type="button"
            className={`pm-wallet${targetConnecting ? " pm-connecting" : ""}`}
            onClick={() => handleClick(targetWallet)}
            disabled={connecting}
          >
            <span className="pm-wallet-label">{targetMeta.label}</span>
            <span className="pm-wallet-hint">
              {targetConnecting ? "CONNECTING…" : targetLive ? "CONNECT WALLET →" : "NOT INSTALLED"}
            </span>
          </button>
        )}
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
  ticker,
}: {
  comment: string;
  onChange: (s: string) => void;
  tooLong: boolean;
  ticker: string;
}) {
  const remaining = COMMENT_MAX - comment.length;
  return (
    <>
      <div className="pm-eyebrow">&gt; LEAVE A RECEIPT</div>
      <h2 className="pm-head">
        Say what you <span className="pm-accent">shipped.</span>
      </h2>
      <p className="pm-sub">
        One line lives on the public profile next to this proof. Optional — but
        operators with receipts convert better.
      </p>

      <ProjCard ticker={ticker} />

      <div className="pm-field">
        <label className="pm-field-key" htmlFor="pm-comment-input">
          RECEIPT
          <span className={`pm-char-count${tooLong ? " pm-over" : ""}`}>
            {remaining} / {COMMENT_MAX}
          </span>
        </label>
        <textarea
          id="pm-comment-input"
          className="pm-comment"
          placeholder="e.g. Shipped the meme engine with them — 40k impressions in week 1."
          value={comment}
          onChange={(e) => onChange(e.target.value)}
          maxLength={COMMENT_MAX + 20 /* soft cap, hard cap enforced by disabled CTA */}
        />
      </div>
      <div className="pm-field-help">
        OPTIONAL · NO URLS · NO EMOJI SPAM · ELIGIBILITY IS RUNNING IN THE BACKGROUND
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
  // Token icon glyphs — wireframe uses CDN SVGs; we use glyph fallbacks
  // so the modal renders offline without 3p image dependency.
  const TOKEN_GLYPH: Record<ProofTokenKey, string> = {
    LASTSHFT: "LS",
    SOL: "◎",
    USDT: "₮",
  };
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
                    <span className="pm-token-strike">
                      ${basePrice.toFixed(2)}
                    </span>
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
                  <div className="pm-token-live">
                    ≈ {price.toFixed(2)} {t.key}
                  </div>
                )}
              </div>
              {t.hasDiscountBadge && (
                <span className="pm-token-badge">
                  {LASTSHFT_DISCOUNT_LABEL}
                </span>
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
      <div className="pm-eyebrow">&gt; VERIFYING YOUR WALLET</div>
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
          <div className="pm-inel-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            THIS WALLET ISN&apos;T ELIGIBLE
          </div>
          <div className="pm-inel-disc">
            <span className="pm-inel-disc-dot" />
            YOU&apos;VE BEEN AUTOMATICALLY DISCONNECTED
          </div>
          <div className="pm-inel-body">
            To file a <b>{role === "dev" ? "DEV" : "COLLABORATOR"} proof</b>,
            the connected wallet must match at least one of the on-chain
            signals for this project:
            <ul>
              <li>
                <b>DEPLOYER</b> — signed the token mint transaction
              </li>
              <li>
                <b>MINT AUTHORITY</b> — current mint authority wallet
              </li>
              <li>
                <b>FIRST-5 HOLDER</b> — one of the first 5 holders at mint
                distribution
              </li>
              <li>
                <b>FOUNDER MULTISIG</b> — verified signer on the project
                treasury multisig <i>(v1.1)</i>
              </li>
            </ul>
            {role === "dev" ? (
              <>
                If you&apos;re a collaborator (not a dev), go back and pick the{" "}
                <b>COLLABORATOR</b> path instead.
              </>
            ) : (
              <>
                This wallet has already filed a proof on this project, or
                doesn&apos;t meet the collaborator slot rules.
              </>
            )}
          </div>
          <button
            type="button"
            className="pm-cta pm-cta-inel"
            onClick={onTryNewWallet}
          >
            &gt; TRY A NEW WALLET
          </button>
        </div>
      )}

      {/* WIREFRAME-ONLY toggle to flip scenario without a real wallet */}
      {process.env.NODE_ENV === "development" && (
        <button
          type="button"
          className="pm-cta-ghost"
          style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
          onClick={onToggleIneligible}
        >
          ⟳ TOGGLE ELIGIBILITY (DEV-ONLY) · currently{" "}
          {forceIneligible ? "INELIGIBLE" : "ELIGIBLE"}
        </button>
      )}
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
              <> · EXPIRES IN <span className={countdownCls}>{secsLeft}s</span></>
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
    { key: "awaiting_signature", label: "AWAITING SIGNATURE IN WALLET" },
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
  const failed = sign.phase === "failed";
  // When failed, the rung that was active when the failure hit is the
  // one we want to render in red. We infer it from the signing state:
  // if we have a signature we made it to broadcasting/confirming; if
  // we have a memo we made it at least to awaiting_signature; else
  // building. Lets the red X land on the correct rung without the
  // orchestrator tracking a separate "failedAt" field.
  const failedPhase: SignPhase | null = !failed
    ? null
    : sign.signature
      ? "confirming"
      : sign.memo
        ? "awaiting_signature"
        : "building";

  return (
    <>
      <div className="pm-eyebrow">&gt; WAITING FOR WALLET APPROVAL</div>
      <h2 className="pm-head">
        Approve in your <span className="pm-accent">wallet.</span>
      </h2>
      <p className="pm-sub">
        Open your wallet and approve the transaction. Your wallet will verify
        keys and sign the proof — LASTPROOF never sees your private key.
      </p>

      <div className="pm-sign-wrap">
        <div className="pm-sign-phone" aria-hidden="true">
          <div className="pm-sign-spin" />
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <path d="M11 18h2" />
            <path d="M9 6h6" />
          </svg>
        </div>
      </div>

      <div className="pm-ladder" role="status" aria-live="polite" aria-atomic="false">
        {rungs.map((r) => {
          const rungIdx = order.indexOf(r.key);
          const active = !failed && r.key === sign.phase;
          const done =
            (rungIdx < idx && sign.phase !== "idle" && !failed) ||
            (failed && failedPhase !== null && rungIdx < order.indexOf(failedPhase));
          const errored = failed && r.key === failedPhase;
          const mark = errored ? "✗" : done ? "✓" : active ? "◆" : " ";
          const cls = errored
            ? "pm-rung pm-err"
            : active
              ? "pm-rung pm-active"
              : done
                ? "pm-rung pm-done"
                : "pm-rung";
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
      <div className="pm-field-help">
        DO NOT CLOSE THIS WINDOW · TIMES OUT AFTER 60 SECONDS
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
  ticker,
  handle,
  path,
  pubkey,
  tokenLabel,
  amountUi,
}: {
  sign: ReturnType<typeof useSignFlow>["state"];
  onRetrySign: () => void;
  onRefreshQuote: () => void;
  onChangeToken: () => void;
  onStartOver: () => void;
  onClose: () => void;
  ticker: string;
  handle: string;
  path: ProofPath | null;
  pubkey: string | null;
  tokenLabel: string;
  amountUi: string | null;
}) {
  if (sign.phase === "confirmed") {
    const sigShort = sign.signature
      ? `${sign.signature.slice(0, 6)}…${sign.signature.slice(-6)}`
      : "—";
    return (
      <>
        <div className="pm-done-wrap">
          <div className="pm-done-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="pm-eyebrow">&gt; PROOFED ON-CHAIN</div>
          <h2 className="pm-head">
            <span className="pm-accent">@{handle}</span> thanks you.{" "}
            <span className="pm-green">It&apos;s done.</span>
          </h2>
          <p className="pm-sub">
            Your proof is live. The operator&apos;s count just ticked up by 1.
          </p>
          <div className="pm-proof-summary">
            <div className="pm-ps-row">
              <span className="pm-ps-key">PROJECT</span>
              <span className="pm-ps-val pm-green">{ticker}</span>
            </div>
            <div className="pm-ps-row">
              <span className="pm-ps-key">PROOF TYPE</span>
              <span className="pm-ps-val">
                {path === "dev" ? "DEV" : "COLLABORATOR"}
              </span>
            </div>
            <div className="pm-ps-row">
              <span className="pm-ps-key">FROM</span>
              <span className="pm-ps-val pm-mono">
                {pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : "—"}
              </span>
            </div>
            <div className="pm-ps-row">
              <span className="pm-ps-key">PAID</span>
              <span className="pm-ps-val">
                {amountUi ?? "—"} {tokenLabel}
              </span>
            </div>
            <div className="pm-ps-row">
              <span className="pm-ps-key">SIGNATURE</span>
              <span className="pm-ps-val pm-mono">{sigShort}</span>
            </div>
            <div className="pm-ps-row">
              <span className="pm-ps-key">SOLSCAN</span>
              <span className="pm-ps-val">
                {sign.solscanUrl ? (
                  <a href={sign.solscanUrl} target="_blank" rel="noopener noreferrer">
                    VIEW ↗
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
          <button type="button" className="pm-cta pm-cta-green" onClick={onClose}>
            &gt; BACK TO PROFILE
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
      <div className="pm-done-wrap">
        <div className="pm-done-check pm-fail" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <div className="pm-eyebrow pm-eyebrow-fail">&gt; TRANSACTION FAILED</div>
        <h2 className="pm-head">
          {copy.title.toLowerCase()} —{" "}
          <span className="pm-red">nothing was charged.</span>
        </h2>
        <p className="pm-sub">{copy.sub}</p>
        <div className="pm-proof-summary">
          <div className="pm-ps-row">
            <span className="pm-ps-key">PROJECT</span>
            <span className="pm-ps-val pm-green">{ticker}</span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">FROM</span>
            <span className="pm-ps-val pm-mono">
              {pubkey ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}` : "—"}
            </span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">ATTEMPTED</span>
            <span className="pm-ps-val">
              {amountUi ?? "—"} {tokenLabel}
            </span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">ERROR</span>
            <span className="pm-ps-val pm-red">
              {reason.toUpperCase().replace(/_/g, " ")}
            </span>
          </div>
          <div className="pm-ps-row">
            <span className="pm-ps-key">CHARGED</span>
            <span className="pm-ps-val pm-green">$0.00 · NOTHING SENT</span>
          </div>
        </div>
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
