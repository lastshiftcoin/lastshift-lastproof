"use client";

/**
 * Step 1 — Phantom selected confirmation.
 * User already picked Phantom on the wallet picker. This screen confirms
 * the selection and lets them proceed to connect.
 */

export interface Step1SelectProps {
  onContinue: () => void;
  onBack: () => void;
}

export function Step1Select({ onContinue, onBack }: Step1SelectProps) {
  return (
    <>
      <div className="pm-eyebrow">&gt; PHANTOM SELECTED</div>
      <h2 className="pm-head">
        You picked <span className="pm-accent">Phantom.</span>
      </h2>
      <p className="pm-sub">
        On Android, Phantom connects via Mobile Wallet Adapter — your browser
        stays open, no redirects. Tap connect and approve in the Phantom app.
      </p>

      <div className="pm-wallet-verified">
        <div className="pm-wv-title">PHANTOM · ANDROID (MWA)</div>
        <div className="pm-wv-sub">
          Connection happens over a local encrypted channel. Your keys never
          leave the Phantom app.
        </div>
        <button
          type="button"
          className="pm-cta pm-cta-green"
          onClick={onContinue}
        >
          &gt; CONNECT WALLET
        </button>
      </div>

      <button
        type="button"
        className="pm-cta-ghost"
        style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
        onClick={onBack}
      >
        ← BACK TO WALLET SELECT
      </button>
    </>
  );
}
