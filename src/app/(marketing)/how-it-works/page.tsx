"use client";

import { useState } from "react";
import Link from "next/link";
import "./how-it-works.css";

/**
 * How It Works — full marketing explainer.
 * Mirrors wireframes/how-it-works.html section-for-section.
 * Toggle switches between "For Devs & Teams" and "For Operators" panes.
 * The topbar, footer, and SHIFTBOT strip come from the (marketing) layout.
 */
export default function HowItWorksPage() {
  const [mode, setMode] = useState<"dev" | "op" | "verify">("dev");
  const [showFlowDetails, setShowFlowDetails] = useState(false);

  return (
    <>
      {/* ═══ HERO ═══ */}
      <div className="hiw-hero">
        <div className="hero-eyebrow">
          HOW IT WORKS&nbsp;&nbsp;//&nbsp;&nbsp;LAST
          <span style={{ color: "#fff" }}>PROOF</span>
        </div>
        <h1>
          One link. <span className="orange">Full proof.</span>
          <br />
          Direct hire.
        </h1>
        <p className="body-text">
          LASTPROOF replaces screenshot dumps and TG vouches with on-chain
          receipts. Operators build a wallet-locked profile. Devs skip the anon
          roulette.
        </p>
      </div>

      {/* ═══ TOGGLE ═══ */}
      <div className="toggle-wrap">
        <div className="toggle" role="tablist">
          <button
            id="btn-dev"
            role="tab"
            aria-pressed={mode === "dev"}
            className={mode === "dev" ? "dev" : undefined}
            onClick={() => setMode("dev")}
          >
            &gt; FOR DEVS &amp; TEAMS
          </button>
          <button
            id="btn-op"
            role="tab"
            aria-pressed={mode === "op"}
            onClick={() => setMode("op")}
          >
            &gt; FOR OPERATORS
          </button>
          <button
            id="btn-verify"
            role="tab"
            aria-pressed={mode === "verify"}
            onClick={() => setMode("verify")}
          >
            &gt; VERIFY THIS WORK
          </button>
        </div>
      </div>
      <div className="toggle-sub">SAME PLATFORM&nbsp;&nbsp;//&nbsp;&nbsp;THREE DOORS</div>

      {/* ═══════════════════════════════════════════════════
          DEVS & TEAMS PANE
          ═══════════════════════════════════════════════════ */}
      <section
        id="pane-dev"
        className={`pane${mode === "dev" ? " active" : ""}`}
        data-mode="dev"
      >
        {/* WHAT LASTPROOF SOLVES */}
        <div className="section-title">WHAT LASTPROOF SOLVES</div>
        <h2 className="section-h2">
          You&rsquo;re one bad hire away from rugged work.
        </h2>

        <div className="solve">
          <div className="solve-card">
            <div className="x">// PROBLEM 01</div>
            <h4>Pay first. Ghost later.</h4>
            <p>
              The standard web3 marketing deal: money upfront, &ldquo;work&rdquo; after.
              Half of them{" "}
              <strong>take the bag and disappear</strong>. The other half
              under-deliver and block you when you ask questions. You eat the
              loss.
            </p>
          </div>
          <div className="solve-card">
            <div className="x">// PROBLEM 02</div>
            <h4>Screenshots lie. Every anon sounds the same.</h4>
            <p>
              Every marketer has the same &ldquo;case study&rdquo; deck — same numbers,
              same followers, same Photoshop.{" "}
              <strong>LASTPROOF swaps vibes for on-chain receipts</strong> —
              every proof is a paid Solana transaction you can click through.
            </p>
          </div>
          <div className="solve-card">
            <div className="x">// PROBLEM 03</div>
            <h4>No accountability, no warning system.</h4>
            <p>
              An operator rugs one project and moves to the next with a clean
              slate. Proofs are{" "}
              <strong>permanent, public, and tied to wallets</strong> —
              reputation stops being disposable and burn history follows them.
            </p>
          </div>
        </div>

        {/* SHIFTBOT */}
        <div className="section-title" style={{ marginTop: 60 }}>
          SHIFTBOT
        </div>
        <h2 className="section-h2">
          Don&rsquo;t scroll 1,000 profiles. Ask.
        </h2>

        <section className="hiw-sb-showcase">
          <div className="sb-inner">
            <div className="sb-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-logo" />
            </div>
            <div className="sb-eyebrow">
              SHIFTBOT&nbsp;&nbsp;//&nbsp;&nbsp;AI-RANKED OPERATOR SEARCH
            </div>
            <h2>
              Describe the hire. <span className="green">Get a shortlist.</span>
            </h2>
            <p className="sb-sub">
              SHIFTBOT reads every profile, every proof, every minted project on
              the Grid — then ranks verified operators against the brief you type
              in plain English.
            </p>
            <div className="sb-input">
              <span className="cursor">&gt;</span>
              <span className="ph">
                find me a raid leader, Tier 3+, with DEV proofs on Solana
                memecoins...
              </span>
              <span className="go">ASK &rarr;</span>
            </div>
            <div className="sb-prompts">
              <div className="sb-prompt">
                who&rsquo;s the best X Spaces host for a Solana launch?
              </div>
              <div className="sb-prompt">find a KOL manager under $$$</div>
              <div className="sb-prompt">
                community managers active in the last 48h
              </div>
              <div className="sb-prompt">raid leaders with 25+ proofs</div>
              <div className="sb-prompt">
                operators who&rsquo;ve worked on memecoins before
              </div>
            </div>

            {/* SHIFTBOT response mock */}
            <div className="sb-response">
              <div className="sb-resp-head">
                <span className="d"></span>SHIFTBOT MATCHED{" "}
                <span className="num">&nbsp;OPERATORS</span>&nbsp; · RANKED BY
                PROOF WEIGHT + CATEGORY MATCH + RECENCY
              </div>

              <div className="sb-resp-row">
                <div className="rank">#1</div>
                <div>
                  <div className="n">
                    SolRaider <span className="gm-tier">TIER 3</span>{" "}
                    <span className="mp-badge dev">★ 2 DEV</span>
                  </div>
                  <div className="m">
                    Solana-focused · raid specialist · memecoin history · $$ fee
                  </div>
                </div>
                <div className="score">TOP MATCH</div>
              </div>

              <div className="sb-resp-row">
                <div className="rank">#2</div>
                <div>
                  <div className="n">
                    CryptoMark <span className="gm-tier">TIER 3</span>{" "}
                    <span className="mp-badge dev">★ 3 DEV</span>
                  </div>
                  <div className="m">
                    X growth + raid lead · memecoin mints · $$$ fee
                  </div>
                </div>
                <div className="score">STRONG MATCH</div>
              </div>

              <div className="sb-resp-row">
                <div className="rank">#3</div>
                <div>
                  <div className="n">
                    RaidQueen{" "}
                    <span className="gm-tier t4">TIER 4</span>{" "}
                    <span className="mp-badge dev">★ 5 DEV</span>
                  </div>
                  <div className="m">
                    Raid commander · high DEV count · $$$ fee
                  </div>
                </div>
                <div className="score">STRONG MATCH</div>
              </div>

              <div className="sb-resp-foot">
                <span>Additional matches filtered by fee ceiling</span>
                <span>
                  QUERY TIME <b>&lt; 1s</b>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST TIER */}
        <div className="section-title" style={{ marginTop: 60 }}>
          TRUST TIER
        </div>
        <h2 className="section-h2">
          Every operator carries a tier.{" "}
          <span className="orange">Earned, not bought.</span>
        </h2>

        <section className="tier-showcase">
          <div className="ts-head">
            <div className="ts-eyebrow">ON-CHAIN TRUST LADDER</div>
            <div className="ts-sub">
              Proofs stack. Tiers climb. SHIFTBOT ranks by it. You hire by it.
            </div>
          </div>

          <div className="ts-bar-wrap">
            <div className="ts-bar">
              <div className="ts-bar-fill"></div>
            </div>
            <div className="ts-ticks">
              <div className="ts-tick">
                <b>TIER 1 &middot; NEW</b>
                <span>0+ proofs</span>
              </div>
              <div className="ts-tick">
                <b>TIER 2 &middot; VERIFIED</b>
                <span>10+ proofs</span>
              </div>
              <div className="ts-tick">
                <b>TIER 3 &middot; EXPERIENCED</b>
                <span>25+ proofs</span>
              </div>
              <div className="ts-tick">
                <b>TIER 4 &middot; LEGEND</b>
                <span>50+ proofs</span>
              </div>
            </div>
          </div>

          <div className="ts-grid">
            <div className="ts-card t1">
              <div className="ts-num">TIER 1</div>
              <div className="ts-label">NEW</div>
              <div className="ts-desc">
                Just joined. No proofs yet. A starting point — not a risk
                signal.
              </div>
            </div>
            <div className="ts-card t2">
              <div className="ts-num">TIER 2</div>
              <div className="ts-label">VERIFIED</div>
              <div className="ts-desc">
                10+ on-chain proofs. Shipped real work on real projects.
              </div>
            </div>
            <div className="ts-card t3">
              <div className="ts-num">TIER 3</div>
              <div className="ts-label">EXPERIENCED</div>
              <div className="ts-desc">
                25+ proofs. A track record that&rsquo;s hard to fake and easy to
                verify.
              </div>
            </div>
            <div className="ts-card t4">
              <div className="ts-num">TIER 4</div>
              <div className="ts-label">LEGEND</div>
              <div className="ts-desc">
                50+ proofs. Top of the ladder. These are the ones you fight to
                hire.
              </div>
            </div>
          </div>

          <div className="ts-foot">
            <span className="ts-foot-k">PROOF = ON-CHAIN MINT</span>
            <span className="ts-foot-d">&middot;</span>
            <span>No pay-to-rank. No stake-to-boost. Only work counts.</span>
          </div>
        </section>

        {/* WHAT TO LOOK FOR */}
        <div className="section-title" style={{ marginTop: 60 }}>
          WHAT TO LOOK FOR
        </div>
        <h2 className="section-h2">
          Signals that actually mean something.
        </h2>

        <div className="anatomy">
          {/* mock profile */}
          <div className="mock-profile">
            <div className="mp-top">
              <div className="mp-avatar">CM</div>
              <div>
                <div className="mp-name">CryptoMark</div>
                <div className="mp-handle">
                  @cryptomark &middot; UTC+1 &middot; $$$
                </div>
                <div className="mp-badges">
                  <span className="mp-badge verified">&#10003; VERIFIED</span>
                  <span className="mp-badge tier">
                    TIER 3 — EXPERIENCED
                  </span>
                  <span className="mp-badge dev">★ 3 DEV</span>
                  <span className="mp-badge active">ACTIVE</span>
                </div>
              </div>
            </div>
            <div className="mp-stats">
              <div className="mp-stat">
                <span className="n">47</span>
                <span className="l">Proofs</span>
              </div>
              <div className="mp-stat">
                <span className="n">3</span>
                <span className="l">DEV</span>
              </div>
              <div className="mp-stat">
                <span className="n">50</span>
                <span className="l">Projects</span>
              </div>
              <div className="mp-stat">
                <span className="n">100</span>
                <span className="l">Rank</span>
              </div>
            </div>
            <div className="mp-row">
              <span className="mp-chip">X Growth</span>
              <span className="mp-chip">Raid Leading</span>
              <span className="mp-chip">Community Mgmt</span>
            </div>
            <div className="mp-pitch">
              Three years in the trenches. Zero-to-15K organic on X,
              400-person raid teams, Telegram comms people actually stay in.
            </div>
            <div className="mp-minted">
              <span className="star">★</span>
              <strong>$BONK</strong> — Raid Commander
              <span className="mini">MINTED &middot; 9 proofs</span>
            </div>
            <div className="mp-minted">
              <span className="star">★</span>
              <strong>$SOL</strong> — Marketing Director
              <span className="mini">MINTED &middot; 8 proofs</span>
            </div>
          </div>

          {/* what to look for list */}
          <div className="look-list">
            <h4>Read the wallet, not the DMs.</h4>
            <div className="look-row">
              <div className="ico verified-ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div className="txt">
                <strong>Identity verified &#10003;</strong>Their X and Telegram
                are cryptographically linked to the wallet behind every proof.
                The anon sliding into your DMs is the same wallet shipping the
                work — not a recycled persona, not a fresh burner spun up after
                the last rug.
              </div>
            </div>
            <div className="look-row">
              <div className="ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
                </svg>
              </div>
              <div className="txt">
                <strong>Tier</strong>Proof count bucketed. Tier 3+ means
                they&rsquo;ve survived real campaigns, not just opened an
                account.
              </div>
            </div>
            <div className="look-row">
              <div className="ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9" />
                </svg>
              </div>
              <div className="txt">
                <strong>DEV proofs</strong>Signed by a project&rsquo;s deployer
                wallet. This is the only badge that can&rsquo;t be coordinated
                between friends.
              </div>
            </div>
            <div className="look-row">
              <div className="ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M4 10h16M10 4v16" />
                </svg>
              </div>
              <div className="txt">
                <strong>Minted projects</strong>Locked roles on specific tickers
                with dates + proof counts. Real on-chain work history — not a
                Notion doc, not a Telegram screenshot dump.
              </div>
            </div>
            <div className="look-row">
              <div className="ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M3 6h18M3 12h18M3 18h12" />
                </svg>
              </div>
              <div className="txt">
                <strong>Category match</strong>Raid leader vs KOL vs growth
                strategist are not the same job. Filter hard.
              </div>
            </div>
            <div className="look-row">
              <div className="ico">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div className="txt">
                <strong>Active + time zone</strong>Ghost profiles stand out.
                Active in the last 7 days and overlapping your working hours =
                they&rsquo;ll actually show up.
              </div>
            </div>
          </div>
        </div>

        {/* THE GRID */}
        <div className="section-title" style={{ marginTop: 60 }}>
          THE GRID
        </div>
        <h2 className="section-h2">Every verified operator. One scan.</h2>

        <div className="grid-mock">
          <div className="gm-head">
            <div>&gt; lastproof.app/grid</div>
            <div className="gm-stats">
              <span>
                <b>&mdash;</b>Profiles
              </span>
              <span>
                <b>&mdash;</b>Proofs
              </span>
              <span>
                <b>&mdash;</b>DEV
              </span>
            </div>
          </div>
          <div className="gm-body">
            <div className="gm-filters">
              <div className="gm-f-label">Category</div>
              <div className="gm-f-opt on">Raid Leading</div>
              <div className="gm-f-opt">X Growth</div>
              <div className="gm-f-opt">KOL Management</div>
              <div className="gm-f-label">Tier</div>
              <div className="gm-f-opt on">Tier 4 — Trusted</div>
              <div className="gm-f-opt on">Tier 3 — Experienced</div>
              <div className="gm-f-label">Fee</div>
              <div className="gm-f-opt">$</div>
              <div className="gm-f-opt on">$$</div>
              <div className="gm-f-opt on">$$$</div>
              <div className="gm-f-label">Sort</div>
              <div className="gm-f-opt on">Most DEV badges</div>
            </div>
            <div className="gm-results">
              <div className="gm-card">
                <div className="av">NK</div>
                <div>
                  <div className="name">
                    NightKOL <span className="gm-tier t4">TIER 4</span>
                  </div>
                  <div className="meta">
                    <b>62 proofs</b> &middot; <b>4 DEV</b> &middot; 38 projects
                    &middot; UTC+0
                  </div>
                  <div className="cats">
                    <span>KOL Mgmt</span>
                    <span>X Growth</span>
                  </div>
                </div>
                <span className="btn btn-ghost btn-sm">&gt; view</span>
              </div>
              <div className="gm-card">
                <div className="av">CM</div>
                <div>
                  <div className="name">
                    CryptoMark <span className="gm-tier">TIER 3</span>
                  </div>
                  <div className="meta">
                    <b>47 proofs</b> &middot; <b>3 DEV</b> &middot; 50 projects
                    &middot; UTC+1
                  </div>
                  <div className="cats">
                    <span>X Growth</span>
                    <span>Raid Leading</span>
                  </div>
                </div>
                <span className="btn btn-ghost btn-sm">&gt; view</span>
              </div>
              <div className="gm-card">
                <div className="av">SR</div>
                <div>
                  <div className="name">
                    SolRaider <span className="gm-tier">TIER 3</span>
                  </div>
                  <div className="meta">
                    <b>31 proofs</b> &middot; <b>2 DEV</b> &middot; 22 projects
                    &middot; UTC-5
                  </div>
                  <div className="cats">
                    <span>Raid Leading</span>
                  </div>
                </div>
                <span className="btn btn-ghost btn-sm">&gt; view</span>
              </div>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="feat">
            <div className="feat-label">// FILTERS THAT MATTER</div>
            <div className="val">5</div>
            <h4>Category, tier, fee, DEV, activity</h4>
            <p>
              Stop guessing. Narrow the whole Grid down to the handful
              who&rsquo;ve actually shipped what you need.
            </p>
          </div>
          <div className="feat">
            <div className="feat-label">// HIRE DIRECT</div>
            <div className="val">0 fee</div>
            <h4>Straight to Telegram</h4>
            <p>
              Click HIRE on any profile — routes to their Telegram. No
              middleman, no commission, no platform tax.
            </p>
          </div>
          <div className="feat">
            <div className="feat-label">// FREE TO SCAN</div>
            <div className="val">$0</div>
            <h4>No paywall for devs</h4>
            <p>
              Browse, filter, verify. Operators pay to build proof. You just
              pick the ones who did the work.
            </p>
          </div>
          <div
            className="feat verified-feat"
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 18,
              alignItems: "center",
            }}
          >
            <div className="verified-shield">
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="feat-label">// IDENTITY VERIFICATION</div>
              <h4 style={{ fontSize: 16 }}>
                Every profile is wallet-bound to a real X + Telegram
              </h4>
              <p>
                Operators link their X handle and Telegram to the same wallet
                that signs every proof. No anonymous accounts, no recycled
                personas, no bait-and-switch DMs. The &#10003;{" "}
                <strong style={{ color: "var(--green)" }}>VERIFIED</strong>{" "}
                badge means the human pitching you is the same human shipping
                the work — and the same wallet collecting on-chain receipts.
              </p>
            </div>
          </div>
        </div>

        {/* RED FLAGS */}
        <div className="section-title" style={{ marginTop: 60 }}>
          RED FLAGS
        </div>
        <h2 className="section-h2">
          What SHIFTBOT de-ranks — and you should too.
        </h2>

        <div className="flags">
          <div className="flag">
            <div className="f-label">// FLAG 01</div>
            <h5>0 DEV proofs at Tier 3+</h5>
            <p>
              Lots of friendly proofs, no deployer sign-off. Their network likes
              them. The projects they worked on didn&rsquo;t verify.
            </p>
          </div>
          <div className="flag">
            <div className="f-label">// FLAG 02</div>
            <h5>Inactive &gt; 30 days</h5>
            <p>
              Profile stacked during early access, then ghosted. History matters
              — recency matters more.
            </p>
          </div>
          <div className="flag">
            <div className="f-label">// FLAG 03</div>
            <h5>No minted projects</h5>
            <p>
              Proofs without locked roles = loose attestations. The strongest
              profiles tie every proof to a specific ticker and timeframe.
            </p>
          </div>
          <div className="flag">
            <div className="f-label">// FLAG 04</div>
            <h5>Category sprawl</h5>
            <p>
              Someone tagged into all 15 categories isn&rsquo;t specialized —
              they&rsquo;re fishing. Tier 3+ operators usually own 2-3.
            </p>
          </div>
          <div className="flag">
            <div className="f-label">// FLAG 05</div>
            <h5>No identity verification</h5>
            <p>
              Proofs without a verified X + Telegram = wallet, but no human
              attached. Recycled personas hide here. Always require the &#10003;
              VERIFIED badge.
            </p>
          </div>
        </div>

        <div className="callout" style={{ marginTop: 40 }}>
          <div className="callout-text">
            Every signal on LASTPROOF is{" "}
            <strong>on-chain, public, and permanent</strong>. Stop hiring anons.
            Start hiring wallets with receipts.
          </div>
          <div className="callout-ctas">
            <Link className="btn btn-ghost btn-sm" href="/grid">
              &gt; SCAN GRID
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          OPERATORS PANE
          ═══════════════════════════════════════════════════ */}
      <section
        id="pane-op"
        className={`pane${mode === "op" ? " active" : ""}`}
        data-mode="op"
      >
        {/* THE REALITY */}
        <div className="section-title">THE REALITY</div>
        <h2 className="section-h2">
          Memecoins die. <span className="orange">Your reputation shouldn&rsquo;t.</span>
        </h2>
        <p className="section-lede">
          Short-lived projects mean constant gig hunting. LASTPROOF makes your
          work permanent so the next one finds you.
        </p>

        {/* TWO WAYS */}
        <div className="section-title" style={{ marginTop: 48 }}>
          TWO WAYS TO FIND WORK
        </div>
        <h2 className="section-h2">One profile. Two pipelines.</h2>

        <div className="tw-visuals">
          {/* WAY 01 — DM Unfurl mock */}
          <div className="tw-col">
            <div className="tw-meta">
              <span className="tw-num">// WAY 01 — OUTBOUND</span>
              <span className="tw-tag">YOU REACH OUT</span>
            </div>
            <h4 className="tw-h">Drop one link. Devs see everything.</h4>
            <div className="dm-frame">
              <div className="dm-msg">
                <div className="dm-bubble">
                  gm — here&apos;s my proof &#x1F447; lastproof.app/@cryptomark
                </div>
              </div>
              <div className="unfurl">
                <div className="unfurl-img">
                  <div className="unfurl-av">CM</div>
                </div>
                <div className="unfurl-body">
                  <div className="unfurl-domain">lastproof.app/@cryptomark</div>
                  <div className="unfurl-title">
                    CryptoMark — Verified Operator
                  </div>
                  <div className="unfurl-desc">
                    Raid leading &middot; X growth &middot; community mgmt.
                    Receipts on-chain, wallet-locked.
                  </div>
                  <div className="unfurl-pills">
                    <span className="unfurl-pill v">&#10003; VERIFIED</span>
                    <span className="unfurl-pill t">TIER 3</span>
                    <span className="unfurl-pill d">★ 3 DEV</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tw-cap">
              // social preview in any DM, X bio, or TG
            </div>
          </div>

          {/* WAY 02 — Grid card mock */}
          <div className="tw-col b">
            <div className="tw-meta">
              <span className="tw-num">// WAY 02 — INBOUND</span>
              <span className="tw-tag">DEVS COME TO YOU</span>
            </div>
            <h4 className="tw-h">
              Stack proof. Climb the Grid. Get pinged.
            </h4>
            <div className="grid-frame">
              <div className="grid-bar">
                <span>THE GRID</span>
                <span className="gb-q">
                  SHIFTBOT &gt; &quot;raid leader, sol, T3+&quot;
                </span>
              </div>
              <div className="grid-card">
                <div className="gc-av">CM</div>
                <div className="gc-body">
                  <div className="gc-name">CryptoMark</div>
                  <div className="gc-handle">@cryptomark</div>
                  <div className="gc-pills">
                    <span className="gc-pill v">&#10003; VERIFIED</span>
                    <span className="gc-pill t">T3</span>
                    <span className="gc-pill d">★ 3 DEV</span>
                  </div>
                  <div className="gc-cats">
                    Raid Leading &middot; X Growth &middot; Community Mgmt
                  </div>
                </div>
                <span className="gc-rank">#1</span>
              </div>
            </div>
            <div className="tw-cap">
              // devs scan the Grid &amp; ping your wallet directly
            </div>
          </div>
        </div>

        {/* WHAT YOU GET */}
        <div className="section-title" style={{ marginTop: 60 }}>
          WHAT YOU GET
        </div>
        <h2 className="section-h2">One link. Every chain. Every campaign.</h2>

        <div className="url-hero">
          <div className="uh-left">
            <div className="uh-eyebrow">
              // YOUR HANDLE — LOCKED TO YOUR WALLET
            </div>
            <div className="uh-url">
              lastproof.app/<span className="at">@</span>cryptomark
            </div>
            <div className="uh-sub">
              One URL. Drops into your X bio, any TG, any dev DM. Claim it
              once, it&rsquo;s yours forever.
            </div>
          </div>
          <div className="uh-copy">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            COPY
          </div>
        </div>

        <div className="advantage">
          <div className="adv-card">
            <div className="adv-label">// PROFILE</div>
            <div className="adv-val">
              $10
              <span
                style={{
                  fontSize: 14,
                  color: "var(--text-dim)",
                  fontWeight: 500,
                }}
              >
                /mo
              </span>
            </div>
            <h4>
              lastproof.app/@you — your handle, locked to your wallet
            </h4>
            <p>
              Bio, categories, minted projects, every proof, every link — one
              URL you drop in your X bio, any TG group, any dev DM. No more
              screenshot dumps.
            </p>
          </div>
          <div className="adv-card mid">
            <div className="adv-label">// $LASTSHFT</div>
            <div className="adv-val">40% OFF</div>
            <h4>Pay proofs in $LASTSHFT, save 40%</h4>
            <p>
              Collaborators who use $LASTSHFT to vouch for you get the cheapest
              rate. The longer you build inside the LASTSHIFT ecosystem, the
              less every proof costs.
            </p>
          </div>
          <div className="adv-card">
            <div className="adv-label">// SUPPLY BURN</div>
            <div className="adv-val">25%</div>
            <h4>25% of all revenue is permanently burned</h4>
            <p>
              Every proof, every profile, every $LASTSHFT payment burns supply
              forever. The platform you build your reputation on is the same one
              you&rsquo;re holding the bag of.
            </p>
          </div>
        </div>

        {/* THE DIFFERENCE */}
        <div className="section-title" style={{ marginTop: 60 }}>
          THE DIFFERENCE
        </div>
        <h2 className="section-h2">
          This is the reality. Pick your side.
        </h2>

        <div className="badiff">
          <div className="ba before">
            <div className="ba-head">
              <span className="ba-tag">// WITHOUT LASTPROOF</span>
              <span className="ba-pill">THE GRIND</span>
            </div>
            <div className="ba-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/before-lastproof.jpg"
                alt="Without LASTPROOF — desperate DMs and screenshot dumps"
              />
            </div>
            <div className="ba-cap">
              DMing devs cold. Dumping screenshots. Hoping someone remembers
              your last campaign before the chart died.{" "}
              <strong>
                Every dead memecoin sends you back to square one.
              </strong>
            </div>
          </div>
          <div className="ba after">
            <div className="ba-head">
              <span className="ba-tag">// WITH LASTPROOF</span>
              <span className="ba-pill">ONE LINK</span>
            </div>
            <div className="ba-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/after-lastproof.jpg"
                alt="With LASTPROOF — one link, full proof, direct hire"
              />
            </div>
            <div className="ba-cap">
              One URL. Wallet-locked identity, minted projects, DEV proofs,
              every receipt.{" "}
              <strong>
                Devs read your Grid card and ping the wallet directly.
              </strong>
            </div>
          </div>
        </div>

        {/* PROOF TYPES */}
        <div className="section-title" style={{ marginTop: 60 }}>
          PROOF TYPES
        </div>
        <h2 className="section-h2">Four ways to build your edge.</h2>

        <div className="proof-types">
          <div className="pt">
            <div className="pt-ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="pt-label">STANDARD PROOF</div>
            <div className="pt-price">$1</div>
            <p>
              A collaborator pays $1 to vouch for a campaign you ran. Permanent
              on-chain transaction linked to your wallet.
            </p>
          </div>
          <div className="pt pt-dev">
            <div className="pt-ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="pt-label">DEV PROOF</div>
            <div className="pt-price">$5</div>
            <p>
              A wallet that{" "}
              <strong style={{ color: "var(--green)" }}>
                deployed, holds mint authority over, or is a multisig signer on
              </strong>{" "}
              the project signs off on your work. Strongest trust signal —
              can&rsquo;t be coordinated, can&rsquo;t be faked.
            </p>
          </div>
          <div className="pt pt-mint">
            <div className="pt-ico">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9" />
              </svg>
            </div>
            <div className="pt-label">★ MINTED</div>
            <div className="pt-price">$1</div>
            <p>
              Pin your top campaigns to the top of your profile with role,
              ticker, and dates. Permanent visibility, locked to your wallet.
            </p>
          </div>
          <div className="pt pt-tier">
            <div className="pt-ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 3v18h18" />
                <path d="m7 15 4-4 4 4 5-5" />
              </svg>
            </div>
            <div className="pt-label">TIER CLIMB</div>
            <div className="pt-price">T1 &rarr; T4</div>
            <p>
              Every proof climbs your tier. 25+ proofs = Tier 4 Trusted — top of
              the Grid, first in every SHIFTBOT response.
            </p>
          </div>
        </div>

        {/* SHIFTBOT WORKS FOR YOU */}
        <div className="section-title" style={{ marginTop: 60 }}>
          SHIFTBOT WORKS FOR YOU
        </div>
        <h2 className="section-h2">
          The more proof you stack, the more SHIFTBOT recommends you.
        </h2>

        <div className="callout" style={{ marginTop: 0 }}>
          <div className="callout-text">
            SHIFTBOT is the AI layer over the Grid — devs type a brief in plain
            English, SHIFTBOT returns a ranked shortlist.{" "}
            <strong>
              The math weights DEV proofs, recency, and category match.
            </strong>{" "}
            Every proof you collect literally moves you up in the queries that
            matter.
          </div>
          <div className="callout-ctas">
            <Link className="btn btn-primary btn-sm" href="/how-it-works#pane-dev">
              &gt; SEE HOW IT RANKS
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          VERIFY THIS WORK PANE
          ═══════════════════════════════════════════════════ */}
      <section
        id="pane-verify"
        className={`pane${mode === "verify" ? " active" : ""}`}
        data-mode="verify"
      >
        {/* HERO INTRO */}
        <div className="section-title">VERIFY THIS WORK</div>
        <h2 className="section-h2">
          No login. No wallet connect.{" "}
          <span className="orange">No LASTPROOF profile required.</span>
        </h2>
        <p className="section-lede">
          Anyone with a Solana wallet can verify a proof — you don&rsquo;t need
          an account, you don&rsquo;t need to be an operator, you just need to
          have worked with one. The receipt lives on Solana forever, and the
          operator can never edit it.
        </p>

        {/* WHERE TO FIND IT */}
        <div className="section-title" style={{ marginTop: 60 }}>
          WHERE TO FIND IT
        </div>
        <h2 className="section-h2">
          One button. <span className="orange">On every work item.</span>
        </h2>

        <div className="vw-find">
          <div className="vw-find-copy">
            <p>
              Open any operator&rsquo;s public profile (the{" "}
              <code>lastproof.app/@handle</code> link they paste in DMs). Scroll
              to their <strong>PROOF OF WORK</strong> section — every job has a
              green <strong>VERIFY THIS WORK</strong> button at the bottom of
              the card.
            </p>
            <p>
              No sign-up screen. No &ldquo;create account&rdquo; wall.
              Click&nbsp;&rarr;&nbsp;modal opens&nbsp;&rarr;&nbsp;start
              verifying.
            </p>
          </div>
          <div className="vw-find-mock">
            <div className="vw-mock-card">
              <div className="vw-mock-row">
                <span className="vw-mock-ticker">$ACME</span>
                <span className="vw-mock-current">CURRENT</span>
              </div>
              <div className="vw-mock-role">Marketing Lead</div>
              <div className="vw-mock-org">Acme Protocol</div>
              <div className="vw-mock-date">Mar 2025 — Present</div>
              <div className="vw-mock-desc">
                Built community from 0 to 12k. Ran the launch campaign, managed
                4 KOL deals, owned the X strategy through the first 90 days
                post-mint.
              </div>
              <button type="button" className="vw-mock-btn" disabled>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                VERIFY THIS WORK
              </button>
            </div>
            <div className="vw-mock-cap">
              // every work item · every profile · same button
            </div>
          </div>
        </div>

        {/* WHY IT BUILDS TRUST */}
        <div className="section-title" style={{ marginTop: 60 }}>
          WHY IT BUILDS TRUST
        </div>
        <h2 className="section-h2">
          A claim becomes a fact when{" "}
          <span className="orange">someone else pays to confirm it.</span>
        </h2>

        <div className="solve">
          <div className="solve-card">
            <div className="x">// 01 — RECEIPTS BEAT RESUMES</div>
            <h4>An outside wallet, a paid Solana TX.</h4>
            <p>
              What operators can&rsquo;t fake is{" "}
              <strong>an outside wallet</strong> sending a paid Solana
              transaction that says &ldquo;yes, this happened.&rdquo;
            </p>
          </div>
          <div className="solve-card">
            <div className="x">// 02 — SKIN IN THE GAME</div>
            <h4>Verification costs money. That&rsquo;s the point.</h4>
            <p>
              Verifying isn&rsquo;t free — that&rsquo;s what makes it signal.
              Every <strong>$LASTSHFT spent on a proof gets burned</strong>.
            </p>
          </div>
          <div className="solve-card">
            <div className="x">// 03 — PERMANENT AND PUBLIC</div>
            <h4>Once signed, it&rsquo;s a Solscan link forever.</h4>
            <p>
              The operator can&rsquo;t delete it. The verifier can&rsquo;t take
              it back. <strong>We can&rsquo;t delete it.</strong>
            </p>
          </div>
        </div>

        {/* COLLAB vs DEV */}
        <div className="section-title" style={{ marginTop: 60 }}>
          COLLABORATOR vs DEV
        </div>
        <h2 className="section-h2">
          Same flow. <span className="orange">Two levels of weight.</span>
        </h2>

        <div className="vw-paths">
          <div className="vw-path vw-collab">
            <div className="vw-path-head">
              <div className="vw-path-label">COLLABORATOR PROOF</div>
            </div>
            <div className="vw-path-price">
              $1
              <span className="vw-path-discount">$0.60 in $LASTSHFT</span>
            </div>
            <p className="vw-path-desc">
              Open to anyone with a Solana wallet. You worked with them — back
              the claim.
            </p>
          </div>

          <div className="vw-path vw-dev">
            <div className="vw-path-head">
              <div className="vw-path-label">
                DEV PROOF
                <span className="vw-dev-badge">DEV</span>
              </div>
            </div>
            <div className="vw-path-price">
              $5
              <span className="vw-path-discount">$3 in $LASTSHFT</span>
            </div>
            <p className="vw-path-desc">
              Reserved for the wallet that <strong>deployed the token.</strong>
            </p>
            <div className="vw-qual-label">QUALIFIES IF:</div>
            <ul className="vw-qual-list">
              <li>
                <span className="vw-qual-mark">◆</span>Holds mint authority,{" "}
                <em>OR</em>
              </li>
              <li>
                <span className="vw-qual-mark">◆</span>Signed the original mint
                TX, <em>OR</em>
              </li>
              <li>
                <span className="vw-qual-mark">◆</span>Is a signer on the
                founder multisig.
              </li>
            </ul>
            <div className="vw-qual-foot">
              Checked on-chain, post-payment. Fails the check &rarr; no proof is
              created and no DEV badge is awarded. The payment is held and
              you&apos;re notified to{" "}
              <strong>contact support for a manual refund</strong>.
            </div>
          </div>
        </div>

        <div className="vw-paths-foot">
          Pay $5 only if you know your deploy wallet qualifies. Not anyone with
          a token in their bio is a dev.
        </div>

        {/* THE FLOW */}
        <div className="section-title" style={{ marginTop: 60 }}>
          THE FLOW
        </div>
        <h2 className="section-h2">
          Six screens. Under a minute.{" "}
          <span className="orange">No wallet connect.</span>
        </h2>

        <div className="vw-flow">
          <div className="vw-step">
            <div className="vw-step-num">1</div>
            <div className="vw-step-body">
              <h5>Pick path</h5>
              <p>Collaborator ($1) or Dev ($5).</p>
            </div>
          </div>
          <div className="vw-step">
            <div className="vw-step-num">2</div>
            <div className="vw-step-body">
              <h5>Pick token</h5>
              <p>$LASTSHFT (40% off), SOL, or USDT.</p>
            </div>
          </div>
          <div className="vw-step">
            <div className="vw-step-num">3</div>
            <div className="vw-step-body">
              <h5>Send the payment</h5>
              <p>
                Copy the treasury address and exact amount, send from{" "}
                <strong>any Solana wallet you control</strong> — Phantom,
                Solflare, Backpack, hardware wallet, even an exchange
                withdrawal.{" "}
                <em>
                  The wallet you send from becomes your verifier identity on the
                  proof.
                </em>
              </p>
            </div>
          </div>
          <div className="vw-step">
            <div className="vw-step-num">4</div>
            <div className="vw-step-body">
              <h5>Paste the signature</h5>
              <p>
                Paste the transaction signature, add an optional comment (140
                chars). The signature is your proof of payment.
              </p>
            </div>
          </div>
          <div className="vw-step vw-step-verify">
            <div className="vw-step-num">5</div>
            <div className="vw-step-body">
              <h5>We verify and finalize</h5>
              <p>
                Helius detects your transaction within seconds. The backend
                extracts the sender wallet from the on-chain data, runs the
                safety checks, and writes the proof permanently. If anything
                fails, you see why.
              </p>
              <button
                type="button"
                className="vw-step-toggle"
                aria-expanded={showFlowDetails}
                onClick={() => setShowFlowDetails((v) => !v)}
              >
                {showFlowDetails ? "▾" : "▸"} See the checks we run
              </button>
              {showFlowDetails && (
                <ul className="vw-checks">
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>REAL-TIME DETECTION</strong>
                      <span>
                        Helius webhook · 1–5 sec. Cron fallback · 60 sec.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>SENDER EXTRACTION</strong>
                      <span>
                        Verifier identity pulled from on-chain{" "}
                        <code>accountKeys[0]</code> — not from anything you
                        typed.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>ANTI-REPLAY</strong>
                      <span>
                        TX timestamp must be after the modal opened. Old
                        signatures rejected silently.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>SELF-PROOF GUARD</strong>
                      <span>
                        Sender wallet ≠ profile owner. Operators can&rsquo;t pay
                        themselves.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>UNIQUENESS</strong>
                      <span>
                        One wallet · one verification per work item.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="vw-check-mark">✓</span>
                    <div>
                      <strong>DEV QUALIFICATION</strong>
                      <span>
                        Dev path only — <code>token-dev-verify</code> runs
                        against the extracted sender. Fail = no proof inserted,
                        payment held for manual refund via support.
                      </span>
                    </div>
                  </li>
                </ul>
              )}
            </div>
          </div>
          <div className="vw-step">
            <div className="vw-step-num">6</div>
            <div className="vw-step-body">
              <h5>Permanent receipt</h5>
              <p>
                Proof writes to the database, profile reloads, Solscan link goes
                live. <strong>Once it&rsquo;s there, it&rsquo;s there.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* CALLOUT */}
        <div className="callout" style={{ marginTop: 40 }}>
          <div className="callout-text">
            Web3 hiring runs on private DMs. Vouches don&rsquo;t survive the
            next launch.{" "}
            <strong>
              Proofs do — and every $LASTSHFT spent verifying gets burned.
            </strong>
          </div>
          <div className="callout-ctas">
            <Link className="btn btn-ghost btn-sm" href="/grid">
              &gt; BROWSE OPERATORS
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA STRIP ═══ */}
      <div className="cta-strip">
        <div className="cta-eyebrow">
          {mode === "dev"
            ? "HIRE WITH PROOF  //  NO MORE DM ROULETTE"
            : mode === "op"
            ? "BUILD PROOF  //  ON-CHAIN. PERMANENT. YOURS."
            : "VERIFY THIS WORK  //  PERMANENT. PUBLIC. YOURS."}
        </div>
        <h3>
          {mode === "dev" ? (
            <>
              Stop paying strangers.{" "}
              <span className="green">Start hiring history.</span>
            </>
          ) : mode === "op" ? (
            <>
              Stop shilling yourself.{" "}
              <span className="orange">Start stacking on-chain proof.</span>
            </>
          ) : (
            <>
              Worked with someone good?{" "}
              <span className="orange">Put it on-chain.</span>
            </>
          )}
        </h3>
        <p>
          {mode === "dev" ? (
            <>
              Browse every verified operator on the Grid, filter by tier, proof
              count, and DEV badges — or let SHIFTBOT do it for you.
            </>
          ) : mode === "op" ? (
            <>
              Claim{" "}
              <span
                style={{
                  color: "var(--orange)",
                  fontFamily: "var(--mono)",
                }}
              >
                lastproof.app/@you
              </span>{" "}
              — your wallet-locked handle. Collect on-chain receipts from devs
              and collaborators. Let SHIFTBOT surface you to projects hiring
              right now.
            </>
          ) : (
            <>
              No login. No wallet connect. Open the operator&rsquo;s profile,
              click <strong>VERIFY THIS WORK</strong> on any job, and back the
              claim with a paid Solana TX. Permanent. Public. Yours forever.
            </>
          )}
        </p>
        <div className="hero-ctas">
          {mode === "dev" ? (
            <>
              <Link className="btn btn-primary green" href="/grid">
                &gt; SCAN GRID
              </Link>
              <Link className="btn btn-ghost" href="/manage">
                &gt; BUILD YOUR PROFILE
              </Link>
            </>
          ) : mode === "op" ? (
            <>
              <Link className="btn btn-primary" href="/manage">
                &gt; BUILD YOUR PROFILE
              </Link>
              <Link className="btn btn-ghost" href="/grid">
                &gt; SCAN GRID
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" href="/grid">
                &gt; BROWSE OPERATORS
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
