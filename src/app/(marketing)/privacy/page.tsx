import type { Metadata } from "next";

import "./privacy.css";

/**
 * /privacy — LASTPROOF Privacy Policy.
 *
 * Source of truth: /lastproof-privacy-policy.md (root of repo).
 * If the markdown source is updated, mirror the changes here.
 *
 * Effective + Last Updated: 2026-04-28.
 */

export const metadata: Metadata = {
  title: "Privacy Policy — LASTPROOF",
  description:
    "How LASTSHIFT collects, uses, discloses, and protects information in connection with lastproof.app.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pp-privacy-page">
      <div className="pp-privacy-container">
        <div className="pp-privacy-eyebrow">LASTPROOF · LEGAL</div>
        <h1 className="pp-privacy-title">Privacy Policy</h1>

        <div className="pp-privacy-meta">
          <span><strong>Effective Date:</strong> April 28, 2026</span>
          <span><strong>Last Updated:</strong> April 28, 2026</span>
        </div>

        <p className="pp-privacy-intro">
          This Privacy Policy (&quot;Policy&quot;) describes how LASTSHIFT
          (&quot;LASTSHIFT,&quot; &quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;) collects, uses, discloses, and protects information
          in connection with the website located at lastproof.app and any
          related features, tools, or services made available through it
          (collectively, the &quot;Service&quot;). By accessing or using the
          Service, you acknowledge that you have read and understood this
          Policy.
        </p>

        <p className="pp-privacy-intro">
          LASTPROOF is an anonymous-use product. We do not require users to
          create accounts, provide names, email addresses, phone numbers,
          government identifiers, or any other personally identifiable
          information (&quot;PII&quot;) in order to use the Service.
        </p>

        {/* ═══ 1 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">1.</span>Scope of this Policy
          </h2>
          <p>
            This Policy applies to information processed by LASTSHIFT in
            connection with the Service. It does not apply to:
          </p>
          <ol>
            <li>
              third-party websites, applications, or services that may be
              linked from the Service;
            </li>
            <li>
              public blockchain networks (including the Solana blockchain),
              which are decentralized systems not operated or controlled by
              LASTSHIFT; or
            </li>
            <li>
              information you choose to disclose to third parties outside the
              Service.
            </li>
          </ol>
          <p>
            We encourage you to review the privacy policies of any third-party
            services you interact with.
          </p>
        </section>

        {/* ═══ 2 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">2.</span>Information We Do Not Collect
          </h2>
          <p>
            We do not collect, request, or store the following categories of
            personal information:
          </p>
          <ul>
            <li>Names, email addresses, telephone numbers, or postal addresses;</li>
            <li>
              Government-issued identifiers (such as Social Security numbers,
              driver&apos;s license numbers, or passport numbers);
            </li>
            <li>
              Financial account numbers, credit or debit card numbers, or
              banking information;
            </li>
            <li>Biometric, health, or precise geolocation data;</li>
            <li>
              Account passwords (we do not operate a traditional account
              system).
            </li>
          </ul>
          <p>
            The Service does not require, and does not implement, any
            &quot;Know Your Customer&quot; (KYC) or identity verification
            process.
          </p>
        </section>

        {/* ═══ 3 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">3.</span>Information We Do Collect
          </h2>

          <h3>3.1 Public Wallet Addresses and On-Chain Activity</h3>
          <p>
            When you connect a digital wallet, submit a proof of work, or
            interact with on-chain features of the Service (including, without
            limitation, token burns, payments, and minting events), we record
            the public blockchain wallet addresses involved and the
            corresponding on-chain transaction data. This information is
            necessary to verify on-chain activity and to enable the core
            functionality of the Service.
          </p>
          <p>
            Public wallet addresses and the transactions associated with them
            are, by design, publicly accessible on the underlying blockchain
            network. We do not treat such information as personal data, and we
            do not link wallet addresses to any off-chain identity.
          </p>

          <h3>3.2 Technical and Log Information</h3>
          <p>
            When you access the Service, our infrastructure providers
            automatically collect and log certain technical information that is
            generated by the operation of any standard internet-connected
            service, including:
          </p>
          <ul>
            <li>Internet Protocol (IP) address;</li>
            <li>Browser type and version;</li>
            <li>Operating system and device type;</li>
            <li>Referring URL and pages viewed;</li>
            <li>Date, time, and duration of requests.</li>
          </ul>
          <p>
            This information is used to operate, maintain, secure, and improve
            the Service, and to detect, prevent, and respond to fraud, abuse,
            or violations of our terms of service.
          </p>

          <h3>3.3 Cookies and Similar Technologies</h3>
          <p>
            The Service uses cookies and similar tracking technologies as
            described in Section 5 below.
          </p>
        </section>

        {/* ═══ 4 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">4.</span>How We Use Information
          </h2>
          <p>
            We use the information described in Section 3 for the following
            purposes:
          </p>
          <ol>
            <li>to operate, provide, maintain, and improve the Service;</li>
            <li>to verify on-chain activity submitted by users;</li>
            <li>to measure and analyze aggregate usage of the Service;</li>
            <li>
              to measure the effectiveness of our advertising and to build and
              serve retargeting audiences;
            </li>
            <li>
              to detect, prevent, investigate, and respond to security
              incidents, fraud, abuse, or unlawful activity;
            </li>
            <li>
              to comply with applicable legal obligations and to enforce our
              terms of service.
            </li>
          </ol>
          <p>
            We do not sell, rent, or trade information to third parties for
            monetary consideration. We do not use the information described in
            this Policy to make decisions that produce legal or similarly
            significant effects about individuals.
          </p>
        </section>

        {/* ═══ 5 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">5.</span>Cookies and Third-Party Tracking Technologies
          </h2>
          <p>The Service uses the following third-party tracking technologies:</p>

          <h3>5.1 X (Twitter) Advertising Pixel</h3>
          <p>
            We use the X (Twitter) advertising pixel, provided by X Corp., on
            the homepage of the Service. The pixel may set cookies and collect
            technical information (such as IP address, browser user-agent, page
            URL, and timestamps) for the purposes of measuring the
            effectiveness of advertising and building retargeting audiences. We
            do not receive individually identifying information from the pixel;
            we receive only aggregated audience and performance data.
          </p>
          <p>
            You may opt out of X&apos;s interest-based advertising and ad
            personalization at any time at:{" "}
            <a
              href="https://x.com/settings/personalization"
              target="_blank"
              rel="noreferrer"
            >
              https://x.com/settings/personalization
            </a>
          </p>

          <h3>5.2 Google Analytics 4</h3>
          <p>
            We use Google Analytics 4, a web analytics service provided by
            Google LLC (&quot;Google&quot;), site-wide. Google Analytics uses
            cookies and similar identifiers to collect and analyze information
            about how visitors use the Service, including pages visited,
            referring URLs, device class, and approximate location derived from
            IP address. The information generated by these cookies is
            transmitted to and stored by Google.
          </p>
          <p>
            You may opt out of Google Analytics by installing the Google
            Analytics Opt-out Browser Add-on, available at:{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noreferrer"
            >
              https://tools.google.com/dlpage/gaoptout
            </a>
          </p>

          <h3>5.3 Browser Controls</h3>
          <p>
            You may also configure your browser to block, restrict, or delete
            cookies. Most browsers allow you to refuse third-party cookies
            entirely. Disabling cookies may affect the functionality of certain
            features of the Service.
          </p>
        </section>

        {/* ═══ 6 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">6.</span>Disclosure of Information
          </h2>
          <p>
            We may disclose information described in this Policy to the
            following categories of recipients:
          </p>
          <ol>
            <li>
              <strong>Service providers and infrastructure partners</strong>,
              including hosting and platform providers (such as Vercel Inc.)
              and database and authentication providers (such as Supabase,
              Inc.), who process information on our behalf and under
              contractual confidentiality obligations;
            </li>
            <li>
              <strong>Advertising and analytics partners</strong>, as described
              in Section 5;
            </li>
            <li>
              <strong>Legal and regulatory authorities</strong>, where
              disclosure is required to comply with applicable law, legal
              process, or a valid governmental request, or where we believe in
              good faith that disclosure is necessary to protect our rights,
              the rights of others, or the security of the Service;
            </li>
            <li>
              <strong>Acquirers</strong>, in connection with a merger,
              acquisition, reorganization, financing, sale of assets, or
              similar transaction, subject to standard confidentiality
              protections.
            </li>
          </ol>
          <p>We do not sell personal information.</p>
        </section>

        {/* ═══ 7 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">7.</span>Legal Bases for Processing
            (EEA, UK, and Similar Jurisdictions)
          </h2>
          <p>
            To the extent the General Data Protection Regulation (GDPR), the
            UK GDPR, or similar laws apply, we rely on the following legal
            bases for processing the information described in Section 3:
          </p>
          <ul>
            <li>
              <strong>Legitimate interests</strong>, including the operation,
              security, improvement, and promotion of the Service, and the
              prevention of fraud and abuse;
            </li>
            <li>
              <strong>Performance of a contract</strong>, where processing is
              necessary to provide the Service you have requested;
            </li>
            <li>
              <strong>Consent</strong>, where required by law for advertising
              cookies and similar technologies;
            </li>
            <li>
              <strong>Legal obligation</strong>, where processing is necessary
              to comply with applicable law.
            </li>
          </ul>
          <p>
            Where we rely on consent, you may withdraw it at any time without
            affecting the lawfulness of prior processing.
          </p>
        </section>

        {/* ═══ 8 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">8.</span>Your Rights and Choices
          </h2>
          <p>
            Subject to applicable law, you may have the following rights with
            respect to information about you:
          </p>
          <ol>
            <li>the right to request access to information we hold about you;</li>
            <li>the right to request correction of inaccurate information;</li>
            <li>the right to request deletion of information;</li>
            <li>the right to object to or restrict certain processing;</li>
            <li>the right to data portability;</li>
            <li>
              the right to opt out of targeted advertising or the
              &quot;sharing&quot; of personal information for cross-context
              behavioral advertising, where applicable; and
            </li>
            <li>
              the right to lodge a complaint with a supervisory authority in
              your jurisdiction.
            </li>
          </ol>
          <p>
            Because the Service does not collect names, email addresses, or
            other identifiers that we can use to authenticate a request to a
            specific natural person, our ability to act on individual rights
            requests is inherently limited. Where you can identify a particular
            wallet address or on-chain transaction at issue, we will use
            reasonable efforts to respond.
          </p>
          <p>
            To exercise any of these rights, please contact us using the
            information in Section 14.
          </p>
        </section>

        {/* ═══ 9 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">9.</span>Data Retention
          </h2>
          <p>
            We retain information only for as long as is necessary to fulfill
            the purposes described in this Policy, unless a longer retention
            period is required or permitted by law.
          </p>
          <ul>
            <li>
              <strong>On-chain data</strong>, including public wallet addresses
              and transaction records, is retained indefinitely as a function
              of the underlying blockchain and cannot be deleted by LASTSHIFT.
            </li>
            <li>
              <strong>Server-side technical and log information</strong> is
              retained on standard provider rotation schedules (typically
              thirty (30) to ninety (90) days).
            </li>
            <li>
              <strong>Aggregated and anonymized analytics data</strong> may be
              retained for longer periods for statistical and historical
              purposes.
            </li>
          </ul>
        </section>

        {/* ═══ 10 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">10.</span>Security
          </h2>
          <p>
            We implement reasonable administrative, technical, and physical
            safeguards designed to protect information from unauthorized
            access, use, alteration, disclosure, or destruction. However, no
            method of transmission over the internet or method of electronic
            storage is one hundred percent (100%) secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        {/* ═══ 11 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">11.</span>International Data Transfers
          </h2>
          <p>
            The Service is operated from infrastructure located in the United
            States and may be accessed from, and information may be processed
            in, jurisdictions other than the one in which you reside. By using
            the Service, you acknowledge that information may be transferred to
            and processed in such jurisdictions, which may have data protection
            laws different from those of your home jurisdiction.
          </p>
        </section>

        {/* ═══ 12 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">12.</span>Children&apos;s Privacy
          </h2>
          <p>
            The Service is not directed to, and we do not knowingly collect
            information from, children under the age of thirteen (13) (or such
            other age as may be defined as a &quot;child&quot; under applicable
            law). If you believe that we have inadvertently collected such
            information, please contact us at the address in Section 14 and we
            will take appropriate steps to delete it.
          </p>
        </section>

        {/* ═══ 13 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">13.</span>Changes to this Policy
          </h2>
          <p>
            We may update this Policy from time to time. When we do, we will
            revise the &quot;Last Updated&quot; date at the top of this Policy
            and, where appropriate, provide additional notice through the
            Service. Material changes will take effect upon posting unless
            otherwise stated. Your continued use of the Service after the
            effective date of any updated Policy constitutes your acceptance of
            the updated terms.
          </p>
        </section>

        {/* ═══ 14 ═══ */}
        <section className="pp-privacy-section">
          <h2>
            <span className="pp-privacy-num">14.</span>Contact
          </h2>
          <p>
            For questions, comments, or requests relating to this Policy,
            please contact:
          </p>
          <div className="pp-privacy-contact">
            <strong>Contact</strong>
            <div className="pp-privacy-contact-name">LASTSHIFT</div>
            <p style={{ margin: 0 }}>
              Email:{" "}
              <a href="mailto:privacy@lastshift.ai">privacy@lastshift.ai</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
