"use client";

/**
 * Step 2 — MWA connect.
 *
 * On Android, the wallet-adapter fires an Android intent via
 * `solana-wallet://` scheme. Phantom opens, user approves, Chrome
 * returns to the foreground — page state preserved. No deep links,
 * no page reload.
 *
 * This component calls `select("Phantom")` then `connect()` through
 * the wallet adapter. The MWA transport is handled automatically by
 * `@solana-mobile/mobile-wallet-adapter-protocol` under the hood.
 */

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { ConnectedWallet } from "@/lib/wallet/use-connected";
import { SolanaMobileWalletAdapterWalletName } from "@solana-mobile/wallet-adapter-mobile";

export interface Step2ConnectProps {
  connected: ConnectedWallet | null;
  isSelfProof: boolean;
  onConnected: () => void;
  onBack: () => void;
}

export function Step2Connect({
  connected,
  isSelfProof,
  onConnected,
  onBack,
}: Step2ConnectProps) {
  const { wallets, select, connect, connecting } = useWallet();
  const [err, setErr] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setErr(null);
    // On Android, we must use the MWA (Mobile Wallet Adapter) which fires
    // a solana-wallet:// intent. Selecting the PhantomWalletAdapter directly
    // doesn't work — it can't find window.phantom.solana in Chrome and
    // falls back to opening phantom.com. The MWA adapter is auto-created
    // by WalletProvider on Android.
    const mwaWallet = wallets.find(
      (w) => w.adapter.name === SolanaMobileWalletAdapterWalletName,
    );
    if (!mwaWallet) {
      setErr(
        "Mobile Wallet Adapter not available. Make sure Phantom is installed on this device.",
      );
      return;
    }
    try {
      select(mwaWallet.adapter.name);
      await connect();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "wallet connect failed";
      if (msg.includes("Found no installed wallet")) {
        setErr(
          "Phantom app not found. Install Phantom from the Play Store and try again.",
        );
      } else {
        setErr(msg);
      }
    }
  }, [wallets, select, connect]);

  // Connected — show verified state card
  if (connected) {
    const short =
      connected.pubkey.slice(0, 6) + "…" + connected.pubkey.slice(-4);
    return (
      <>
        <div className="pm-eyebrow">&gt; WALLET CONNECTED</div>
        <h2 className="pm-head">
          Locked in with <span className="pm-green">PHANTOM</span>.
        </h2>
        <p className="pm-sub">
          We&apos;ve got the wallet address. Next we&apos;ll check eligibility
          in the background while you write your receipt.
        </p>

        <div className="pm-wallet-verified">
          <div className="pm-wv-check" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="pm-wv-title">PHANTOM · CONNECTED</div>
          <div className="pm-wv-addr">
            <b>{short}</b>
          </div>
          <div className="pm-wv-sub">
            LASTPROOF never holds your keys. Every action routes through your
            wallet for signature.
          </div>
          {isSelfProof ? (
            <div className="pm-self-proof-block">
              <div className="pm-self-proof-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="pm-self-proof-msg">
                You cannot verify your own work. Proofs must come from someone
                else&apos;s wallet to maintain trust.
              </div>
              <button
                type="button"
                className="pm-cta pm-cta-dim"
                onClick={onBack}
              >
                &gt; GO BACK
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pm-cta pm-cta-green"
              onClick={onConnected}
              data-testid="pm-wv-continue"
            >
              &gt; CONTINUE
            </button>
          )}
        </div>
      </>
    );
  }

  // Not yet connected — show connect button
  return (
    <>
      <div className="pm-eyebrow">&gt; CONNECT PHANTOM</div>
      <h2 className="pm-head">
        Connect <span className="pm-accent">Phantom.</span>
      </h2>
      <p className="pm-sub">
        Tap the button below. Phantom will open for approval, then you&apos;ll
        return here automatically — no page reload.
      </p>

      <div className="pm-wallets">
        <button
          type="button"
          className={`pm-wallet${connecting ? " pm-connecting" : ""}`}
          onClick={handleConnect}
          disabled={connecting}
        >
          <span className="pm-wallet-label">Phantom</span>
          <span className="pm-wallet-hint">
            {connecting ? "CONNECTING…" : "CONNECT WALLET →"}
          </span>
        </button>
      </div>

      {err && (
        <div className="pm-inel" style={{ marginTop: 14 }}>
          {err}
        </div>
      )}

      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
        onClick={onBack}
      >
        ← BACK
      </button>
    </>
  );
}
