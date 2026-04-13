"use client";

/**
 * PasteVerifyFlow V3 — 6-screen proof flow, no wallet connect.
 *
 * User is anonymous until they submit a TX. Everything we need
 * comes from the on-chain transaction itself.
 *
 * Screens:
 *   1  Path      — collab / dev
 *   2  Token     — LASTSHFT / SOL / USDT with prices
 *   3  Send      — treasury address + copy button + instructions
 *   4  Paste     — paste TX URL + optional comment + submit
 *   5  Terminal  — verification cascade + deployment
 *   6  Receipt   — proof confirmed, screenshot-friendly
 *
 * 3-tier failure recovery:
 *   Tier 1 (attempt 1): TRY AGAIN → back to Screen 4
 *   Tier 2 (attempt 2): DEEP VERIFY → re-submit with deep=true
 *   Tier 3 (attempt 3+): OPEN SUPPORT TICKET
 */

import { useCallback, useEffect, useState } from "react";
import type { ProofPath } from "../../types";
import type { ProofTokenKey } from "@/lib/proof-tokens";

import { Screen1Path } from "./Screen1Path";
import { Screen2Token } from "./Screen2Token";
import { Screen3Send } from "./Screen3Send";
import { Screen4Paste } from "./Screen4Paste";
import { Screen5Terminal } from "./Screen5Terminal";
import { Screen6Receipt } from "./Screen6Receipt";

type PvScreen = 1 | 2 | 3 | 4 | 5 | 6;

const SESSION_STORAGE_PREFIX = "lp_session_";

export interface PasteVerifyFlowProps {
  workItemId: string;
  ticker: string;
  handle: string;
  onClose: () => void;
}

export function PasteVerifyFlow({
  workItemId,
  ticker,
  handle,
  onClose,
}: PasteVerifyFlowProps) {
  const [screen, setScreen] = useState<PvScreen>(1);
  const [path, setPath] = useState<ProofPath | null>(null);
  const [token, setToken] = useState<ProofTokenKey>("LASTSHFT");
  const [comment, setComment] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [proofData, setProofData] = useState<Record<string, unknown> | null>(null);
  const [solscanUrl, setSolscanUrl] = useState<string | null>(null);
  const [failureAttempt, setFailureAttempt] = useState(0);
  const [failureCheck, setFailureCheck] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [showFailure, setShowFailure] = useState(false);

  // Session anti-scam: create session on mount, persist in localStorage
  const [sessionId, setSessionId] = useState<string | null>(null);
  const storageKey = `${SESSION_STORAGE_PREFIX}${workItemId}`;

  useEffect(() => {
    // Check localStorage for existing session
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { session_id: string; opened_at: string };
        setSessionId(parsed.session_id);
        return;
      }
    } catch { /* no stored session */ }

    // Create new session
    fetch("/api/proof/session-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_item_id: workItemId }),
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
          } catch { /* storage full — continue without persistence */ }
        }
      })
      .catch(() => { /* session creation failed — submit will fail gracefully */ });
  }, [workItemId, storageKey]);

  const handlePathPick = useCallback((p: ProofPath) => {
    setPath(p);
    setScreen(2);
  }, []);

  const handleTokenPick = useCallback((t: ProofTokenKey) => {
    setToken(t);
  }, []);

  const handleContinueFromToken = useCallback(() => {
    setScreen(3);
  }, []);

  const handleContinueToSubmit = useCallback(() => {
    setScreen(4);
  }, []);

  const handleSubmit = useCallback(
    async (signatureInput: string) => {
      if (!path || !sessionId) return;
      try {
        const res = await fetch("/api/proof/verify-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: signatureInput,
            path,
            token,
            work_item_id: workItemId,
            session_id: sessionId,
            comment: comment || undefined,
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
          silent_duplicate?: boolean;
        };

        if (!data.ok) {
          setFailureAttempt((a) => a + 1);
          setFailureCheck(data.error ?? "unknown");
          setFailureDetail(data.detail ?? data.error ?? "Submission failed.");
          setShowFailure(true);
          return;
        }

        // Silent duplicate or already verified
        if (data.status === "verified" && data.proof_id) {
          // Clear session from localStorage on success
          try { localStorage.removeItem(storageKey); } catch {}
          setProofData({ proof_id: data.proof_id });
          setScreen(6);
          return;
        }

        setVerificationId(data.verification_id!);
        setShowFailure(false);
        setScreen(5);
      } catch {
        setFailureAttempt((a) => a + 1);
        setFailureCheck("network");
        setFailureDetail("Failed to reach the server. Check your connection.");
        setShowFailure(true);
      }
    },
    [path, token, workItemId, sessionId, comment, failureAttempt, storageKey],
  );

  const handleVerified = useCallback(
    (data: Record<string, unknown>, sUrl: string | null) => {
      // Clear session from localStorage on success
      try { localStorage.removeItem(storageKey); } catch {}
      setProofData(data);
      setSolscanUrl(sUrl);
      setScreen(6);
    },
    [storageKey],
  );

  const handleTerminalFailed = useCallback(
    (check: string, detail: string, attempt: number) => {
      setFailureAttempt(attempt);
      setFailureCheck(check);
      setFailureDetail(detail);
      setShowFailure(true);
      setScreen(4);
    },
    [],
  );

  const handleTryAgain = useCallback(() => {
    setVerificationId(null);
    setShowFailure(false);
    setScreen(4);
  }, []);

  // Back navigation
  const handleBack = useCallback(() => {
    if (screen === 2) setScreen(1);
    else if (screen === 3) setScreen(2);
    else if (screen === 4) setScreen(3);
  }, [screen]);

  // Screen number for progress bar
  const totalSteps = 6;

  return (
    <>
      {/* Progress bar — no step counter, just the bar */}
      <div className="pm-progress-wrap">
        <div className="pm-bar-track">
          <div
            className="pm-bar-fill"
            style={{ width: `${(screen / totalSteps) * 100}%` }}
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
          <Screen2Token path={path} token={token} onPick={handleTokenPick} />
        )}
        {screen === 3 && path && (
          <Screen3Send path={path} token={token} />
        )}
        {screen === 4 && path && (
          <Screen4Paste
            comment={comment}
            onCommentChange={setComment}
            onSubmit={handleSubmit}
            failureCheck={showFailure ? failureCheck : null}
            failureDetail={showFailure ? failureDetail : null}
            failureAttempt={failureAttempt}
            onTryAgain={handleTryAgain}
          />
        )}
        {screen === 5 && verificationId && (
          <Screen5Terminal
            verificationId={verificationId}
            handle={handle}
            onVerified={handleVerified}
            onFailed={handleTerminalFailed}
          />
        )}
        {screen === 6 && proofData && (
          <Screen6Receipt
            proofData={proofData}
            solscanUrl={solscanUrl}
            ticker={ticker}
            handle={handle}
            path={path!}
            token={token}
            onClose={onClose}
          />
        )}
      </div>

      {/* Navigation bar for screens 2-4 */}
      {(screen === 2 || screen === 3 || screen === 4) && (
        <div className="pm-cta-bar" style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            type="button"
            className="pm-cta-ghost"
            onClick={handleBack}
          >
            &lt; BACK
          </button>
          {screen === 2 && (
            <button type="button" className="pm-cta" onClick={handleContinueFromToken}>
              &gt; CONTINUE
            </button>
          )}
          {screen === 3 && (
            <button type="button" className="pm-cta" onClick={handleContinueToSubmit}>
              &gt; SUBMIT TRANSACTION RECEIPT
            </button>
          )}
        </div>
      )}
    </>
  );
}
