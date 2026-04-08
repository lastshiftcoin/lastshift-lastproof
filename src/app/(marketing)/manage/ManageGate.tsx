"use client";

import { useState } from "react";
import type { Session } from "@/lib/session";

/**
 * Skeleton UI for the Terminal ID gate. Intentionally ugly — this is a
 * plumbing harness for testing every branch of the validate contract, not a
 * production screen. Real chrome lands in Phase D from wireframes/manage-*.
 *
 * Scenario dropdown only appears when TERMINAL_API_URL points at the local
 * mock; in staging/prod it's hidden and the real Terminal responds.
 */

const SCENARIOS = [
  "success",
  "success_not_ea",
  "success_active",
  "wallet_tid_mismatch",
  "tid_regenerated",
  "tool_not_entitled",
  "tid_not_found",
  "wallet_not_registered",
  "rate_limited",
  "malformed_request",
  "unauthorized",
] as const;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; session: Session }
  | { kind: "error"; reason: string; message: string; httpStatus: number; retryAfterSec?: number };

function maskTid(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const parts = ["SHIFT"];
  for (let i = 0; i < 16; i += 4) {
    if (cleaned.length <= i) break;
    parts.push(cleaned.slice(i, i + 4));
  }
  if (cleaned.length === 0) return "";
  return parts.join("-");
}

export default function ManageGate({ initialSession }: { initialSession: Session | null }) {
  const [wallet, setWallet] = useState("");
  const [tidInput, setTidInput] = useState("");
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>("success");
  const [status, setStatus] = useState<Status>(
    initialSession ? { kind: "ok", session: initialSession } : { kind: "idle" },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    const res = await fetch("/api/auth/validate-tid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: wallet.trim(),
        terminalId: tidInput.trim(),
        scenario,
      }),
    });
    const body = await res.json();
    if (res.ok && body.ok) {
      setStatus({ kind: "ok", session: body.session });
    } else {
      setStatus({
        kind: "error",
        reason: body.reason || body.error || "unknown",
        message: body.message || "",
        httpStatus: res.status,
        retryAfterSec: body.retryAfterSec,
      });
    }
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setStatus({ kind: "idle" });
    setWallet("");
    setTidInput("");
  }

  return (
    <section style={sectionStyle}>
      <h1 style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: 2, margin: 0 }}>
        {">"} MANAGE / TERMINAL ID GATE (SKELETON)
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", margin: "6px 0 24px" }}>
        Plumbing harness for the Terminal validate contract. Real UI lands in Phase D.
      </p>

      {status.kind === "ok" ? (
        <SessionCard session={status.session} onSignOut={signOut} />
      ) : (
        <form onSubmit={submit} style={formStyle}>
          <label style={labelStyle}>
            WALLET ADDRESS
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="So1..."
              style={inputStyle}
              required
            />
          </label>

          <label style={labelStyle}>
            TERMINAL ID
            <input
              value={tidInput}
              onChange={(e) => setTidInput(maskTid(e.target.value))}
              placeholder="SHIFT-XXXX-XXXX-XXXX-XXXX"
              style={{ ...inputStyle, fontFamily: "var(--mono)", letterSpacing: 1 }}
              spellCheck={false}
              autoComplete="off"
              required
            />
          </label>

          <label style={labelStyle}>
            MOCK SCENARIO <span style={{ color: "var(--text-dim)" }}>(dev only)</span>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as (typeof SCENARIOS)[number])}
              style={inputStyle}
            >
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={status.kind === "loading"} style={buttonStyle}>
            {status.kind === "loading" ? "VALIDATING..." : "> VALIDATE TERMINAL ID"}
          </button>
        </form>
      )}

      {status.kind === "error" && <ErrorCard status={status} />}
    </section>
  );
}

function SessionCard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", letterSpacing: 2 }}>
        {">"} SESSION ACTIVE
      </div>
      <dl style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8, margin: "12px 0" }}>
        <Row label="wallet" value={session.walletAddress} />
        <Row label="terminal_id" value={session.terminalId} />
        <Row label="first_5000" value={String(session.firstFiveThousand)} />
        <Row label="free_sub_until" value={session.freeSubUntil ?? "null"} />
        <Row label="sub_status" value={session.subscriptionStatus} />
        <Row label="verified.x" value={String(session.verified.x)} />
        <Row label="verified.telegram" value={String(session.verified.telegram)} />
        <Row label="display_name" value={session.displayName ?? "null"} />
      </dl>
      <button type="button" onClick={onSignOut} style={{ ...buttonStyle, borderColor: "var(--red)", color: "var(--red)" }}>
        {">"} SIGN OUT
      </button>
    </div>
  );
}

function ErrorCard({ status }: { status: Extract<Status, { kind: "error" }> }) {
  return (
    <div style={{ ...cardStyle, borderColor: "var(--red)" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--red)", letterSpacing: 2 }}>
        {">"} VALIDATE FAILED · HTTP {status.httpStatus}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, marginTop: 10, color: "var(--text-primary)" }}>
        reason: <span style={{ color: "var(--accent)" }}>{status.reason}</span>
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: 13, marginTop: 6, color: "var(--text-secondary)" }}>
        {status.message}
      </div>
      {status.retryAfterSec !== undefined && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, marginTop: 8, color: "var(--text-dim)" }}>
          retry-after: {status.retryAfterSec}s
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <dt style={{ color: "var(--text-dim)", minWidth: 140 }}>{label}</dt>
      <dd style={{ margin: 0, color: "var(--text-primary)", wordBreak: "break-all" }}>{value}</dd>
    </div>
  );
}

// ─── Skeleton inline styles — intentionally unstyled ─────────────────────────

const sectionStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "60px auto",
  padding: "40px 28px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg-secondary)",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: 1.5,
  color: "var(--text-dim)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--sans)",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 20px",
  background: "transparent",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "var(--accent)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: 1.5,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-card)",
};
