import Link from "next/link";
import HomepageWallCard from "@/components/HomepageWallCard";
import { OPERATOR_CATEGORIES } from "@/lib/homepage-data";
import { getHomepageWallSample } from "@/lib/grid/grid-adapter";
// Reuses the canonical Grid card styles from /operators — single source
// of truth for `.g-card*` so homepage and Grid stay visually identical
// without duplication.
import "@/app/(marketing)/operators/operators.css";

/**
 * Page revalidates at most once per minute. Inside the 60s cache window
 * every render calls `getHomepageWallSample()` against the cached Grid
 * list, so visitors within the same minute see different random
 * selections — true per-visit variety at minimal DB cost (one query per
 * minute, not per visit).
 */
export const revalidate = 60;

/**
 * LASTPROOF homepage — mirrors wireframes/homepage.html section-for-section.
 * First-5000 popup shows on first visit after 1s delay (once per session).
 *
 * Wall section pulls real Grid-eligible operators from the live
 * `grid_operators` view via `getHomepageWallSample(8, 4)` — guarantees
 * at least 4 of the 8 cards have confirmed proofs. Cards render with
 * the canonical `<GridCard />` component (same one /operators uses) so
 * the visual stays consistent without a homepage-only adapter shape.
 */
export default async function HomePage() {
  const wallCards = await getHomepageWallSample(8, 4);

  // Homepage-only JSON-LD: SoftwareApplication (LASTPROOF as a tool) +
  // WebSite/SearchAction (so search engines surface a sitelinks search
  // box pointing at /operators?q=). Sitewide Organization schema lives
  // in src/app/layout.tsx — do NOT duplicate it here.
  const softwareAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LASTPROOF",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Web3 Operator Verification Platform",
    operatingSystem: "Web",
    url: "https://lastproof.app",
    description:
      "On-chain verified profiles for web3 operators. Hire community managers, KOLs, raid leaders, mods, and 12 other operator types backed by immutable Solana proofs of work. Requires a LASTSHIFT Terminal ID for full access.",
    image: "https://lastproof.app/og-image.png",
    screenshot: "https://lastproof.app/og-image.png",
    offers: [
      {
        "@type": "Offer",
        name: "Operator Profile",
        price: "10",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "10",
          priceCurrency: "USD",
          billingDuration: "P1M",
        },
        description:
          "Wallet-locked operator profile with unlimited proofs, tier ranking, and SHIFTBOT visibility. 40% off when paid in $LASTSHFT.",
      },
      {
        "@type": "Offer",
        name: "Collaborator Proof",
        price: "1",
        priceCurrency: "USD",
        description: "On-chain verification from a past collaborator",
      },
      {
        "@type": "Offer",
        name: "DEV Proof",
        price: "5",
        priceCurrency: "USD",
        description: "On-chain verification signed by a project deployer wallet",
      },
    ],
    featureList: [
      "Wallet-locked operator profiles",
      "On-chain proof of work verification on Solana",
      "DEV proofs from project deployers",
      "AI-ranked operator search via SHIFTBOT",
      "Public Grid directory",
      "Direct-to-Telegram hiring (no platform fees)",
      "Tier system based on verified proofs (Tier 1 New through Tier 4 Legend)",
      "15 operator categories",
    ],
    publisher: {
      "@type": "Organization",
      name: "LASTSHIFT.AI",
      url: "https://lastshift.ai",
    },
    isPartOf: {
      "@type": "WebApplication",
      name: "LASTSHIFT Terminal",
      url: "https://lastshift.app",
    },
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LASTPROOF",
    url: "https://lastproof.app",
    publisher: {
      "@type": "Organization",
      name: "LASTSHIFT.AI",
      url: "https://lastshift.ai",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://lastproof.app/operators?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* X (Twitter) Ads pixel temporarily REMOVED 2026-05-06.
          Google Safe Browsing flagged the homepage as "social engineering"
          on 2026-05-05. Multiple third-party trackers + auto-popup +
          urgency counter + wallet-ask copy stacked into the classic
          drainer-phishing fingerprint. Pulling the pixel during the
          review window removes one variable. Restore (re-add the
          <Script id="x-ads-pixel" ...> block from commit 7dd4be0) only
          after Google clears the site via Search Console review. */}

      <section className="hero">
        <div className="hero-eyebrow">
          THE GRID NOW OPEN&nbsp;&nbsp;//&nbsp;&nbsp;
          <a
            href="https://lastshift.ai"
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            LASTSHIFT.AI
          </a>
        </div>
        <h1>
          Discover <span className="green">Trusted Web3 Marketers</span>
          <br />
          on <span style={{ color: "#fff" }}>LAST</span>
          <span className="orange">PROOF</span>
        </h1>
        <div className="subline">
          ON-CHAIN VERIFIED&nbsp;&nbsp;//&nbsp;&nbsp;PROOF OF WORK&nbsp;&nbsp;//&nbsp;&nbsp;EARNED TRUST
        </div>
        <p className="body-text">
          Operators backed by real on-chain verifications. No screenshots. No trust-me
          DMs. Just proof.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" href="/grid">
            &gt; SCAN GRID
          </Link>
          <Link className="btn btn-green" href="/manage">
            &gt; GET FOUND
          </Link>
        </div>
        <span className="microcopy">
          Free to browse. Click Hire to message.
        </span>
      </section>

      <section className="cat-wrap">
        <div className="section-label">BROWSE BY OPERATOR TYPE</div>
        <div className="cats">
          {OPERATOR_CATEGORIES.map((c) => (
            <Link key={c} className="chip" href="/grid">
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section className="wall-wrap">
        <div className="wall-head">
          <div className="section-label" style={{ margin: 0 }}>
            LASTPROOF GRID — VIEW OPERATOR PROFILES
          </div>
          <Link className="reshuffle" href="/grid">RESHUFFLE</Link>
        </div>
        <div className="wall">
          {wallCards.map((card) => (
            <HomepageWallCard key={card.handle} card={card} />
          ))}
        </div>
        <div className="wall-foot">
          <Link href="/grid">ENTER THE GRID →</Link>
        </div>
      </section>

      <section className="sb-showcase">
        <div className="sb-inner">
          <div className="sb-logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-logo" />
          </div>
          <div className="sb-eyebrow">
            SHIFTBOT&nbsp;&nbsp;//&nbsp;&nbsp;AI-ASSISTED OPERATOR SEARCH
          </div>
          <h2>
            Don&rsquo;t know what you need? <span className="orange">Just ask.</span>
          </h2>
          <p>
            SHIFTBOT is the AI layer over the Grid. Tell it what your project needs and it
            surfaces verified operators — filtered, ranked, ready to hire.
          </p>
          <div className="sb-input">
            <span className="cursor">&gt;</span>
            <span className="ph">
              help me find a raider for my Solana launch next week...
            </span>
            <span className="go">ASK →</span>
          </div>
          <div className="sb-prompts">
            <div className="sb-prompt">help me find a raider</div>
            <div className="sb-prompt">who&rsquo;s the best X Spaces host?</div>
            <div className="sb-prompt">find a KOL under $500</div>
            <div className="sb-prompt">show verified community managers</div>
            <div className="sb-prompt">who can design my pitch deck?</div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how">
        <div className="section-label">HOW IT WORKS</div>
        <div className="how-grid">
          <div className="how-cell">
            <div className="how-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="num">STEP 01</div>
            <h3>Scan Grid</h3>
            <p>
              Search the Grid by category, tier, or proof count. No wallet, no signup, no
              friction.
            </p>
          </div>
          <div className="how-cell">
            <div className="how-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div className="num">STEP 02</div>
            <h3>Verify On-chain</h3>
            <p>
              Every operator&rsquo;s work is backed by paid on-chain proofs from devs and
              teammates. No screenshots.
            </p>
          </div>
          <div className="how-cell">
            <div className="how-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div className="num">STEP 03</div>
            <h3>Hire Direct</h3>
            <p>
              Click hire and the conversation lands in their Telegram. No middleman. No
              platform fees on the deal.
            </p>
          </div>
        </div>
      </section>

      <section className="closing">
        <h2>
          Stop trusting screenshots.
          <br />
          <span className="orange">Start trusting proof.</span>
        </h2>
        <p>
          EARLY ACCESS&nbsp;&nbsp;//&nbsp;&nbsp;FIRST 5,000 OPERATORS FREE
          FOREVER&nbsp;&nbsp;//&nbsp;&nbsp;THEN $10/MO
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" href="/grid">
            &gt; SCAN GRID
          </Link>
          <Link className="btn btn-green" href="/manage">
            &gt; GET FOUND
          </Link>
        </div>
      </section>

    </>
  );
}
