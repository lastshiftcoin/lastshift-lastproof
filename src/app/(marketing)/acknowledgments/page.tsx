import type { Metadata } from "next";
import Link from "next/link";

import "../privacy/privacy.css";

/**
 * /acknowledgments — Security Researcher Hall of Fame.
 *
 * Referenced from /.well-known/security.txt (Acknowledgments: line).
 * Researchers who report verified vulnerabilities via the process in
 * /security may, with their permission, be credited here.
 *
 * Add new entries to the array below. Keep the most recent at the top.
 *
 * Visual mirrors /privacy — same CSS, same wrapper classes.
 */

export const metadata: Metadata = {
  title: "Security Acknowledgments — LASTPROOF",
  description:
    "Public recognition for security researchers who have responsibly disclosed vulnerabilities affecting lastproof.app.",
  robots: { index: true, follow: true },
};

interface Acknowledgment {
  /** Display handle, name, or org. */
  who: string;
  /** Optional URL — researcher's site, X profile, etc. */
  url?: string;
  /** Year-month of remediation. */
  when: string;
  /** Short description of finding category (no sensitive detail). */
  finding: string;
}

const ACKNOWLEDGMENTS: Acknowledgment[] = [
  // Add entries here as researchers report verified issues.
  // Example shape (keep newest first):
  // {
  //   who: "@researcher_handle",
  //   url: "https://x.com/researcher_handle",
  //   when: "2026-06",
  //   finding: "Profile field XSS via unsanitized bio rendering.",
  // },
];

export default function AcknowledgmentsPage() {
  return (
    <div className="pp-privacy-page">
      <div className="pp-privacy-container">
        <div className="pp-privacy-eyebrow">LASTPROOF · SECURITY</div>
        <h1 className="pp-privacy-title">Acknowledgments</h1>

        <div className="pp-privacy-meta">
          <span><strong>Last Updated:</strong> May 16, 2026</span>
        </div>

        <p className="pp-privacy-intro">
          LASTPROOF takes user security seriously. We publicly recognize
          security researchers who responsibly disclose verified
          vulnerabilities through the process described in our{" "}
          <Link href="/security">Vulnerability Disclosure Policy</Link>. With
          the researcher&apos;s permission, their handle and a brief
          non-sensitive description of the finding category appear below.
        </p>

        <p className="pp-privacy-intro">
          If you have found a vulnerability, please email{" "}
          <a href="mailto:security@lastproof.app">security@lastproof.app</a>{" "}
          before disclosing publicly. We commit to acknowledgment within five
          business days.
        </p>

        {/* ═══ Roll ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">1.</span>Researchers
          </h2>

          {ACKNOWLEDGMENTS.length === 0 ? (
            <p>
              No public acknowledgments yet. Be the first — report a verified
              issue to{" "}
              <a href="mailto:security@lastproof.app">
                security@lastproof.app
              </a>{" "}
              and we will credit you here (with your permission) once
              remediated.
            </p>
          ) : (
            <ol>
              {ACKNOWLEDGMENTS.map((a, i) => (
                <li key={i}>
                  <strong>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {a.who}
                      </a>
                    ) : (
                      a.who
                    )}
                  </strong>{" "}
                  — {a.finding}{" "}
                  <span style={{ opacity: 0.6 }}>({a.when})</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ═══ Footer nav ═══ */}
        <section className="pp-privacy-section">
          <p>
            <Link href="/security">→ Vulnerability Disclosure Policy</Link>
          </p>
          <p>
            <Link href="/privacy">→ Privacy Policy</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
