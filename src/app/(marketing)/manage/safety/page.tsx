import type { Metadata } from "next";
import Link from "next/link";

import "../manage.css";

export const metadata: Metadata = {
  title: "Wallet Safety -- LASTPROOF",
};

/**
 * /manage/safety — "Is it safe to connect my wallet?" informational page.
 *
 * Wireframe: manage-profile-safety.html (Screen 1B)
 * Read-only page. No auth required. Terminal chrome with READ ONLY badge.
 */
export default function SafetyPage() {
  return (
    <div className="mg-page">
      <div className="mg-crt-overlay" />
      <div className="mg-vignette" />

      {/* System bar */}
      <div className="mg-sys-bar">
        <div className="mg-sys-bar-left">
          <img src="/shiftbot-logo.png" alt="" className="mg-sys-logo" />
          <span className="mg-sys-tag">LASTPROOF // WALLET SAFETY</span>
          <span className="mg-sys-dot" />
        </div>
      </div>

      {/* Terminal frame */}
      <div className="mg-terminal">
        <div className="mg-titlebar">
          <div className="mg-titlebar-dots">
            <div className="mg-dot mg-dot-red" />
            <div className="mg-dot mg-dot-yellow" />
            <div className="mg-dot mg-dot-green" />
          </div>
          <span className="mg-titlebar-title">safety -- lastproof -- 80x24</span>
          <span className="mg-titlebar-right">READ ONLY</span>
        </div>

        <div className="mg-body mg-body-scroll">
          {/* Header */}
          <div className="mg-safety-header">
            <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="mg-safety-logo" />
            <h1 className="mg-safety-title">Your wallet is safe here</h1>
            <p className="mg-safety-subtitle">
              Connecting your wallet does not grant LASTPROOF access to your funds.
              We only read your public address to verify your identity.
            </p>
          </div>

          <div className="mg-divider visible" />

          {/* Access grid */}
          <div className="mg-access-grid">
            <div className="mg-access-card do">
              <div className="mg-access-card-title">What we access</div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&check;</span>
                <span>Public wallet address</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&check;</span>
                <span>Read-only connection</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&check;</span>
                <span>One-time message signature</span>
              </div>
            </div>

            <div className="mg-access-card dont">
              <div className="mg-access-card-title">What we never touch</div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&times;</span>
                <span>Private keys or seed phrase</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&times;</span>
                <span>Ability to move or spend tokens</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">&times;</span>
                <span>Transaction approval without consent</span>
              </div>
            </div>
          </div>

          {/* How connecting works */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-title">How connecting works</div>
            <div className="mg-steps">
              <div className="mg-step">
                <div className="mg-step-num">1</div>
                <div className="mg-step-content">
                  Click Connect Wallet. Your wallet extension opens a popup.
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">2</div>
                <div className="mg-step-content">
                  We read your public wallet address for identification.
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">3</div>
                <div className="mg-step-content">
                  You sign a verification message (not a transaction).
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">4</div>
                <div className="mg-step-content">
                  Done. No funds moved. Disconnect at any time.
                </div>
              </div>
            </div>
          </div>

          <div className="mg-divider visible" />

          {/* Your Terminal ID */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-title green">Your Terminal ID</div>
            <p>
              Your Terminal ID is your ecosystem-wide authentication key. It links your
              wallet to your LASTSHIFT operator account and can be regenerated at any time
              from the Terminal.
            </p>
          </div>

          {/* Data and privacy */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-title green">Data and privacy</div>
            <p>
              We don&apos;t sell your data. We don&apos;t share with third parties.
              We don&apos;t track you across sites. Your proof-of-work history is
              yours.
            </p>
          </div>

          {/* Built on Solana */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-title">Built on Solana</div>
            <p>
              LASTPROOF uses the Solana Wallet Adapter &mdash; the same open-source
              library used by Phantom, Jupiter, and every major Solana dApp.
            </p>
          </div>

          {/* Our stack */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-title">Our stack</div>
            <div className="mg-ext-links">
              <a
                href="https://github.com/anza-xyz/wallet-adapter"
                target="_blank"
                rel="noopener noreferrer"
                className="mg-ext-link"
              >
                Solana Wallet Adapter
              </a>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mg-ext-link"
              >
                Solana
              </a>
              <a
                href="https://spl.solana.com/token"
                target="_blank"
                rel="noopener noreferrer"
                className="mg-ext-link"
              >
                SPL Token Docs
              </a>
            </div>
          </div>

          <div className="mg-divider visible" />

          {/* Bottom CTA */}
          <div className="mg-safety-bottom">
            <Link href="/manage" className="mg-back-btn">
              BACK TO CONNECT WALLET
            </Link>
            <div className="mg-safety-note">Don&apos;t trust &mdash; verify.</div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mg-bottom-bar">
        <a href="https://lastshift.ai" target="_blank" rel="noopener noreferrer">
          lastshift.ai
        </a>
        <span>MANAGE PROFILE // WALLET SAFETY</span>
      </div>
    </div>
  );
}
