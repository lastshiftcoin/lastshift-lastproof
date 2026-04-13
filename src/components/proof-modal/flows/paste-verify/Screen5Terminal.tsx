"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Preloaded denial messages — factual, no detail leakage. */
const DENIAL_MESSAGES: Record<string, string> = {
  tx_not_found: "TRANSACTION NOT FOUND ON SOLANA",
  tx_failed_onchain: "TRANSACTION FAILED ON-CHAIN",
  wrong_recipient: "PAYMENT NOT SENT TO LASTPROOF TREASURY",
  amount_too_low: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_too_high: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_not_found: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  tx_before_session: "Nice try. Scamming will die in web3. Support your friend and purchase a proof for them.",
  self_proof: "PROFILE OWNER CANNOT VERIFY THEIR OWN WORK",
  dev_not_qualified: "WALLET NOT QUALIFIED FOR DEV VERIFICATION",
  rpc_error: "VERIFICATION INTERRUPTED — TRY AGAIN",
};

interface TerminalLine {
  text: string;
  status: "ok" | "fail" | "pending" | "info";
}

interface StatusResponse {
  ok: boolean;
  status: "queued" | "processing" | "verified" | "failed";
  failure_check?: string;
  failure_detail?: string;
  attempt_number?: number;
  proof_id?: string;
  queue_position?: number | null;
  solscan_url?: string | null;
  sender_pubkey?: string | null;
  comment?: string | null;
  proof_data?: Record<string, unknown> | null;
}

export interface Screen5TerminalProps {
  verificationId: string;
  handle: string;
  onVerified: (proofData: Record<string, unknown>, solscanUrl: string | null) => void;
  onFailed: (check: string, detail: string, attempt: number) => void;
}

// Verification check lines to cascade
const VERIFY_CHECKS = [
  "SCANNING SOLANA MAINNET FOR TX...",
  "TX LOCATED",
  "CHECKING RECIPIENT... ✓ CONFIRMED",
  "CHECKING AMOUNT... ✓ CONFIRMED",
  "CHECKING TIME WINDOW... ✓ CONFIRMED",
  "CHECKING SIGNATURE... ✓ UNIQUE",
  "ALL CHECKS PASSED",
];

const DEPLOY_LINES = (handle: string, proofData: Record<string, unknown>) => [
  `DEPLOYING PROOF TO @${handle}...`,
  "WRITING TO PROOF LEDGER...",
  `ASSIGNING PROOF ID: ${String(proofData.proof_id ?? "").slice(0, 8)}…`,
  "UPDATING OPERATOR PROFILE...",
  `PROOF COUNT: ${proofData.proof_count ?? "—"}`,
  "PROOF DEPLOYED — LIVE ON PROFILE",
];

export function Screen5Terminal({
  verificationId,
  handle,
  onVerified,
  onFailed,
}: Screen5TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: "INITIATING PROOF VERIFICATION...", status: "info" },
  ]);
  const [phase, setPhase] = useState<"verifying" | "deploying" | "done" | "failed">("verifying");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const proofDataRef = useRef<Record<string, unknown> | null>(null);
  const solscanRef = useRef<string | null>(null);
  const termRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  const cascadeLines = useCallback(
    (newLines: TerminalLine[], delayMs: number, onDone?: () => void) => {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= newLines.length) {
          clearInterval(timer);
          onDone?.();
          return;
        }
        setLines((prev) => [...prev, newLines[i]]);
        i++;
      }, delayMs);
      return timer;
    },
    [],
  );

  const poll = useCallback(async () => {
    if (doneRef.current) return;
    try {
      const res = await fetch(`/api/proof/verify-tx/status?id=${verificationId}`);
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;

      if (data.status === "verified" && data.proof_data) {
        doneRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        proofDataRef.current = data.proof_data;
        solscanRef.current = data.solscan_url ?? null;

        // Cascade verification checks
        const checkLines: TerminalLine[] = VERIFY_CHECKS.map((text) => ({
          text: `> ${text}`,
          status: "ok" as const,
        }));
        cascadeLines(checkLines, 250, () => {
          // Then cascade deployment lines
          setPhase("deploying");
          const deployLines: TerminalLine[] = DEPLOY_LINES(handle, data.proof_data!).map(
            (text) => ({ text: `> ${text}`, status: "ok" as const }),
          );
          cascadeLines(deployLines, 300, () => {
            setPhase("done");
          });
        });
      }

      if (data.status === "failed") {
        doneRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        const failCheck = data.failure_check ?? "unknown";
        const failDetail = data.failure_detail ?? "Verification failed.";
        const denialMsg = DENIAL_MESSAGES[failCheck] ?? failDetail;

        setLines((prev) => [
          ...prev,
          { text: `> ✕ ${denialMsg}`, status: "fail" },
        ]);
        setPhase("failed");
        setTimeout(
          () => onFailed(failCheck, failDetail, data.attempt_number ?? 1),
          1500,
        );
      }
    } catch {
      // Silently retry on next poll
    }
  }, [verificationId, handle, onFailed, cascadeLines]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  const handleConfirm = useCallback(() => {
    if (proofDataRef.current) {
      onVerified(proofDataRef.current, solscanRef.current);
    }
  }, [onVerified]);

  return (
    <>
      <div className="pm-term" ref={termRef} role="status" aria-live="polite" aria-atomic="false">
        <div className="pm-term-line" style={{ opacity: 0.5 }}>
          &gt; lastproof verify --tx {verificationId.slice(0, 8)}…
        </div>
        {lines.map((line, i) => {
          const cls =
            line.status === "ok" ? "pm-ok" :
            line.status === "fail" ? "pm-no" :
            "pm-neutral";
          return (
            <div key={i} className={`pm-term-line ${cls}`}>
              {line.text}
            </div>
          );
        })}
        {phase === "verifying" && !doneRef.current && (
          <div className="pm-term-line pm-neutral">
            {"  > WAITING FOR VERIFICATION..."}
            <span className="pm-term-cursor">█</span>
          </div>
        )}
      </div>

      {phase === "done" && (
        <div className="pm-cta-bar" style={{ marginTop: 14, padding: 0, border: 0 }}>
          <button type="button" className="pm-cta pm-cta-green" onClick={handleConfirm}>
            &gt; CONFIRM
          </button>
        </div>
      )}

      {phase !== "done" && phase !== "failed" && (
        <div className="pm-field-help">
          DO NOT CLOSE THIS WINDOW · VERIFICATION IN PROGRESS
        </div>
      )}
    </>
  );
}
