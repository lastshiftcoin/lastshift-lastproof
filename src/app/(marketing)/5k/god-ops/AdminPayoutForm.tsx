"use client";

import { useState } from "react";

interface Ambassador {
  id: string;
  tgHandle: string;
  referrals7d: number;
  payoutUsd: number;
}

export function AdminPayoutForm({ ambassadors }: { ambassadors: Ambassador[] }) {
  const [selectedId, setSelectedId] = useState(ambassadors[0]?.id ?? "");
  const [txSignature, setTxSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const selected = ambassadors.find((a) => a.id === selectedId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !txSignature.trim()) return;

    setSubmitting(true);
    setResult(null);

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const res = await fetch("/api/ambassador/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambassador_id: selected.id,
          period_start: periodStart,
          period_end: periodEnd,
          referral_count: selected.referrals7d,
          payout_usd: selected.payoutUsd,
          tx_signature: txSignature.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setResult(`Payout recorded for ${selected.tgHandle} — $${selected.payoutUsd}`);
        setTxSignature("");
      } else {
        setResult(`Error: ${data.reason}`);
      }
    } catch {
      setResult("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label
            htmlFor="amb-select"
            style={{ display: "block", fontSize: 9, letterSpacing: "0.12em", color: "#6b7280", marginBottom: 4 }}
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
                {a.tgHandle} — {a.referrals7d} refs — ${a.payoutUsd}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "2 1 300px" }}>
          <label
            htmlFor="tx-input"
            style={{ display: "block", fontSize: 9, letterSpacing: "0.12em", color: "#6b7280", marginBottom: 4 }}
          >
            SOLSCAN TX SIGNATURE
          </label>
          <input
            id="tx-input"
            type="text"
            value={txSignature}
            onChange={(e) => setTxSignature(e.target.value)}
            placeholder="Paste Solscan transaction signature..."
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
          disabled={submitting || !txSignature.trim()}
          style={{
            padding: "8px 20px",
            background: submitting ? "#374151" : "#ff9100",
            color: "#0a0b0f",
            border: "none",
            borderRadius: 4,
            font: "inherit",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "RECORDING..." : "MARK PAID"}
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 4,
            fontSize: 11,
            background: result.startsWith("Error") ? "rgba(255,84,112,0.08)" : "rgba(0,230,118,0.08)",
            color: result.startsWith("Error") ? "#ff5470" : "#00e676",
            border: `1px solid ${result.startsWith("Error") ? "rgba(255,84,112,0.3)" : "rgba(0,230,118,0.3)"}`,
          }}
        >
          {result}
        </div>
      )}
    </form>
  );
}
