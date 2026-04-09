"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import "./proof-modal.css";
import type { ProofPath, ProofStep } from "./types";
import { useEligibilityStream } from "./useEligibilityStream";
import { useConnected } from "@/lib/wallet/use-connected";
import { WALLET_META, WALLET_ORDER, shouldUseDeepLinks } from "@/lib/wallet/deep-link";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";

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
  /** WIREFRAME-ONLY toggle — lets us flip mock scenario without a real wallet. */
  const [forceIneligible, setForceIneligible] = useState(false);

  const { state: elig, start, reset } = useEligibilityStream();
  const connected = useConnected();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPath(null);
      setForceIneligible(false);
      reset();
    }
  }, [open, reset]);

  // Auto-advance step 2 → 5 once wallet is connected & allowlisted
  useEffect(() => {
    if (step === 2 && connected) {
      setStep(5);
    }
  }, [step, connected]);

  // When user advances to step 5, fire the stream with the connected
  // pubkey (or the hardcoded dev-mode fallback when the wireframe
  // toggle is flipped without a real wallet).
  useEffect(() => {
    if (step === 5 && path && elig.status === "idle") {
      start({
        path,
        scenario: forceIneligible ? "ineligible" : "eligible",
        pubkey:
          connected?.pubkey ?? "F7k2QJm9Np8xWv3sH5cB4aRtY6eZu1oKdL2fVgXpN9xMp",
        project: ticker,
      });
    }
  }, [step, path, elig.status, start, forceIneligible, ticker, connected]);

  const handleContinue = useCallback(() => {
    if (step === 1 && path) {
      setStep(connected ? 5 : 2);
    } else if (step === 5 && elig.status === "done" && elig.eligible) {
      setStep(6);
    }
  }, [step, path, elig.status, elig.eligible, connected]);

  const handleTryNewWallet = useCallback(() => {
    reset();
    setStep(1);
    setPath(null);
    setForceIneligible(false);
  }, [reset]);

  if (!open) return null;

  const continueDisabled =
    (step === 1 && !path) ||
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
            <Step2WalletPicker onBack={() => setStep(1)} />
          )}
          {step === 5 && (
            <Step5Eligibility
              path={path!}
              elig={elig}
              onTryNewWallet={handleTryNewWallet}
              forceIneligible={forceIneligible}
              onToggleIneligible={() => {
                setForceIneligible((v) => !v);
                reset();
              }}
            />
          )}
          {step === 6 && (
            <Step6ReviewStub quote={elig.quote} onBack={handleTryNewWallet} />
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
function Step2WalletPicker({ onBack }: { onBack: () => void }) {
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

// ─── Step 6 (stub) ──────────────────────────────────────────────────────

function Step6ReviewStub({
  quote,
  onBack,
}: {
  quote: ReturnType<typeof useEligibilityStream>["state"]["quote"];
  onBack: () => void;
}) {
  return (
    <>
      <div className="pm-eyebrow">REVIEW BEFORE YOU SIGN</div>
      <h2 className="pm-head">
        One last <span className="pm-accent">look.</span>
      </h2>
      <p className="pm-sub">
        <i>Step 6 is a stub in this commit.</i> Full review card + live price ticker + quote-expired
        sub-state + sign flow land in follow-up commits.
      </p>
      <div className="pm-term">
        <div className="pm-term-line pm-ok">
          &gt; quote locked: {quote?.amount_ui} {quote?.token} (${quote?.usd})
        </div>
        <div className="pm-term-line">
          &gt; quote_id: {quote?.quote_id}
        </div>
        <div className="pm-term-line">
          &gt; expires_at: {quote?.expires_at}
        </div>
      </div>
      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 18, padding: "10px 14px" }}
        onClick={onBack}
      >
        &gt; START OVER
      </button>
    </>
  );
}
