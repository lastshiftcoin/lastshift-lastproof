import type { Metadata } from "next";
import Link from "next/link";

import "../privacy/privacy.css";

/**
 * /security — LASTPROOF Vulnerability Disclosure Policy.
 *
 * Linked from /.well-known/security.txt (RFC 9116). Sets expectations
 * for security researchers reporting vulnerabilities: scope, safe-harbor
 * commitments, response timeline, and what is out of scope.
 *
 * Visual mirrors /privacy — same CSS, same wrapper classes.
 *
 * Effective + Last Updated: 2026-05-16.
 */

export const metadata: Metadata = {
  title: "Security & Vulnerability Disclosure — LASTPROOF",
  description:
    "LASTPROOF vulnerability disclosure policy and safe-harbor commitments for security researchers.",
  robots: { index: true, follow: true },
};

export default function SecurityPolicyPage() {
  return (
    <div className="pp-privacy-page">
      <div className="pp-privacy-container">
        <div className="pp-privacy-eyebrow">LASTPROOF · SECURITY</div>
        <h1 className="pp-privacy-title">Vulnerability Disclosure Policy</h1>

        <div className="pp-privacy-meta">
          <span><strong>Effective Date:</strong> May 16, 2026</span>
          <span><strong>Last Updated:</strong> May 16, 2026</span>
        </div>

        <p className="pp-privacy-intro">
          LASTSHIFT (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) welcomes
          good-faith security research on lastproof.app and treats the security
          of our users&apos; wallets, profiles, and on-chain proofs as a first-
          class responsibility. This Policy describes how to report
          vulnerabilities, what activity we authorize, and what you can expect
          from us in return.
        </p>

        {/* ═══ 1 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">1.</span>How to report
          </h2>
          <p>
            Email reports to{" "}
            <a href="mailto:security@lastshift.ai">security@lastshift.ai</a>.
            Include:
          </p>
          <ol>
            <li>a clear description of the vulnerability,</li>
            <li>steps to reproduce (or a proof-of-concept),</li>
            <li>the impact you believe it has, and</li>
            <li>any related URLs, request payloads, or screenshots.</li>
          </ol>
          <p>
            If you do not receive a human acknowledgment within five (5)
            business days, please re-send the report and we will escalate.
          </p>
        </section>

        {/* ═══ 2 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">2.</span>Safe harbor
          </h2>
          <p>
            We will not pursue legal action against, or request law enforcement
            investigation of, any researcher who:
          </p>
          <ol>
            <li>
              reports a vulnerability privately to{" "}
              <a href="mailto:security@lastshift.ai">
                security@lastshift.ai
              </a>{" "}
              and gives us a reasonable opportunity to remediate before public
              disclosure,
            </li>
            <li>
              avoids accessing, modifying, or destroying other users&apos; data,
              wallets, profiles, or on-chain proofs,
            </li>
            <li>
              does not exfiltrate data beyond the minimum needed to demonstrate
              the issue,
            </li>
            <li>
              does not perform sustained or high-volume testing that degrades
              service for other users (denial-of-service, brute-force, etc.),
              and
            </li>
            <li>
              complies with all applicable laws.
            </li>
          </ol>
          <p>
            This safe-harbor commitment is limited to actions we have the
            authority to forgo. It does not bind third parties, payment
            processors, public blockchain networks, or our infrastructure
            providers.
          </p>
        </section>

        {/* ═══ 3 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">3.</span>In scope
          </h2>
          <ol>
            <li>The lastproof.app web application and its public APIs.</li>
            <li>The proof verification flow and its on-chain settlement.</li>
            <li>The operator profile and dashboard surfaces under /manage.</li>
            <li>The Grid and SHIFTBOT operator search.</li>
            <li>Authentication, session, and Terminal ID gating.</li>
          </ol>
        </section>

        {/* ═══ 4 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">4.</span>Out of scope
          </h2>
          <ol>
            <li>
              Vulnerabilities in third-party services we depend on (Vercel,
              Supabase, Helius, the Solana network, X, Telegram, payment
              processors). Report those to the affected vendor directly.
            </li>
            <li>
              Social-engineering attacks against LASTSHIFT employees or
              contractors.
            </li>
            <li>
              Physical attacks on infrastructure (we have no physical
              infrastructure).
            </li>
            <li>
              Findings derived from automated scanners with no demonstrated
              real-world impact (TLS configuration suggestions, missing
              security headers without a working exploit, etc.). We may
              acknowledge but will not prioritize these.
            </li>
            <li>
              Issues that require a fully compromised user device, expired
              credentials, or already-leaked private keys.
            </li>
            <li>
              Best-practice advisories without a concrete vulnerability
              (rate-limit suggestions, missing CSP, etc.). Welcome as feedback
              but not eligible for acknowledgment.
            </li>
          </ol>
        </section>

        {/* ═══ 5 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">5.</span>What you can expect
          </h2>
          <ol>
            <li>
              <strong>Acknowledgment</strong> within five (5) business days of
              your report.
            </li>
            <li>
              <strong>Triage</strong> within ten (10) business days, with an
              initial severity assessment and an indication of next steps.
            </li>
            <li>
              <strong>Fix or mitigation</strong> on a timeline appropriate to
              severity. Critical issues affecting user funds or on-chain proofs
              are prioritized.
            </li>
            <li>
              <strong>Disclosure coordination</strong> — we will work with you
              on a coordinated public disclosure once a fix has shipped.
            </li>
            <li>
              <strong>Public credit</strong>, if you wish, on our{" "}
              <Link href="/acknowledgments">Acknowledgments</Link> page.
            </li>
          </ol>
        </section>

        {/* ═══ 6 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">6.</span>No monetary bounty
          </h2>
          <p>
            LASTPROOF does not currently run a paid bug-bounty program. We
            recognize and credit researchers publicly (with permission) on our
            Acknowledgments page and may offer non-monetary recognition such as
            a verified LASTPROOF operator profile, swag, or written references.
          </p>
        </section>

        {/* ═══ 7 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">7.</span>Encryption
          </h2>
          <p>
            We do not currently publish a PGP key. Reports may be sent in
            plaintext to{" "}
            <a href="mailto:security@lastshift.ai">security@lastshift.ai</a>{" "}
            over standard transport-encrypted email. If you require PGP, contact
            us first to coordinate key exchange.
          </p>
        </section>

        {/* ═══ 8 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">8.</span>Changes to this Policy
          </h2>
          <p>
            We may update this Policy to reflect changes in our processes or
            scope. The latest version will always be available at
            lastproof.app/security, and the canonical machine-readable contact
            file is at{" "}
            <a href="/.well-known/security.txt">/.well-known/security.txt</a>{" "}
            per RFC 9116.
          </p>
        </section>

        {/* ═══ Footer nav ═══ */}
        <section className="pp-privacy-section">
          <p>
            <Link href="/acknowledgments">→ See researcher acknowledgments</Link>
          </p>
          <p>
            <Link href="/privacy">→ Privacy Policy</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
