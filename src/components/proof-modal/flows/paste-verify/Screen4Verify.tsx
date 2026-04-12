"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Screen4VerifyProps {
  verificationId: string;
  onVerified: (proofId: string, solscanUrl: string | null) => void;
  onFailed: (check: string, detail: string, attempt: number) => void;
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
}

const CHECK_LABELS: Record<string, string> = {
  queued: "queued for verification",
  processing: "verifying on-chain",
  tx_fetch: "fetching transaction",
  tx_not_found: "transaction lookup",
  tx_failed: "transaction status",
  wrong_sender: "sender verification",
  wrong_recipient: "recipient verification",
  amount_not_found: "transfer amount",
  wrong_amount: "amount verification",
  tx_too_old: "transaction recency",
  tx_future: "transaction timestamp",
  already_used: "duplicate check",
  config_error: "system configuration",
};

export function Screen4Verify({
  verificationId,
  onVerified,
  onFailed,
}: Screen4VerifyProps) {
  const [status, setStatus] = useState<string>("queued");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [checks, setChecks] = useState<{ label: string; ok: boolean | null }[]>([
    { label: "submitted to verification queue", ok: true },
  ]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const poll = useCallback(async () => {
    if (doneRef.current) return;
    try {
      const res = await fetch(`/api/proof/verify-tx/status?id=${verificationId}`);
      if (!res.ok) return;
      const data = (await res.json()) as StatusResponse;

      setStatus(data.status);
      setQueuePosition(data.queue_position ?? null);

      if (data.status === "processing") {
        setChecks((prev) => {
          if (prev.some((c) => c.label === "verifying on-chain")) return prev;
          return [...prev, { label: "verifying on-chain", ok: null }];
        });
      }

      if (data.status === "verified" && data.proof_id) {
        doneRef.current = true;
        setChecks((prev) => [
          ...prev.map((c) => ({ ...c, ok: c.ok === null ? true : c.ok })),
          { label: "transaction verified", ok: true },
          { label: "sender matches connected wallet", ok: true },
          { label: "recipient is LASTPROOF treasury", ok: true },
          { label: "amount within tolerance", ok: true },
          { label: "transaction is recent", ok: true },
          { label: "signature not previously used", ok: true },
          { label: "proof recorded on-chain", ok: true },
        ]);
        setTimeout(() => onVerified(data.proof_id!, data.solscan_url ?? null), 1200);
      }

      if (data.status === "failed") {
        doneRef.current = true;
        const failedCheck = data.failure_check ?? "unknown";
        const failedDetail = data.failure_detail ?? "Verification failed.";
        setChecks((prev) => [
          ...prev.map((c) => ({ ...c, ok: c.ok === null ? true : c.ok })),
          { label: CHECK_LABELS[failedCheck] ?? failedCheck, ok: false },
        ]);
        setTimeout(
          () => onFailed(failedCheck, failedDetail, data.attempt_number ?? 1),
          800,
        );
      }
    } catch {
      // Silently retry on next poll
    }
  }, [verificationId, onVerified, onFailed]);

  useEffect(() => {
    poll(); // Initial fetch
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  return (
    <>
      <div className="pm-eyebrow">&gt; VERIFYING PAYMENT</div>
      <h2 className="pm-head">
        Checking the <span className="pm-accent">chain.</span>
      </h2>
      <p className="pm-sub">
        We&apos;re verifying your transaction against the Solana blockchain. This
        usually takes a few seconds.
      </p>

      {queuePosition !== null && queuePosition > 1 && status === "queued" && (
        <div className="pm-field-help" style={{ marginBottom: 10 }}>
          POSITION {queuePosition} IN QUEUE
        </div>
      )}

      <div className="pm-term" role="status" aria-live="polite" aria-atomic="false">
        <div className="pm-term-line">
          &gt; lastproof verify --tx {verificationId.slice(0, 8)}…
        </div>
        {checks.map((c, i) => {
          const cls = c.ok === true ? "pm-ok" : c.ok === false ? "pm-no" : "pm-neutral";
          const mark = c.ok === true ? "[✓]" : c.ok === false ? "[✗]" : "[…]";
          return (
            <div key={i} className={`pm-term-line ${cls}`}>
              {`  ${mark} ${c.label}`}
            </div>
          );
        })}
        {status === "processing" && (
          <div className="pm-term-line pm-neutral">
            {"  […] running verification checks"}
            <span className="pm-term-cursor">█</span>
          </div>
        )}
        {status === "queued" && (
          <div className="pm-term-line pm-neutral">
            {"  […] waiting in queue"}
            <span className="pm-term-cursor">█</span>
          </div>
        )}
      </div>

      <div className="pm-field-help">
        DO NOT CLOSE THIS WINDOW · VERIFICATION IN PROGRESS
      </div>
    </>
  );
}
