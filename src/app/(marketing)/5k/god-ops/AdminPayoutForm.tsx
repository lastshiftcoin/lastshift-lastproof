"use client";

import { useState } from "react";
import { markAmbassadorReferralsPaid } from "./actions";

export interface AmbassadorRow {
  id: string;
  tgHandle: string;
  unpaidCount: number;
  amountOwed: number;
}

/**
 * Admin form on /5k/god-ops. Pick an ambassador, paste their Solscan
 * tx signature for the payout, click MARK ALL AS PAID — every
 * currently-unpaid referral for that ambassador flips to paid in a
 * single atomic operation.
 *
 * Server-side mutation goes through `markAmbassadorReferralsPaid()`
 * Server Action (see ./actions.ts) — no admin token leaves the
 * browser. The action re-runs the page render after success so
 * counts drop to zero immediately.
 */
export function AdminPayoutForm({
  ambassadors,
}: {
  ambassadors: AmbassadorRow[];
}) {
  const [selectedId, setSelectedId] = useState(
    ambassadors.find((a) => a.unpaidCount > 0)?.id ?? ambassadors[0]?.id ?? "",
  );
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
    selected.unpaidCount > 0 &&
    txSignature.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !txSignature.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await markAmbassadorReferralsPaid(
        selected.id,
        txSignature.trim(),
      );

      if (res.ok) {
        setResult({
          kind: "success",
          message: res.message ?? "Paid.",
        });
        setTxSignature("");
      } else {
        setResult({
          kind: "error",
          message: res.message ?? "Failed.",
        });
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
        <div style={{ flex: "1 1 200px" }}>
          <label
            htmlFor="amb-select"
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
            id="amb-select"
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
                {a.tgHandle} — {a.unpaidCount} unpaid — ${a.amountOwed.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "2 1 300px" }}>
          <label
            htmlFor="tx-input"
            style={{
              display: "block",
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            SOLSCAN LINK or TX SIGNATURE
          </label>
          <input
            id="tx-input"
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
          {submitting ? "MARKING..." : "MARK ALL AS PAID"}
        </button>
      </div>

      {selected && selected.unpaidCount === 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 4,
            fontSize: 11,
            background: "rgba(107,114,128,0.08)",
            color: "#9ca3af",
            border: "1px solid rgba(107,114,128,0.3)",
          }}
        >
          {selected.tgHandle} has no unpaid referrals.
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
