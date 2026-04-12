"use client";

/**
 * Phantom Android flow orchestrator.
 *
 * 9-step proof flow for Phantom on Android using Mobile Wallet Adapter
 * (MWA). No deep links, no page reload — the wallet adapter fires an
 * Android intent, Phantom handles it, and Chrome returns to the
 * foreground with state preserved.
 *
 * Step mapping:
 *   1  Select    — confirm Phantom selection
 *   2  Connect   — MWA intent → Phantom app → approve → back to Chrome
 *   3  Path      — collab / dev
 *   4  Comment   — 140 char receipt
 *   5  Token     — LASTSHFT / SOL / USDT
 *   6  Eligibility — SSE stream
 *   7  Review    — live price ticker
 *   8  Sign      — MWA intent → Phantom app → approve tx → back to Chrome
 *   9  Outcome   — confirmed or failed with recovery CTAs
 */

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { ProofPath, ProofStep } from "../../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";
import { useEligibilityStream } from "../../../useEligibilityStream";
import { useSignFlow } from "../../../useSignFlow";
import { useConnected, type ConnectedWallet } from "@/lib/wallet/use-connected";

import { Step1Select } from "./Step1Select";
import { Step2Connect } from "./Step2Connect";
import { Step3Path } from "./Step3Path";
import { Step4Comment } from "./Step4Comment";
import { Step5Token } from "./Step5Token";
import { Step6Eligibility } from "./Step6Eligibility";
import { Step7Review } from "./Step7Review";
import { Step8Sign } from "./Step8Sign";
import { Step9Outcome } from "./Step9Outcome";

const COMMENT_MAX = 140;

export interface PhantomAndroidFlowProps {
  workItemId: string;
  ticker: string;
  handle: string;
  ownerWallet: string;
  onClose: () => void;
  /** Called when user wants to go back to the wallet picker (step 1 of parent). */
  onBackToWalletSelect: () => void;
}

export function PhantomAndroidFlow({
  workItemId,
  ticker,
  handle,
  ownerWallet,
  onClose,
  onBackToWalletSelect,
}: PhantomAndroidFlowProps) {
  const [step, setStep] = useState<ProofStep>(1);
  const [path, setPath] = useState<ProofPath | null>(null);
  const [comment, setComment] = useState("");
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  const [streamedToken, setStreamedToken] = useState<ProofTokenKey | null>(null);
  const [forceIneligible, setForceIneligible] = useState(false);

  const { state: elig, start, reset } = useEligibilityStream();
  const { state: sign, start: startSign, reset: resetSign } = useSignFlow();
  const connected = useConnected();
  const { signTransaction } = useWallet();

  const isSelfProof = Boolean(
    connected && ownerWallet && connected.pubkey === ownerWallet,
  );

  const commentTooLong = comment.length > COMMENT_MAX;

  // Abandon-on-close
  const fireAbandon = useCallback((quoteId: string) => {
    try {
      fetch("/api/proof/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, []);

  // Step 8 → 9 auto-advance on terminal sign phase
  useEffect(() => {
    if (step === 8 && (sign.phase === "confirmed" || sign.phase === "failed")) {
      setStep(9);
    }
  }, [step, sign.phase]);

  // Eligibility prefetch: fires when wallet connected + path selected
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, connected, path]);

  const handleContinue = useCallback(() => {
    if (step === 3 && path) {
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
    if (step === 5) {
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
    workItemId,
  ]);

  const kickOffSigning = useCallback(() => {
    if (!elig.quote || !path || !connected) return;
    setStep(8);
    startSign({
      quoteId: elig.quote.quote_id,
      pubkey: connected.pubkey,
      handle,
      ticker,
      path,
      signTransactionBase64: async (txBase64: string) => {
        if (!signTransaction) {
          throw new Error("Wallet does not support signing");
        }
        const { Transaction } = await import("@solana/web3.js");
        const tx = Transaction.from(
          Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0)),
        );
        const signed = await signTransaction(tx);
        const bytes = signed.serialize();
        let bin = "";
        bytes.forEach((b: number) => (bin += String.fromCharCode(b)));
        return btoa(bin);
      },
    });
  }, [elig.quote, path, connected, handle, ticker, signTransaction, startSign]);

  const handleRefreshQuote = useCallback(() => {
    resetSign();
    setStreamedToken(null);
    setStep(4);
  }, [resetSign]);

  const handleChangeToken = useCallback(() => {
    resetSign();
    setStep(5);
  }, [resetSign]);

  const handleTryNewWallet = useCallback(() => {
    reset();
    resetSign();
    onBackToWalletSelect();
  }, [reset, resetSign, onBackToWalletSelect]);

  const handleToggleIneligible = useCallback(() => {
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

  // Close handler — fires abandon if needed
  const handleClose = useCallback(() => {
    const hasQuote = elig.quote?.quote_id;
    const preBroadcast =
      sign.phase === "idle" ||
      sign.phase === "building" ||
      sign.phase === "awaiting_signature";
    if (
      hasQuote &&
      preBroadcast &&
      (step === 6 || step === 7 || step === 8)
    ) {
      fireAbandon(elig.quote!.quote_id);
    }
    onClose();
  }, [elig.quote, sign.phase, step, fireAbandon, onClose]);

  // Determine CTA visibility
  const hideCta =
    step === 1 ||
    step === 2 ||
    step === 7 ||
    step === 8 ||
    step === 9 ||
    (step === 6 && elig.status === "done" && !elig.eligible);

  const continueDisabled =
    (step === 3 && !path) ||
    (step === 4 && commentTooLong) ||
    (step === 6 && (elig.status !== "done" || !elig.eligible));

  return (
    <>
      {/* Step counter + connected-wallet pill */}
      <div className="pm-ref-row">
        {connected && step >= 3 ? (
          <button
            type="button"
            className="pm-conn-pill"
            onClick={handleTryNewWallet}
            title="Click to disconnect"
          >
            <span className="pm-conn-dot" />
            <span className="pm-conn-label">CONNECTED</span>
            <span className="pm-conn-addr">
              {connected.pubkey.slice(0, 4)}…{connected.pubkey.slice(-4)}
            </span>
          </button>
        ) : (
          <span />
        )}
        <span className="pm-step-counter">
          STEP <span className="pm-step-now">{step}</span> / 9
        </span>
      </div>

      <div className="pm-progress-wrap">
        <div className="pm-bar-track">
          <div
            className="pm-bar-fill"
            style={{ width: `${(step / 9) * 100}%` }}
          />
        </div>
      </div>

      <div className="pm-body">
        {step === 1 && (
          <Step1Select
            onContinue={() => setStep(2)}
            onBack={onBackToWalletSelect}
          />
        )}
        {step === 2 && (
          <Step2Connect
            connected={connected}
            isSelfProof={isSelfProof}
            onConnected={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Path
            path={path}
            onPick={setPath}
            ticker={ticker}
            handle={handle}
          />
        )}
        {step === 4 && (
          <Step4Comment
            comment={comment}
            onChange={setComment}
            tooLong={commentTooLong}
            ticker={ticker}
          />
        )}
        {step === 5 && (
          <Step5Token path={path!} token={token} onPick={setToken} />
        )}
        {step === 6 && (
          <Step6Eligibility
            path={path!}
            elig={elig}
            onTryNewWallet={handleTryNewWallet}
            forceIneligible={forceIneligible}
            onToggleIneligible={handleToggleIneligible}
          />
        )}
        {step === 7 && elig.quote && path && (
          <Step7Review
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
        {step === 8 && <Step8Sign sign={sign} />}
        {step === 9 && (
          <Step9Outcome
            sign={sign}
            ticker={ticker}
            handle={handle}
            path={path}
            pubkey={connected?.pubkey ?? null}
            tokenLabel={token}
            amountUi={
              elig.quote?.amount_ui != null
                ? String(elig.quote.amount_ui)
                : null
            }
            onRetrySign={kickOffSigning}
            onRefreshQuote={handleRefreshQuote}
            onChangeToken={handleChangeToken}
            onStartOver={handleTryNewWallet}
            onClose={handleClose}
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
    </>
  );
}
