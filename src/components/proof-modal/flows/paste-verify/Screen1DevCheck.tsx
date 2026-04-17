"use client";

import { useCallback, useState } from "react";

interface DevCheckResult {
  ok: boolean | null;
  detail: string;
}

interface DevCheckResponse {
  eligible: boolean;
  reason?: string;
  detail?: string;
  checks?: {
    mintAuthority: DevCheckResult;
    deployer: DevCheckResult;
    founder: DevCheckResult;
  };
}

export interface Screen1DevCheckProps {
  ticker: string;
  workItemId: string;
  onQualified: (wallet: string) => void;
}

export function Screen1DevCheck({
  ticker,
  workItemId,
  onQualified,
}: Screen1DevCheckProps) {
  const [wallet, setWallet] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<DevCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    const trimmed = wallet.trim();
    if (!trimmed || checking) return;

    setChecking(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/proof/dev-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: trimmed, work_item_id: workItemId }),
      });
      const data: DevCheckResponse & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error === "invalid_wallet"
          ? "Not a valid Solana address."
          : data.detail ?? data.error ?? "Check failed.");
        return;
      }

      if (data.reason === "no_ticker" || data.reason === "no_mint") {
        setError(data.detail ?? "This project has no token mint to verify against.");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to reach server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }, [wallet, checking, workItemId]);

  const qualified = result?.eligible === true;

  return (
    <>
      <div className="pm-eyebrow">&gt; DEV WALLET CHECK</div>
      <h2 className="pm-head">
        Verify your wallet for <span className="pm-accent">{ticker}</span>
      </h2>
      <p className="pm-sub">
        Paste the wallet address you will use to send payment. We&apos;ll check
        if it qualifies as a dev wallet before you pay.
      </p>

      <div className="pm-field" style={{ marginTop: 8 }}>
        <label className="pm-field-key" htmlFor="pm-dev-wallet">
          YOUR WALLET ADDRESS
        </label>
        <textarea
          id="pm-dev-wallet"
          className="pm-comment"
          placeholder="Paste your Solana wallet address…"
          value={wallet}
          onChange={(e) => { setWallet(e.target.value); setResult(null); setError(null); }}
          style={{ minHeight: 48, fontSize: 11 }}
        />
      </div>

      {/* Qualification criteria */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        fontSize: 10,
        lineHeight: 1.7,
        color: "var(--pm-sub)",
        borderLeft: "2px solid var(--pm-border, #1f2937)",
      }}>
        <div style={{ fontWeight: 700, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
          A dev wallet must be one of:
        </div>
        <div>• Current <b>mint authority</b> on the token</div>
        <div>• <b>Deployer</b> — signed the original mint creation TX</div>
        <div>• <b>First-5 holder</b> — among first 5 recipients of token mints</div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--pm-red, #ef4444)",
          borderLeft: "2px solid var(--pm-red, #ef4444)",
          background: "rgba(239,68,68,0.05)",
        }}>
          <strong>&gt; ✕ {error}</strong>
        </div>
      )}

      {/* Result: not qualified */}
      {result && !qualified && (
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--pm-red, #ef4444)",
          borderLeft: "2px solid var(--pm-red, #ef4444)",
          background: "rgba(239,68,68,0.05)",
        }}>
          <strong>&gt; ✕ WALLET NOT QUALIFIED</strong>
          {result.checks && (
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--pm-sub)" }}>
              {result.checks.mintAuthority.ok === false && (
                <div>MINT AUTHORITY: {result.checks.mintAuthority.detail}</div>
              )}
              {result.checks.deployer.ok === false && (
                <div>DEPLOYER: {result.checks.deployer.detail}</div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10 }}>
            Try a different wallet, or go back and select <b>COLLABORATOR</b> instead.
          </div>
        </div>
      )}

      {/* Result: qualified */}
      {qualified && (
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "#00e676",
          borderLeft: "2px solid #00e676",
          background: "rgba(0,230,118,0.05)",
        }}>
          <strong>&gt; ✓ WALLET QUALIFIED</strong>
          {result.checks && (
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--pm-sub)" }}>
              {result.checks.mintAuthority.ok === true && (
                <div>✓ {result.checks.mintAuthority.detail}</div>
              )}
              {result.checks.deployer.ok === true && (
                <div>✓ {result.checks.deployer.detail}</div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: "var(--pm-sub)" }}>
            You must send payment from this exact wallet.
          </div>
        </div>
      )}

      {/* Check / Continue buttons */}
      <div className="pm-cta-bar" style={{ marginTop: 14, padding: 0, border: 0 }}>
        {!qualified ? (
          <button
            type="button"
            className="pm-cta"
            disabled={!wallet.trim() || checking}
            onClick={handleCheck}
          >
            {checking ? "> CHECKING…" : "> CHECK ELIGIBILITY"}
          </button>
        ) : (
          <button
            type="button"
            className="pm-cta"
            onClick={() => onQualified(wallet.trim())}
          >
            &gt; CONTINUE
          </button>
        )}
      </div>
    </>
  );
}
