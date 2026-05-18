"use client";

import { useState } from "react";
import { recordWeeklyPayout } from "./actions";

export interface WeeklyAmbassadorRow {
  id: string;
  tgHandle: string;
  weekReferrals: number;
  weeklyTarget: number;
  weekWindowLabel: string;
  alreadyPaidThisWeek: boolean;
}

/**
 * Admin form for `weekly_flat` ambassadors (Habilamar). Pick the
 * ambassador, paste a Solscan tx for this week's retainer, click
 * RECORD. Writes one ambassador_payouts row covering Sun-8pm-PT
 * to Sun-7:59pm-PT.
 *
 * Idempotent server-side: a second submission for the same week is
 * rejected with "already_paid".
 */
export function AdminWeeklyPayoutForm({
  ambassadors,
}: {
  ambassadors: WeeklyAmbassadorRow[];
}) {
  const [selectedId, setSelectedId] = useState(ambassadors[0]?.id ?? "");
  const [txSignature, setTxSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const selected = ambassadors.find((a) => a.id === selectedId);
  const canSubmit =
    !submitting &&
    !!selected &&
    !selected.alreadyPaidThisWeek &&
    txSignature.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !txSignature.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await recordWeeklyPayout(selected.id, txSignature.trim());
      if (res.ok) {
        setResult({ kind: "success", message: res.message ?? "Recorded." });
        setTxSignature("");
      } else {
        setResult({ kind: "error", message: res.message ?? "Failed." });
      }
    } catch (err) {
      setResult({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Network error — try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (ambassadors.length === 0) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 4,
          fontSize: 11,
          background: "rgba(107,114,128,0.08)",
          color: "#9ca3af",
          border: "1px solid rgba(107,114,128,0.3)",
        }}
      >
        No ambassadors on the weekly_flat payout model.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <label
            htmlFor="weekly-amb-select"
            style={{
              display: "block",
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            AMBASSADOR
          </label>
          <select
            id="weekly-amb-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#111318",
              border: "1px solid #1f2937",
              borderRadius: 4,
              color: "#e5e7eb",
              font: "inherit",
              fontSize: 11,
            }}
          >
            {ambassadors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tgHandle} — {a.weekReferrals}/{a.weeklyTarget} this week
                {a.alreadyPaidThisWeek ? " (already paid)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "2 1 300px" }}>
          <label
            htmlFor="weekly-tx-input"
            style={{
              display: "block",
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            SOLSCAN LINK or TX SIGNATURE (THIS WEEK)
          </label>
          <input
            id="weekly-tx-input"
            type="text"
            value={txSignature}
            onChange={(e) => setTxSignature(e.target.value)}
            placeholder="Paste Solscan URL or signature..."
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#111318",
              border: "1px solid #1f2937",
              borderRadius: 4,
              color: "#e5e7eb",
              font: "inherit",
              fontSize: 11,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "8px 20px",
            background: !canSubmit ? "#374151" : "#ff9100",
            color: "#0a0b0f",
            border: "none",
            borderRadius: 4,
            font: "inherit",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "RECORDING..." : "RECORD WEEKLY PAYOUT"}
        </button>
      </div>

      {selected && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: "#6b7280",
            letterSpacing: "0.05em",
          }}
        >
          WEEK: {selected.weekWindowLabel}
        </div>
      )}

      {selected?.alreadyPaidThisWeek && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 4,
            fontSize: 11,
            background: "rgba(0,230,118,0.08)",
            color: "#00e676",
            border: "1px solid rgba(0,230,118,0.3)",
          }}
        >
          {selected.tgHandle} has already been paid for this week.
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 4,
            fontSize: 11,
            background:
              result.kind === "error"
                ? "rgba(255,84,112,0.08)"
                : "rgba(0,230,118,0.08)",
            color: result.kind === "error" ? "#ff5470" : "#00e676",
            border: `1px solid ${result.kind === "error" ? "rgba(255,84,112,0.3)" : "rgba(0,230,118,0.3)"}`,
          }}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}
