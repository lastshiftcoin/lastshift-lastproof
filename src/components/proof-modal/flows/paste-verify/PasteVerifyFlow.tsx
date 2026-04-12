"use client";

/**
 * PasteVerifyFlow — 5-screen proof flow (paste-to-verify).
 *
 * User pays manually in their wallet, pastes the Solscan URL or tx
 * signature, server verifies via queue + Helius RPC, records proof.
 *
 * Screens:
 *   1  Path     — collab / dev
 *   2  Token    — LASTSHFT / SOL / USDT
 *   3  Pay      — treasury address + paste field
 *   4  Verify   — terminal-style verification polling
 *   5  Success  — proof confirmed
 *
 * 3-tier failure recovery:
 *   Tier 1 (attempt 1): TRY AGAIN → back to Screen 3
 *   Tier 2 (attempt 2): DEEP VERIFY → re-submit with deep=true
 *   Tier 3 (attempt 3+): OPEN SUPPORT TICKET → mailto:reportclaims@lastproof.app
 */

import { useCallback, useState } from "react";
import type { ProofPath } from "../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";
import type { ConnectedWallet } from "@/lib/wallet/use-connected";

import { Screen1Path } from "./Screen1Path";
import { Screen2Token } from "./Screen2Token";
import { Screen3Pay } from "./Screen3Pay";
import { Screen4Verify } from "./Screen4Verify";
import { Screen5Success } from "./Screen5Success";

type PvScreen = 1 | 2 | 3 | 4 | 5 | "failed";

export interface PasteVerifyFlowProps {
  workItemId: string;
  ticker: string;
  handle: string;
  connected: ConnectedWallet;
  onClose: () => void;
  onBackToWalletSelect: () => void;
}

export function PasteVerifyFlow({
  workItemId,
  ticker,
  handle,
  connected,
  onClose,
  onBackToWalletSelect,
}: PasteVerifyFlowProps) {
  const [screen, setScreen] = useState<PvScreen>(1);
  const [path, setPath] = useState<ProofPath | null>(null);
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [proofId, setProofId] = useState<string | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [failureAttempt, setFailureAttempt] = useState(0);
  const [failureCheck, setFailureCheck] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);

  const handlePathPick = useCallback((p: ProofPath) => {
    setPath(p);
  }, []);

  const handleContinueFromPath = useCallback(() => {
    if (path) setScreen(2);
  }, [path]);

  const handleContinueFromToken = useCallback(() => {
    setScreen(3);
  }, []);

  const handleSubmitSignature = useCallback(
    async (signatureInput: string) => {
      if (!path) return;
      try {
        const res = await fetch("/api/proof/verify-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: signatureInput,
            pubkey: connected.pubkey,
            path,
            token,
            work_item_id: workItemId,
            deep: failureAttempt >= 1,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          verification_id?: string;
          error?: string;
          detail?: string;
          status?: string;
          proof_id?: string;
        };

        if (!data.ok) {
          setFailureAttempt((a) => a + 1);
          setFailureCheck(data.error ?? "unknown");
          setFailureDetail(data.detail ?? data.error ?? "Submission failed.");
          setScreen("failed");
          return;
        }

        // Already verified (re-submission of previously verified sig)
        if (data.status === "verified" && data.proof_id) {
          setProofId(data.proof_id);
          setScreen(5);
          return;
        }

        setVerificationId(data.verification_id!);
        setScreen(4);
      } catch {
        setFailureAttempt((a) => a + 1);
        setFailureCheck("network");
        setFailureDetail("Failed to reach the server. Check your connection.");
        setScreen("failed");
      }
    },
    [path, token, connected.pubkey, workItemId, failureAttempt],
  );

  const handleVerified = useCallback((pId: string, sUrl: string | null) => {
    setProofId(pId);
    setSolscanUrl(sUrl);
    setScreen(5);
  }, []);

  const handleFailed = useCallback(
    (check: string, detail: string, attempt: number) => {
      setFailureAttempt(attempt);
      setFailureCheck(check);
      setFailureDetail(detail);
      setScreen("failed");
    },
    [],
  );

  const handleTryAgain = useCallback(() => {
    setVerificationId(null);
    setScreen(3);
  }, []);

  const handleDeepVerify = useCallback(() => {
    // Go back to paste screen — the next submit will have deep=true
    setVerificationId(null);
    setScreen(3);
  }, []);

  // Screen number for progress bar (failed counts as screen 4)
  const screenNum = screen === "failed" ? 4 : screen;
  const totalScreens = 5;

  return (
    <>
      <div className="pm-ref-row">
        {connected && screen !== 1 ? (
          <button
            type="button"
            className="pm-conn-pill"
            onClick={onBackToWalletSelect}
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
          STEP <span className="pm-step-now">{screenNum}</span> / {totalScreens}
        </span>
      </div>

      <div className="pm-progress-wrap">
        <div className="pm-bar-track">
          <div
            className="pm-bar-fill"
            style={{ width: `${(screenNum / totalScreens) * 100}%` }}
          />
        </div>
      </div>

      <div className="pm-body">
        {screen === 1 && (
          <Screen1Path
            path={path}
            onPick={handlePathPick}
            ticker={ticker}
            handle={handle}
          />
        )}
        {screen === 2 && path && (
          <Screen2Token path={path} token={token} onPick={setToken} />
        )}
        {screen === 3 && path && (
          <Screen3Pay
            path={path}
            token={token}
            pubkey={connected.pubkey}
            onSubmit={handleSubmitSignature}
          />
        )}
        {screen === 4 && verificationId && (
          <Screen4Verify
            verificationId={verificationId}
            onVerified={handleVerified}
            onFailed={handleFailed}
          />
        )}
        {screen === 5 && proofId && path && (
          <Screen5Success
            ticker={ticker}
            handle={handle}
            path={path}
            pubkey={connected.pubkey}
            tokenLabel={token}
            proofId={proofId}
            solscanUrl={solscanUrl}
            onClose={onClose}
          />
        )}

        {/* 3-tier failure recovery */}
        {screen === "failed" && (
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
                &gt; VERIFICATION FAILED
              </div>
              <h2 className="pm-head">
                {failureCheck === "wrong_sender"
                  ? "wrong wallet"
                  : failureCheck === "wrong_amount"
                    ? "wrong amount"
                    : failureCheck === "tx_too_old"
                      ? "transaction too old"
                      : failureCheck === "already_used"
                        ? "already used"
                        : "verification failed"}{" "}
                — <span className="pm-red">nothing was recorded.</span>
              </h2>
              <p className="pm-sub">{failureDetail}</p>
            </div>

            {/* Tier 1: Try Again (attempt 1) */}
            {failureAttempt <= 1 && (
              <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
                <button type="button" className="pm-cta" onClick={handleTryAgain}>
                  &gt; TRY AGAIN
                </button>
              </div>
            )}

            {/* Tier 2: Deep Verify (attempt 2) */}
            {failureAttempt === 2 && (
              <>
                <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
                  <button type="button" className="pm-cta" onClick={handleDeepVerify}>
                    &gt; DEEP VERIFICATION
                  </button>
                </div>
                <div className="pm-field-help" style={{ marginTop: 6 }}>
                  RUNS ADDITIONAL CHECKS INCLUDING INNER INSTRUCTIONS AND ALTERNATE TOKEN ACCOUNTS
                </div>
              </>
            )}

            {/* Tier 3: Support Ticket (attempt 3+) */}
            {failureAttempt >= 3 && (
              <>
                <div className="pm-cta-bar" style={{ marginTop: 18, padding: 0, border: 0 }}>
                  <a
                    className="pm-cta"
                    style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                    href={`mailto:reportclaims@lastproof.app?subject=Proof%20Verification%20Failed%20—%20${encodeURIComponent(failureCheck ?? "unknown")}&body=${encodeURIComponent(`Wallet: ${connected.pubkey}\nCheck: ${failureCheck}\nDetail: ${failureDetail}\nAttempts: ${failureAttempt}`)}`}
                  >
                    &gt; OPEN SUPPORT TICKET
                  </a>
                </div>
                <p className="pm-sub" style={{ marginTop: 10 }}>
                  If you believe this transaction is valid, our team will review
                  it manually.
                </p>
                <button
                  type="button"
                  className="pm-cta-ghost"
                  style={{ marginTop: 10, padding: "8px 12px", fontSize: 11 }}
                  onClick={handleTryAgain}
                >
                  TRY AGAIN
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Continue bar for screens 1 and 2 */}
      {(screen === 1 || screen === 2) && (
        <div className="pm-cta-bar">
          <button
            type="button"
            className="pm-cta"
            disabled={screen === 1 && !path}
            onClick={screen === 1 ? handleContinueFromPath : handleContinueFromToken}
          >
            &gt; CONTINUE
          </button>
        </div>
      )}
    </>
  );
}
