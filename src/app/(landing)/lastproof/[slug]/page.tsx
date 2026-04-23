import type { Metadata } from "next";
import Link from "next/link";
import { AmbassadorCounter } from "./AmbassadorCounter";
import "./affiliate.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} — Build Your Proof of Work | LASTPROOF` };
}

export default async function AmbassadorLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const terminalUrl = `/manage?ref=${slug}`;

  return (
    <div className="af-page">
      {/* ═══ TOP BAR ═══ */}
      <div className="af-topbar">
        <div className="af-topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="af-topbar-logo" />
          <div>
            <div className="af-topbar-name">
              <span className="white">LAST</span><span className="orange">PROOF</span>
            </div>
            <div className="af-topbar-sub">by LASTSHIFT.AI</div>
          </div>
        </div>
        <AmbassadorCounter type="badge" />
      </div>

      <div className="af-container">
        {/* ═══ BRAND HEADER ═══ */}
        <div className="af-brand-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shiftbot-logo.png" alt="LASTPROOF" className="af-brand-logo" />
          <div className="af-brand-name">
            <span className="white">LAST</span><span className="orange">PROOF</span>
          </div>
        </div>

        {/* ═══ HERO ═══ */}
        <section className="af-hero">
          <div className="af-hero-eyebrow">Early access — profiles are live now</div>
          <h1 className="af-hero-title">
            Get verified<br />
            <span className="accent">before everyone else.</span>
          </h1>
          <p className="af-hero-sub">Free for the first 5,000 operators.</p>
          <a href={terminalUrl} className="af-cta-primary">
            BUILD YOUR PROFILE <span className="af-cta-arrow">&rarr;</span>
          </a>
          <div className="af-cta-context">
            Connect a Solana wallet to get started — no email, no password
          </div>
        </section>

        {/* ═══ FREE PRICING STRIP ═══ */}
        <div className="af-pricing-strip">
          <div className="af-pricing-amount">$0</div>
          <div className="af-pricing-sub">until 30 days after Grid launch — then $10/mo</div>
          <div className="af-pricing-note">No credit card. No email. Just your Solana wallet.</div>
        </div>

        <hr className="af-divider" />

        {/* ═══ THE REALITY ═══ */}
        <section className="af-section">
          <div className="af-section-label">The reality</div>
          <h2 className="af-section-title"><span className="accent">Memecoins die.</span> Your reputation shouldn&apos;t.</h2>
          <p className="af-section-body">
            Short-lived projects mean constant gig hunting. LASTPROOF makes your work permanent so the next one finds you.
          </p>
        </section>

        <hr className="af-divider" />

        {/* ═══ BEFORE / AFTER ═══ */}
        <section className="af-section">
          <div className="af-section-label">The difference</div>
          <h2 className="af-section-title">Same marketer. Different proof.</h2>
          <div className="af-ba-grid">
            <div className="af-ba-card">
              <div className="af-ba-header before">
                <span className="af-ba-tag before">WITHOUT LASTPROOF</span>
              </div>
              <div className="af-ba-body before-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/before-lastproof.jpg" alt="Without LASTPROOF — desperate DMs and screenshot dumps" style={{ width: "100%", borderRadius: 6 }} />
                <div className="af-ba-placeholder-text" style={{ marginTop: 12 }}>
                  DMing devs cold. Dumping screenshots. Hoping someone remembers your last campaign before the chart died.
                </div>
              </div>
            </div>
            <div className="af-ba-card">
              <div className="af-ba-header after">
                <span className="af-ba-tag after">WITH LASTPROOF</span>
              </div>
              <div className="af-ba-body after-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/after-lastproof.jpg" alt="With LASTPROOF — one link, full proof, direct hire" style={{ width: "100%", borderRadius: 6 }} />
                <div className="af-ba-placeholder-text" style={{ marginTop: 12 }}>
                  One link. On-chain proofs. Verified by the people who paid you. Instant trust.
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="af-divider" />

        {/* ═══ SOCIAL PROOF COUNTER ═══ */}
        <AmbassadorCounter type="full" />

        <hr className="af-divider" />

        {/* ═══ SIGNUP FLOW ═══ */}
        <section className="af-section">
          <div className="af-section-label">Takes 2 minutes</div>
          <h2 className="af-section-title">Here&apos;s what you do first.</h2>
          <div className="af-steps-grid">
            <div className="af-step">
              <div className="af-step-num">01</div>
              <div className="af-step-text">Launch the Terminal</div>
            </div>
            <div className="af-step">
              <div className="af-step-num">02</div>
              <div className="af-step-text">Connect wallet</div>
            </div>
            <div className="af-step">
              <div className="af-step-num">03</div>
              <div className="af-step-text">Claim your URL + build profile</div>
            </div>
            <div className="af-step">
              <div className="af-step-num">04</div>
              <div className="af-step-text">Collect proofs</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a href={terminalUrl} className="af-cta-primary">
              BUILD YOUR PROFILE <span className="af-cta-arrow">&rarr;</span>
            </a>
          </div>
        </section>

        <hr className="af-divider" />

        {/* ═══ GRID SHOWCASE ═══ */}
        <section className="af-section">
          <div className="af-section-label">The Grid — Launching May 2026</div>
          <h2 className="af-section-title">Where projects will hire you.</h2>
          <p className="af-section-body">
            The Grid ranks operators by proofs. Projects with <strong>proofs already stacked</strong> will be found first when teams and devs come looking.
          </p>

          <div className="af-browser-frame">
            <div className="af-browser-bar">
              <div className="af-browser-dots">
                <span className="af-dot r" /><span className="af-dot y" /><span className="af-dot g" />
              </div>
              <div className="af-browser-url">
                lastproof.app/<span className="af-url-hl">grid</span>
              </div>
            </div>
            <div className="af-browser-body">
              {/* Result Card 1 — CryptoMark */}
              <div className="af-result-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="af-result-avatar" src="/avatars/cryptoMark.jpg" alt="CryptoMark" />
                <div className="af-result-info">
                  <div className="af-result-name-row">
                    <span className="af-result-name">CryptoMark</span>
                    <span className="af-result-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>
                    <span className="af-result-badge-ea">EA</span>
                    <span className="af-result-status">ACTIVE</span>
                  </div>
                  <div className="af-result-meta"><span className="af-result-count">47 proofs</span> &middot; 3 DEV &middot; 50 projects</div>
                  <div className="af-result-pitch">Three years in the trenches of web3 marketing. Taken projects from zero to 15K organic on X, managed 400+ raid teams.</div>
                  <div className="af-result-cats">
                    <span className="af-result-cat primary">Raid Leader</span>
                    <span className="af-result-cat">Community Manager</span>
                    <span className="af-result-cat">Growth / Paid Media</span>
                  </div>
                </div>
                <div className="af-result-right">
                  <span className="af-result-tier t4">TIER 4<br /><small>&middot; LEGEND</small></span>
                  <span className="af-result-price">$$$</span>
                  <span className="af-result-cmd">&gt; view</span>
                </div>
              </div>

              {/* Result Card 2 — SolRaider */}
              <div className="af-result-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="af-result-avatar" src="/avatars/Solraider.jpg" alt="SolRaider" />
                <div className="af-result-info">
                  <div className="af-result-name-row">
                    <span className="af-result-name">SolRaider</span>
                    <span className="af-result-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>
                    <span className="af-result-status">ACTIVE</span>
                  </div>
                  <div className="af-result-meta"><span className="af-result-count">31 proofs</span> &middot; 2 DEV &middot; 28 projects</div>
                  <div className="af-result-pitch">Raid commander. Built and managed 400-person raid teams across 12 Solana projects.</div>
                  <div className="af-result-cats">
                    <span className="af-result-cat primary">Raid Leader</span>
                    <span className="af-result-cat">Community Manager</span>
                  </div>
                </div>
                <div className="af-result-right">
                  <span className="af-result-tier t3">TIER 3<br /><small>&middot; EXPERIENCED</small></span>
                  <span className="af-result-price">$$</span>
                  <span className="af-result-cmd">&gt; view</span>
                </div>
              </div>

              {/* Result Card 3 — NightKOL */}
              <div className="af-result-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="af-result-avatar" src="/avatars/nightKOL.jpg" alt="NightKOL" />
                <div className="af-result-info">
                  <div className="af-result-name-row">
                    <span className="af-result-name">NightKOL</span>
                    <span className="af-result-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>
                    <span className="af-result-status">ACTIVE</span>
                  </div>
                  <div className="af-result-meta"><span className="af-result-count">18 proofs</span> &middot; 1 DEV &middot; 22 projects</div>
                  <div className="af-result-pitch">KOL network manager. Connected projects to 200+ influencers across Solana and EVM chains.</div>
                  <div className="af-result-cats">
                    <span className="af-result-cat primary">KOL / Influencer</span>
                    <span className="af-result-cat">Content Creator</span>
                  </div>
                </div>
                <div className="af-result-right">
                  <span className="af-result-tier t2">TIER 2<br /><small>&middot; VERIFIED</small></span>
                  <span className="af-result-price">$$</span>
                  <span className="af-result-cmd">&gt; view</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="af-divider" />

        {/* ═══ SHIFTBOT AI SEARCH ═══ */}
        <section className="af-section">
          <div className="af-section-label">AI-Powered Discovery</div>
          <h2 className="af-section-title">Projects don&apos;t scroll. They ask SHIFTBOT.</h2>
          <p className="af-section-body">
            SHIFTBOT is the AI search layer on top of the Grid. Projects describe what they need and SHIFTBOT recommends operators ranked by proofs, tier, and category match.
          </p>
          <div className="af-code-block">
            <code>&gt; find me a raid leader with tier 3+ and DEV proofs</code>
            <code>&gt; who&apos;s good at X growth for Solana projects?</code>
            <code>&gt; show me community managers with 20+ proofs</code>
          </div>
          <p className="af-section-body" style={{ marginTop: 20 }}>
            <strong>The more proofs you have, the more SHIFTBOT recommends you.</strong>
          </p>
        </section>

        <hr className="af-divider" />

        {/* ═══ HOW PROOFS WORK ═══ */}
        <section className="af-section">
          <div className="af-section-label">How proofs work</div>
          <h2 className="af-section-title">On-chain receipts for work you&apos;ve done.</h2>
          <p className="af-section-body">
            A proof is a <strong>paid on-chain transaction on Solana</strong>. Collaborators, teammates, and past coworkers pay <strong>$1</strong> to vouch for your work. Coin devs and project teams pay <strong>$5</strong> for a deployer verification. Every proof is linked to Solscan and permanent.
          </p>
          <div className="af-dev-badge-callout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            Get a project&apos;s deployer wallet to verify you and you earn the <strong>DEV badge</strong> — the strongest trust signal on the platform.
          </div>
          <div className="af-tiers">
            <div className="af-tier"><span className="af-tier-badge t1">TIER 1</span><span className="af-tier-text"><strong>New</strong> — 0 proofs</span></div>
            <div className="af-tier"><span className="af-tier-badge t2">TIER 2</span><span className="af-tier-text"><strong>Verified</strong> — 10+ proofs</span></div>
            <div className="af-tier"><span className="af-tier-badge t3">TIER 3</span><span className="af-tier-text"><strong>Experienced</strong> — 25+ proofs</span></div>
            <div className="af-tier"><span className="af-tier-badge t4">TIER 4</span><span className="af-tier-text"><strong>Legend</strong> — 50+ proofs. Top of the Grid.</span></div>
          </div>
        </section>

        <hr className="af-divider" />

        {/* ═══ THE EARLY ACCESS DEAL ═══ */}
        <section className="af-section">
          <div className="af-offer-card">
            <div className="af-offer-header">
              <span className="af-offer-title">The Early Access Deal</span>
              <span className="af-offer-tag">FREE UNTIL GRID LAUNCH + 30 DAYS</span>
            </div>
            <div className="af-offer-body">
              <div className="af-offer-item"><span className="af-offer-check">+</span> Your profile goes live immediately — share it in DMs, bios, applications today</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> Proofs at $1 each — collaborators, teammates, past coworkers pay to vouch</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> DEV verifications at $5 — coin devs and project teams verify contributions</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> 40% off with $LASTSHFT — proofs paid with token get best rate</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> DEV badge eligible — earn strongest trust signal</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> Minted Projects — $1 each — pin top campaigns for permanent visibility</div>
              <div className="af-offer-item"><span className="af-offer-check">+</span> Auto-listed on the Grid at launch — ranked by proofs already stacked</div>
            </div>
            <div className="af-offer-price">
              <span className="af-offer-free">$0</span> until 30 days after Grid launch — then <span className="af-offer-paid">$10/mo</span>
            </div>
          </div>
        </section>

        {/* ═══ MID CTA ═══ */}
        <div className="af-mid-cta">
          <div className="af-mid-cta-headline">Still sending screenshots in DMs?</div>
          <a href={terminalUrl} className="af-cta-primary">
            BUILD YOUR PROFILE <span className="af-cta-arrow">&rarr;</span>
          </a>
          <div className="af-cta-context">
            Connect a Solana wallet to get started. No email. No password. Just your wallet.
          </div>
        </div>

        {/* ═══ BURN FOOTNOTE ═══ */}
        <div className="af-burn-note">
          25% of all revenue is permanently burned from the <strong>$LASTSHFT</strong> supply.
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer className="af-footer">
          <div className="af-footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shiftbot-logo.png" alt="" className="af-footer-logo" />
            <span>
              <Link href="https://lastproof.app">LASTPROOF</Link> by{" "}
              <Link href="https://lastshift.ai">lastshift.ai</Link>
            </span>
          </div>
          <div className="af-footer-sub">a company of vibe coders</div>
        </footer>
      </div>
    </div>
  );
}
