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
      <div className="mg-noise" />

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
              Connecting your wallet does not give us access to your funds, your
              private keys, or the ability to make transactions on your behalf.
              Here&apos;s exactly how it works.
            </p>
          </div>

          <div className="mg-divider visible" />

          {/* Access grid */}
          <div className="mg-access-grid">
            <div className="mg-access-card do">
              <div className="mg-access-card-title">What we access</div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>Your public wallet address to verify your identity</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>A read-only connection through your wallet provider</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>A one-time message signature to prove wallet ownership</span>
              </div>
            </div>

            <div className="mg-access-card dont">
              <div className="mg-access-card-title">What we never touch</div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <span>Your private keys or seed phrase &mdash; ever</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <span>The ability to move, transfer, or spend your tokens</span>
              </div>
              <div className="mg-access-item">
                <span className="mg-access-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <span>Any transaction approval without your explicit consent</span>
              </div>
            </div>
          </div>

          {/* How connecting works */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-header">
              <div className="mg-trust-icon accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="mg-trust-block-title">How connecting works</div>
            </div>
            <div className="mg-steps">
              <div className="mg-step">
                <div className="mg-step-num">1</div>
                <div className="mg-step-content">
                  You click <strong>Connect Wallet</strong> and your wallet
                  extension opens a popup asking you to approve a connection to
                  LASTPROOF.
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">2</div>
                <div className="mg-step-content">
                  We read your <strong>public wallet address</strong> &mdash; the
                  same address anyone can see on-chain. This is how we identify
                  you.
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">3</div>
                <div className="mg-step-content">
                  You sign a <strong>verification message</strong> &mdash; not a
                  transaction. This proves you own the wallet without spending
                  anything.
                </div>
              </div>
              <div className="mg-step">
                <div className="mg-step-num">4</div>
                <div className="mg-step-content">
                  That&apos;s it. You&apos;re in. No funds are moved, no
                  permissions are granted beyond read access. You can{" "}
                  <strong>disconnect at any time</strong>.
                </div>
              </div>
            </div>
          </div>

          <div className="mg-divider visible" />

          {/* Your Terminal ID */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-header">
              <div className="mg-trust-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="mg-trust-block-title green">Your Terminal ID</div>
            </div>
            <p>
              After connecting, new operators are issued a{" "}
              <strong>Terminal ID</strong> &mdash; a unique key that
              authenticates you across every tool in the LASTSHIFT ecosystem
              (LASTPROOF included). It&apos;s entered once when you first
              register for a tool, then works automatically with your wallet
              after that. If it&apos;s ever compromised, you can regenerate it
              instantly from the dashboard, revoking access across all tools.
            </p>
          </div>

          {/* Data and privacy */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-header">
              <div className="mg-trust-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="mg-trust-block-title green">Data and privacy</div>
            </div>
            <p>
              We don&apos;t sell your data. We don&apos;t share your wallet
              address with third parties. We don&apos;t track you across other
              sites. The only data we store is what&apos;s needed to run the
              Terminal &mdash; your public address, your Terminal ID, and your
              tool activity within the platform. Nothing more.
            </p>
          </div>

          {/* Built on Solana */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-header">
              <div className="mg-trust-icon accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div className="mg-trust-block-title">Built on Solana</div>
            </div>
            <p>
              LASTPROOF runs on <strong>Solana</strong> using the{" "}
              <strong>Solana Wallet Adapter</strong> &mdash; the same
              open-source standard used by Phantom, Jupiter, and every major
              Solana dApp. There&apos;s nothing custom or proprietary about how
              we connect &mdash; it&apos;s the same secure flow you&apos;ve
              used on any other Solana platform.
            </p>
          </div>

          {/* Our stack */}
          <div className="mg-trust-block">
            <div className="mg-trust-block-header">
              <div className="mg-trust-icon accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="mg-trust-block-title">Our stack</div>
            </div>
            <div className="mg-stack-chips">
              <span className="mg-stack-chip">Solana</span>
              <span className="mg-stack-chip">Wallet Adapter</span>
              <span className="mg-stack-chip">Next.js</span>
              <span className="mg-stack-chip">$LASTSHFT (SPL Token)</span>
            </div>
            <div className="mg-stack-links">
              <a
                href="https://github.com/anza-xyz/wallet-adapter"
                target="_blank"
                rel="noopener noreferrer"
              >
                Solana Wallet Adapter
              </a>
              <span className="mg-stack-sep">|</span>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Solana
              </a>
              <span className="mg-stack-sep">|</span>
              <a
                href="https://spl.solana.com/token"
                target="_blank"
                rel="noopener noreferrer"
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
