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
  ticker?: string;
  mint?: string;
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
  // Operator-pasted contract address. Only collected when the API
  // returns `reason: "needs_ca"` for tickers outside the legacy
  // TOKEN_MINTS hardcoded list ($LASTSHFT, $USDT). Once the operator
  // attests a CA here and the check passes, the backend persists it
  // to work_items.target_mint so subsequent checks (and the
  // post-payment proof verification) reuse it without re-asking.
  const [targetMint, setTargetMint] = useState("");
  const [needsCa, setNeedsCa] = useState(false);
  const [unsupportedChain, setUnsupportedChain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<DevCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    const trimmedWallet = wallet.trim();
    if (!trimmedWallet || checking) return;

    // If we're in the CA-input state, require both fields populated.
    const trimmedMint = targetMint.trim();
    if (needsCa && !trimmedMint) return;

    setChecking(true);
    setResult(null);
    setError(null);
    setUnsupportedChain(false);

    try {
      const requestBody: {
        wallet: string;
        work_item_id: string;
        target_mint?: string;
      } = {
        wallet: trimmedWallet,
        work_item_id: workItemId,
      };
      if (trimmedMint) {
        requestBody.target_mint = trimmedMint;
      }

      const res = await fetch("/api/proof/dev-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data: DevCheckResponse & { error?: string } = await res.json();

      if (!res.ok) {
        setError(
          data.error === "invalid_wallet"
            ? "Not a valid Solana address."
            : data.detail ?? data.error ?? "Check failed.",
        );
        return;
      }

      // Multi-chain coming-soon — distinct from generic error so the
      // operator gets a clear "we know your token isn't on Solana"
      // message rather than "invalid CA".
      if (data.reason === "unsupported_chain") {
        setUnsupportedChain(true);
        return;
      }

      // Backend asked for a CA. Reveal the CA input and let the
      // operator paste it; next click of CHECK ELIGIBILITY will
      // re-call with target_mint set.
      if (data.reason === "needs_ca") {
        setNeedsCa(true);
        return;
      }

      // Hard rejections that aren't recoverable inside this screen.
      if (data.reason === "no_ticker") {
        setError(data.detail ?? "This work item has no associated token.");
        return;
      }

      // Operator-pasted CA failed validation (format, not a mint, RPC error)
      if (data.reason === "invalid_ca" || data.reason === "not_a_mint") {
        setError(data.detail ?? "Contract address could not be verified.");
        return;
      }

      // Eligibility result (eligible: true or false with checks payload)
      setResult(data);
    } catch {
      setError("Failed to reach server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }, [wallet, targetMint, needsCa, checking, workItemId]);

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
          onChange={(e) => {
            setWallet(e.target.value);
            setResult(null);
            setError(null);
            setUnsupportedChain(false);
          }}
          style={{ minHeight: 48, fontSize: 11 }}
        />
      </div>

      {/* CA input — only appears after the API tells us the ticker
          isn't recognized and an operator-attested CA is required. */}
      {needsCa && (
        <div className="pm-field" style={{ marginTop: 12 }}>
          <label className="pm-field-key" htmlFor="pm-dev-ca">
            CONTRACT ADDRESS FOR {ticker}
          </label>
          <textarea
            id="pm-dev-ca"
            className="pm-comment"
            placeholder="Paste the token's mint address (Solana, base58)…"
            value={targetMint}
            onChange={(e) => {
              setTargetMint(e.target.value);
              setResult(null);
              setError(null);
              setUnsupportedChain(false);
            }}
            style={{ minHeight: 48, fontSize: 11 }}
          />
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--pm-sub)" }}>
            We couldn&apos;t auto-find {ticker}. Paste the contract address
            so we can run the dev check against the right token.
          </div>
        </div>
      )}

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

      {/* Multi-chain coming-soon — distinct from generic error so
          operators with EVM tokens know support is on the way. */}
      {unsupportedChain && (
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--pm-warn, #f59e0b)",
          borderLeft: "2px solid var(--pm-warn, #f59e0b)",
          background: "rgba(245,158,11,0.05)",
        }}>
          <strong>&gt; ⓘ MULTI-CHAIN SUPPORT COMING SOON</strong>
          <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.6 }}>
            We currently verify Solana tokens only. Multi-chain dev
            verification is on the roadmap. For now, only Solana mint
            addresses can be used here.
          </div>
        </div>
      )}

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
            disabled={
              !wallet.trim() ||
              checking ||
              (needsCa && !targetMint.trim())
            }
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
