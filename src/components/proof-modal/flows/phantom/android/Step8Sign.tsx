"use client";

import type { useSignFlow, SignPhase } from "../../../useSignFlow";

export interface Step8SignProps {
  sign: ReturnType<typeof useSignFlow>["state"];
}

export function Step8Sign({ sign }: Step8SignProps) {
  const rungs: { key: SignPhase; label: string }[] = [
    { key: "building", label: "BUILDING TRANSACTION" },
    { key: "awaiting_signature", label: "APPROVE IN PHANTOM APP" },
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
  const failedPhase: SignPhase | null = !failed
    ? null
    : sign.signature
      ? "confirming"
      : sign.memo
        ? "awaiting_signature"
        : "building";

  return (
    <>
      <div className="pm-eyebrow">&gt; WAITING FOR PHANTOM</div>
      <h2 className="pm-head">
        Approve in <span className="pm-accent">Phantom.</span>
      </h2>
      <p className="pm-sub">
        Phantom will open on your device. Approve the transaction there, then
        you&apos;ll return here automatically — MWA keeps your session alive.
      </p>

      <div className="pm-sign-wrap">
        <div className="pm-sign-phone" aria-hidden="true">
          <div className="pm-sign-spin" />
          <svg
            viewBox="0 0 24 24"
            width="48"
            height="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <path d="M11 18h2" />
            <path d="M9 6h6" />
          </svg>
        </div>
      </div>

      <div
        className="pm-ladder"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {rungs.map((r) => {
          const rungIdx = order.indexOf(r.key);
          const active = !failed && r.key === sign.phase;
          const done =
            (rungIdx < idx && sign.phase !== "idle" && !failed) ||
            (failed &&
              failedPhase !== null &&
              rungIdx < order.indexOf(failedPhase));
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
                <span className="pm-rung-meta">
                  {Math.floor(sign.elapsedMs / 100) / 10}s
                </span>
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
