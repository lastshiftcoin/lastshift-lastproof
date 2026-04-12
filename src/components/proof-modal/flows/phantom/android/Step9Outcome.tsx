"use client";

import type { ProofPath, FailureReason } from "../../../types";
import type { useSignFlow } from "../../../useSignFlow";

export interface Step9OutcomeProps {
  sign: ReturnType<typeof useSignFlow>["state"];
  ticker: string;
  handle: string;
  path: ProofPath | null;
  pubkey: string | null;
  tokenLabel: string;
  amountUi: string | null;
  onRetrySign: () => void;
  onRefreshQuote: () => void;
  onChangeToken: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

type RecoveryKind =
  | "retry_sign"
  | "refresh_quote"
  | "change_token"
  | "start_over"
  | "close";

interface Recovery {
  kind: RecoveryKind;
  label: string;
}

const FAILURE_COPY: Record<
  FailureReason,
  { title: string; sub: string; primary: Recovery; secondary?: Recovery }
> = {
  user_rejected: {
    title: "YOU CANCELLED",
    sub: "You declined the signature in Phantom. No money moved. The quote is still live — try again when you're ready.",
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
    sub: "The signed transaction sat too long before landing. A fresh tx will be built and signed — one more tap in Phantom.",
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
    sub: "The signed transaction didn't match what the backend expected. Reconnect Phantom and start fresh.",
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

export function Step9Outcome({
  sign,
  ticker,
  handle,
  path,
  pubkey,
  tokenLabel,
  amountUi,
  onRetrySign,
  onRefreshQuote,
  onChangeToken,
  onStartOver,
  onClose,
}: Step9OutcomeProps) {
  if (sign.phase === "confirmed") {
    const sigShort = sign.signature
      ? `${sign.signature.slice(0, 6)}…${sign.signature.slice(-6)}`
      : "—";
    return (
      <>
        <div className="pm-done-wrap">
          <div className="pm-done-check" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
                {pubkey
                  ? `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
                  : "—"}
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
                  <a
                    href={sign.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    VIEW ↗
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        </div>
        <div
          className="pm-cta-bar"
          style={{ marginTop: 18, padding: 0, border: 0 }}
        >
          <button
            type="button"
            className="pm-cta pm-cta-green"
            onClick={onClose}
          >
            &gt; BACK TO PROFILE
          </button>
        </div>
      </>
    );
  }

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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <div className="pm-eyebrow pm-eyebrow-fail">
          &gt; TRANSACTION FAILED
        </div>
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
      <div
        className="pm-cta-bar"
        style={{ marginTop: 18, padding: 0, border: 0 }}
      >
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
