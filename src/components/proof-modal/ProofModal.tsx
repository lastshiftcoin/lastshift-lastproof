"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import "./proof-modal.css";
import type { ProofPath, ProofStep } from "./types";
import { useEligibilityStream } from "./useEligibilityStream";
import { useQuoteRefresh } from "./useQuoteRefresh";
import type { ProofQuote } from "./types";
import { useConnected, type ConnectedWallet } from "@/lib/wallet/use-connected";
import { WALLET_META, WALLET_ORDER, shouldUseDeepLinks } from "@/lib/wallet/deep-link";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";
import {
  PROOF_TOKENS,
  PROOF_BASE_PRICE_USD,
  LASTSHFT_DISCOUNT_LABEL,
  BUY_LASTSHFT_URL,
  getProofPriceUsd,
  type ProofToken,
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
  const [token, setToken] = useState<ProofToken>("LASTSHFT");
  /**
   * Tracks which token the currently-cached eligibility stream was
   * run for. When the user changes token on step 4 and advances to
   * step 5, we compare `token` vs `streamedToken` and re-fire if they
   * differ. Null when no stream has been kicked off yet.
   */
  const [streamedToken, setStreamedToken] = useState<ProofToken | null>(null);
  /** WIREFRAME-ONLY toggle — lets us flip mock scenario without a real wallet. */
  const [forceIneligible, setForceIneligible] = useState(false);
  /**
   * DEV-ONLY: mock wallet bypass. Lets us smoke-test steps 3+ in a
   * headless browser where wallet extensions don't exist. Tree-shaken
   * in production builds via `process.env.NODE_ENV !== "production"`.
   */
  const [mockConnected, setMockConnected] = useState<ConnectedWallet | null>(null);

  const { state: elig, start, reset } = useEligibilityStream();
  const realConnected = useConnected();
  const connected = realConnected ?? mockConnected;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPath(null);
      setComment("");
      setToken("LASTSHFT");
      setStreamedToken(null);
      setForceIneligible(false);
      setMockConnected(null);
      reset();
    }
  }, [open, reset]);

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

  // Step 2 drives its own CTA (per-wallet buttons). Hide the global
  // continue bar there entirely.
  const hideCta =
    step === 2 ||
    step === 6 ||
    (step === 5 && elig.status === "done" && !elig.eligible);

  return (
    <div className="pm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-shell" onClick={(e) => e.stopPropagation()}>
        <div className="pm-bar">
          <span className="pm-bar-title">LASTPROOF · VERIFY THIS WORK</span>
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
              onSign={() => setStep(7)}
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
  token: ProofToken;
  onPick: (t: ProofToken) => void;
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

      <div className={`pm-term${isIneligible ? " pm-fail" : ""}`}>
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
