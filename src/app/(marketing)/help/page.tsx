"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "./help.css";

/**
 * /help — LASTPROOF help center.
 *
 * Source: wireframes/help.html + wireframes/help-CONTENT.md.
 * NOT the same thing as /how-it-works (which is the marketing explainer).
 * Topbar, Footer, and ShiftbotStrip come from the (marketing) layout.
 *
 * 6 tabs — only the active one renders. Hash sync via replaceState so
 * users can deep-link (#profile-creation, #faq, etc.). FAQ tab has a
 * substring search that filters + auto-opens matches.
 */

type TabId =
  | "profile-creation"
  | "verify-work"
  | "updating-profile"
  | "profile-status"
  | "faq"
  | "contact";

const VALID_TABS: TabId[] = [
  "profile-creation",
  "verify-work",
  "updating-profile",
  "profile-status",
  "faq",
  "contact",
];

const TAB_LABELS: Record<TabId, { num: string; label: string }> = {
  "profile-creation": { num: "01", label: "Profile Creation" },
  "verify-work": { num: "02", label: "Verify Work" },
  "updating-profile": { num: "03", label: "Updating Profile" },
  "profile-status": { num: "04", label: "Profile Status" },
  faq: { num: "05", label: "FAQ" },
  contact: { num: "06", label: "Contact" },
};

// ─── FAQ data ────────────────────────────────────────────────────────────────
type FaqEntry = {
  q: string;
  a: React.ReactNode;
  searchText: string;
  defaultOpen?: boolean;
  id?: string;
};

const FAQS: FaqEntry[] = [
  {
    q: "I don't have a Terminal ID. How do I get one?",
    defaultOpen: true,
    searchText:
      "terminal id get one how lastshift.app connect wallet 30 seconds email password kyc",
    a: (
      <>
        <p>
          Head to <strong>lastshift.app</strong> (the Terminal) and connect your Solana
          wallet. It auto-generates your Terminal ID in about 30 seconds — no email, no
          password, no KYC. Save the key, then come back here.
        </p>
        <a
          href="https://lastshift.app"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          LAUNCH TERMINAL →
        </a>
      </>
    ),
  },
  {
    q: "Why are there two websites? Why can't I just sign up on LASTPROOF?",
    defaultOpen: true,
    searchText:
      "two websites sign up lastproof microsoft office word one identity many tools terminal suite",
    a: (
      <p>
        Because LASTPROOF is one tool in a bigger suite. Same reason you don&apos;t sign
        up for Microsoft Word directly — you sign into Microsoft&apos;s system (Office
        365), which gives you access to Word, Excel, PowerPoint. One identity, many
        tools. The Terminal is our Office 365. LASTPROOF is our Word.
      </p>
    ),
  },
  {
    q: "What's a Terminal ID, exactly?",
    defaultOpen: true,
    searchText:
      "terminal id format license key xxxx windows product paste authenticate lastshift suite",
    a: (
      <p>
        A license key formatted{" "}
        <span className="mono help-orange">XXXX-XXXX-XXXX-XXXX-XXXX</span>. Think of it
        like a Windows product key. Paste it into each tool once to register, then it
        authenticates you automatically. One key works for every tool in the LASTSHIFT
        suite.
      </p>
    ),
  },
  {
    q: "Is it free?",
    searchText:
      "free cost pay subscription lastproof first 5000 early access grid launch 10 month lastshft proofs",
    a: (
      <p>
        Getting your Terminal ID is <strong>free</strong>. LASTPROOF: during the First
        5,000 early-access campaign, your profile is{" "}
        <strong>free until 30 days after the Grid launches</strong> (2026-06-07). After
        that it&apos;s $10/mo ($6 in $LASTSHFT). Proofs cost $1 (paid by the verifier),
        DEV proofs $5.
      </p>
    ),
  },
  {
    q: "I connected my wallet but the page says \"Operator not found in local registry.\"",
    searchText:
      "operator not found local registry wallet connected terminal id manage error no registry match",
    a: (
      <>
        <div className="help-shot help-shot-inline" aria-hidden="true">
          <div className="help-browser-chrome">
            <div className="help-browser-dots">
              <span className="help-browser-dot" />
              <span className="help-browser-dot" />
              <span className="help-browser-dot" />
            </div>
            <div className="help-browser-url">lastproof.app/manage</div>
          </div>
          <div className="help-shot-placeholder">
            <div className="help-shot-icon">⚠</div>
            <div className="help-shot-src">/manage error state</div>
            <div className="help-dim mono" style={{ fontSize: "10px" }}>
              [NO REGISTRY MATCH]
            </div>
          </div>
          <div className="help-shot-caption">The exact error you&apos;re looking at.</div>
        </div>
        <p>That means your wallet hasn&apos;t been registered with a Terminal ID yet.</p>
        <ol>
          <li>
            Go to <strong>lastshift.app</strong>, connect the same wallet, get your
            Terminal ID.
          </li>
          <li>Come back here and paste your Terminal ID.</li>
        </ol>
      </>
    ),
  },
  {
    q: "Can I use a different wallet to pay than the one I use to log in?",
    searchText:
      "different wallet pay log in terminal identity tool wallet burner treasury",
    a: (
      <p>
        Yes. Your Terminal wallet is your identity — it&apos;s how we know it&apos;s
        you. When paying for subscriptions, proofs, or handle changes, you can pay from
        ANY wallet. Burner, treasury, whatever. Tools care about: valid Terminal ID +
        any wallet sending a valid transaction.
      </p>
    ),
  },
  {
    q: "I regenerated my Terminal ID in the Terminal. Now LASTPROOF rejects my old key.",
    searchText:
      "regenerated terminal id rejects old key revoke invalidate compromised new",
    a: (
      <p>
        That&apos;s by design. Regenerating invalidates your old key{" "}
        <strong>instantly across all tools</strong> — it&apos;s how you revoke a
        compromised key. Paste the new Terminal ID on /manage to re-authenticate.
      </p>
    ),
  },
  {
    q: "I lost my Terminal ID. Can I recover it?",
    searchText:
      "lost terminal id recover wallet identity custody dashboard connect same",
    a: (
      <p>
        Connect the same wallet at lastshift.app — the Terminal dashboard shows your
        current ID. If you&apos;ve lost the wallet too, you can&apos;t recover — your
        wallet is your identity. Standard web3 custody.
      </p>
    ),
  },
  {
    q: "What wallets are supported?",
    searchText: "wallets supported phantom solflare backpack",
    a: <p>Phantom, Solflare, and Backpack. More coming.</p>,
  },
  {
    q: "What's the difference between a Proof and a DEV Proof?",
    searchText:
      "proof dev proof difference collaborator $1 $5 deployer wallet badge trust signal cryptographic",
    a: (
      <ul>
        <li>
          <strong>Proof ($1)</strong> — any collaborator, teammate, or community
          member vouches for your work on-chain.
        </li>
        <li>
          <strong>DEV Proof ($5)</strong> — a project&apos;s{" "}
          <strong>deployer wallet</strong> vouches for you. Cryptographically proven.
          Earns the DEV badge — the strongest trust signal.
        </li>
      </ul>
    ),
  },
  {
    q: "Can I proof myself?",
    searchText:
      "proof myself self self-proof blocked system paying wallet terminal rejected lose payment",
    a: (
      <p>
        No. Self-proofing is blocked — the system compares the paying wallet against
        the profile&apos;s Terminal wallet. If they match, you lose the payment and no
        proof is awarded. Proofs only have meaning because someone ELSE vouches for
        you.
      </p>
    ),
  },
  {
    q: "Do I need to connect my wallet to submit a proof?",
    searchText:
      "connect wallet submit proof v3 wallet-free paste-verify signing popups phantom solflare backpack",
    a: (
      <p>
        <strong>No.</strong> As of V3 (shipped April 2026), proofs are wallet-free.
        Open your Solana wallet (Phantom, Solflare, Backpack), send the exact amount to
        the address shown, paste the transaction signature into the modal, done. No
        wallet connect popups, no signing prompts on lastproof.app.
      </p>
    ),
  },
  {
    q: "How long does proof verification take?",
    searchText:
      "proof verification take time helius webhook 1-5 seconds cron fallback 60 seconds",
    a: (
      <p>
        <strong className="help-green">1–5 seconds</strong> in the normal case via the
        Helius webhook. If the webhook is slow, a cron fallback picks it up within 60
        seconds. No refresh needed — the modal updates itself.
      </p>
    ),
  },
  {
    id: "faq-payment-stuck",
    q: "I sent the payment but nothing happened. What went wrong?",
    searchText:
      "sent payment nothing happened wrong amount token tx modal self-proof duplicate wallet work item",
    a: (
      <>
        <p>Most common causes:</p>
        <ul>
          <li>
            <strong>Wrong amount.</strong> Must be exact to the cent. $1.00 not $1.01.
          </li>
          <li>
            <strong>Wrong token.</strong> Only $LASTSHFT, SOL, or USDT. USDC not
            supported.
          </li>
          <li>
            <strong>TX before modal opened.</strong> Anti-scam protection — TX must be
            timestamped AFTER you opened the proof modal.
          </li>
          <li>
            <strong>Self-proof.</strong> Paid from the profile owner&apos;s own
            Terminal wallet — auto-rejected.
          </li>
          <li>
            <strong>Duplicate.</strong> Already proofed this work item with this wallet
            (1 wallet = 1 proof per work item).
          </li>
        </ul>
        <p>If none apply, DM support with the transaction signature.</p>
      </>
    ),
  },
  {
    q: "I picked \"Dev\" but I'm not the deployer — what happens?",
    searchText:
      "dev proof not deployer lose payment wallet on-chain no refund qualification check",
    a: (
      <p>
        You lose the payment. The post-payment check compares the sending wallet
        against the project&apos;s actual deployer wallet on-chain. No match = no
        proof, no refund. Only pick Dev if you&apos;re actually the deployer.
      </p>
    ),
  },
  {
    q: "I'm on Android and Phantom keeps opening LASTPROOF inside its in-app browser — I'm stuck.",
    searchText:
      "android phantom in-app browser iab stuck mobile paste-verify v3 wallet switch",
    a: (
      <>
        <p>
          Known Phantom-on-Android issue.{" "}
          <strong>The V3 paste-verify flow is designed to work around it.</strong>
        </p>
        <ol>
          <li>
            In Phantom&apos;s browser, open the proof modal and copy the destination
            address + exact amount.
          </li>
          <li>Switch to the Phantom wallet view and send from there.</li>
          <li>Copy the TX signature.</li>
          <li>Return to the LASTPROOF tab, paste the signature. Done.</li>
        </ol>
        <p>Works even inside the Phantom IAB.</p>
      </>
    ),
  },
  {
    q: "I approved a payment in Phantom but now it says \"blockhash expired.\"",
    searchText:
      "blockhash expired phantom payment approve slow solana 60 90 seconds never sent not charged",
    a: (
      <>
        <p>
          Solana transactions have a ~60–90 second window before the blockhash expires.
          If you took too long to approve, the blockhash died and the broadcast failed.
          The <strong>transaction was never sent</strong> — you weren&apos;t charged.
        </p>
        <p>
          <strong>Fix:</strong> close the modal and start over. Be quick when approving.
        </p>
      </>
    ),
  },
  {
    q: "Phantom says \"This dApp could be malicious\" when I try to pay. Should I panic?",
    searchText:
      "phantom malicious dapp warning cosmetic verified domain list safe proceed",
    a: (
      <p>
        No. Cosmetic warning Phantom shows for any domain not on their verified-domain
        list. Doesn&apos;t mean anything is wrong — we haven&apos;t submitted for
        verification yet. Safe to proceed.
      </p>
    ),
  },
  {
    q: "I sent the wrong token or wrong amount. What now?",
    searchText:
      "wrong token amount sent usdc not supported treasury funds refund credit dm support signature",
    a: (
      <ul>
        <li>
          <strong>Wrong amount:</strong> must be exact to the cent. Mismatch = no
          proof credited. <strong>Funds aren&apos;t lost</strong> — DM support with
          the TX signature, we manually credit or refund.
        </li>
        <li>
          <strong>Wrong token:</strong> USDC isn&apos;t supported. Same deal — DM
          support. Don&apos;t resend a second TX hoping it&apos;ll work; open a ticket
          first.
        </li>
      </ul>
    ),
  },
  {
    q: "I don't see LASTPROOF in my Terminal dashboard — the \"LAUNCH LASTPROOF\" button is missing.",
    searchText:
      "lastproof missing terminal dashboard launch button sidebar reconnect provisioning",
    a: (
      <p>
        Refresh once. If still missing, your wallet may not have completed Terminal ID
        issuance. Disconnect and reconnect at lastshift.app — triggers re-provisioning.
        Still missing? Contact support with your wallet address (first 4 + last 4).
      </p>
    ),
  },
  {
    q: "My profile shows \"DEFUNCT.\" What does that mean?",
    searchText:
      "defunct profile 90 days no login paid liveness flag ban data handle bio proofs intact reactivate",
    a: (
      <p>
        You haven&apos;t paid AND haven&apos;t logged in for 90+ days. Liveness flag —
        not a ban. Data, handle, bio, past proofs all intact. Log into /manage (pulls
        back to FREE), then upgrade to return to ACTIVE PAID.
      </p>
    ),
  },
  {
    q: "My First 5,000 profile just expired and dropped to FREE. Can I get my tier back?",
    searchText:
      "first 5000 expired free tier back pay subscription lastshft reactivate proof count reset",
    a: (
      <p>
        Yes. Pay the subscription ($10/mo or $6 in $LASTSHFT) from /manage — everything
        comes back instantly. Proof count never resets, only its visibility.
      </p>
    ),
  },
  {
    q: "When exactly does my First 5,000 free window end?",
    searchText:
      "first 5000 free window end date 2026 06 07 grid launch 30 days clock starts claim",
    a: (
      <p>
        <strong>2026-06-07</strong> — 30 days after Grid launch (2026-05-08). The clock
        starts at Grid launch, <strong>NOT</strong> at claim time. Whether you claimed
        in February or the day before launch, you get 30 days from May 8.
      </p>
    ),
  },
  {
    q: "I got a Telegram message from @LastShiftAuthBot about my profile expiring. Is this real?",
    searchText:
      "telegram lastshiftauthbot profile expiring real reminder 3 days ea window banner",
    a: (
      <p>
        Yes. 3 days before your EA free window closes, we send a reminder via{" "}
        <span className="mono">@LastShiftAuthBot</span>. If you have a Telegram handle
        on your profile, it goes there. If not, we can only nudge via the in-app
        banner. <strong>Add a Telegram handle now</strong> if you want the reminder.
      </p>
    ),
  },
  {
    q: "Why does my free profile look so empty compared to others?",
    searchText:
      "free profile empty look stripped tier proofs hire button dev badge grid visibility upgrade",
    a: (
      <p>
        Free profiles are deliberately stripped-down to encourage upgrading. Only
        identity shows — no tier, no proofs, no HIRE button, no DEV badge, no Grid
        visibility. It&apos;s the free tier. Upgrade to unlock everything — existing
        data renders fully again.
      </p>
    ),
  },
  {
    q: "I was on ACTIVE PAID but now I'm FREE. What happened?",
    searchText:
      "active paid free subscription expired lapsed system flip billing manual renew",
    a: (
      <p>
        Subscription expired. System checks daily for lapsed subscriptions and flips
        them to FREE. You weren&apos;t charged again — billing is manual (pay-to-extend,
        not auto-renew). Renew from /manage; features return.
      </p>
    ),
  },
  {
    q: "What's $LASTSHFT and do I need it?",
    searchText:
      "lastshft token need ecosystem native sol usdt 40 off discount burn supply",
    a: (
      <p>
        $LASTSHFT is the ecosystem&apos;s native token. You don&apos;t <em>need</em>{" "}
        it — SOL and USDT work too. But paying with $LASTSHFT gets you{" "}
        <strong className="help-orange">40% off</strong> everything (subscription,
        proofs, handle change, mint). 25% of every transaction is permanently burned.
      </p>
    ),
  },
  {
    q: "Why don't you accept USDC?",
    searchText: "usdc not supported accept sol usdt lastshft intentional",
    a: (
      <p>
        We support SOL, USDT, and $LASTSHFT. USDC is intentionally not supported at
        this time.
      </p>
    ),
  },
  {
    q: "Do you store my wallet's private keys? My email?",
    searchText:
      "private keys email store wallet signing app servers collected identifiers handle profile metadata",
    a: (
      <p>
        <strong>No.</strong> We never see your private keys — wallet signing happens in
        your wallet app, not our servers. No email collected by default. Your handle
        and profile metadata are the only identifiers we store.
      </p>
    ),
  },
  {
    q: "What if I just want to browse profiles, not create one?",
    searchText:
      "browse profiles not create grid free click hire no login account fees",
    a: (
      <p>
        You don&apos;t need a Terminal ID. The Grid (launching May 2026) is{" "}
        <strong>free to browse</strong>. Click profiles, click Hire on anyone — no
        login, no account, no fees.
      </p>
    ),
  },
  {
    q: "How do I hire someone?",
    searchText:
      "hire someone profile button telegram dm no platform fee middleman connection",
    a: (
      <p>
        On any profile, click <strong>Hire</strong>. Sends a DM directly to the
        operator&apos;s Telegram. No platform fee on the connection.
      </p>
    ),
  },
  {
    q: "Is my profile permanent if I stop paying?",
    searchText:
      "profile permanent stop paying url handle bio photo proofs tier dev badge grid visibility deleted",
    a: (
      <p>
        URL, handle, bio, photo stay. But proofs, tier, DEV badge, and Grid visibility
        go dark until you reactivate. Data is never deleted.
      </p>
    ),
  },
  {
    q: "Can I change my handle?",
    searchText:
      "change handle manage flow paid $100 sol usdt $60 lastshft 40 off old released pool 30 days",
    a: (
      <p>
        Yes. Handle Change flow in /manage. $100 in SOL/USDT or{" "}
        <strong className="help-orange">$60 in $LASTSHFT</strong> (40% off). Old handle
        released back to the pool after 30 days.
      </p>
    ),
  },
];

// FAQ JSON-LD — narrower subset (top 6) for SEO
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "I don't have a Terminal ID. How do I get one?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Head to lastshift.app (the Terminal) and connect your Solana wallet. It auto-generates your Terminal ID in about 30 seconds — no email, no password, no KYC.",
      },
    },
    {
      "@type": "Question",
      name: "Why are there two websites?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LASTPROOF is one tool in a bigger suite. Like Microsoft Word inside Office 365. You sign into the Terminal (lastshift.app) which gives you access to LASTPROOF and other tools. One identity, many tools.",
      },
    },
    {
      "@type": "Question",
      name: "What's a Terminal ID?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A license key formatted XXXX-XXXX-XXXX-XXXX-XXXX. Like a Windows product key. Paste it into each tool once to register, then it authenticates you automatically. One key works for every tool in the LASTSHIFT suite.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to connect my wallet to submit a proof?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Proofs are wallet-free. You open your Solana wallet, send the exact amount to the address shown, paste the transaction signature into the modal, and you're done.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between a Proof and a DEV Proof?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A standard Proof costs $1 and can be submitted by any collaborator. A DEV Proof costs $5 and can only be submitted by a project's deployer wallet — cryptographically proven. DEV Proofs earn the DEV badge.",
      },
    },
    {
      "@type": "Question",
      name: "My profile shows DEFUNCT. What does that mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You haven't paid AND haven't logged in for 90+ days. It's a liveness flag, not a ban. Your data, handle, bio, and past proofs are all intact. Log into /manage to return to FREE state, then upgrade to return to ACTIVE PAID.",
      },
    },
  ],
};

// ─── Shot component ───────────────────────────────────────────────────────────
// When `image` + `alt` are supplied, renders a real Next.js <Image> inside the
// browser-chrome frame. Falls back to the styled placeholder when they're not —
// so partial capture completion ships cleanly at any point.
function Shot({
  url,
  src,
  icon,
  note,
  caption,
  className,
  image,
  alt,
  priority,
}: {
  url: string;
  src: string;
  icon: string;
  note?: string;
  caption: string;
  className?: string;
  /** Path to a /public/help/*.webp asset. When present, renders a real image. */
  image?: string;
  /** Required (and meaningful) whenever `image` is set. */
  alt?: string;
  /** true for above-the-fold shots — disables lazy loading for those. */
  priority?: boolean;
}) {
  // Real image branch — used once captures land in /public/help/
  if (image) {
    return (
      <div className={`help-shot help-shot-real ${className ?? ""}`}>
        <div className="help-browser-chrome">
          <div className="help-browser-dots">
            <span className="help-browser-dot" />
            <span className="help-browser-dot" />
            <span className="help-browser-dot" />
          </div>
          <div className="help-browser-url">{url}</div>
        </div>
        <Image
          src={image}
          alt={alt ?? ""}
          fill
          priority={priority}
          sizes="(max-width: 900px) 100vw, 340px"
          className="help-shot-img"
        />
        <div className="help-shot-caption">{caption}</div>
      </div>
    );
  }

  // Placeholder branch — unchanged from original
  return (
    <div className={`help-shot ${className ?? ""}`}>
      <div className="help-browser-chrome">
        <div className="help-browser-dots">
          <span className="help-browser-dot" />
          <span className="help-browser-dot" />
          <span className="help-browser-dot" />
        </div>
        <div className="help-browser-url">{url}</div>
      </div>
      <div className="help-shot-placeholder">
        <div className="help-shot-icon">{icon}</div>
        <div className="help-shot-src">{src}</div>
        {note ? (
          <div className="help-dim mono" style={{ fontSize: "10px" }}>
            {note}
          </div>
        ) : null}
      </div>
      <div className="help-shot-caption">{caption}</div>
    </div>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────
export default function HelpPage() {
  const [tab, setTab] = useState<TabId>("profile-creation");
  const [query, setQuery] = useState("");
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const didInitialHashSync = useRef(false);

  // Hash sync — initial load + hashchange listener
  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.replace("#", "") as TabId;
      if (VALID_TABS.includes(hash)) setTab(hash);
    };
    if (!didInitialHashSync.current) {
      syncFromHash();
      didInitialHashSync.current = true;
    }
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const activate = useCallback((t: TabId, opts: { scroll?: boolean } = {}) => {
    setTab(t);
    if (typeof window === "undefined") return;
    try {
      window.history.replaceState(null, "", `#${t}`);
    } catch {
      // replaceState can fail in some sandboxed iframes; non-fatal
    }
    if (opts.scroll !== false && tabBarRef.current) {
      const y = tabBarRef.current.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, []);

  const onTabKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next =
        e.key === "ArrowRight"
          ? (idx + 1) % VALID_TABS.length
          : (idx - 1 + VALID_TABS.length) % VALID_TABS.length;
      const nextTab = VALID_TABS[next];
      activate(nextTab);
      // Focus the button that just became active
      requestAnimationFrame(() => {
        const btn = document.querySelector<HTMLButtonElement>(
          `button[data-tab="${nextTab}"]`,
        );
        btn?.focus();
      });
    }
  };

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) => f.q.toLowerCase().includes(q) || f.searchText.includes(q),
    );
  }, [query]);

  const searchActive = query.trim().length > 0;

  return (
    <div className="help-page">
      {/* ═══ HERO ═══ */}
      <section className="help-hero">
        <div className="help-hero-eyebrow">HELP CENTER</div>
        <h1>
          Getting unstuck on LAST<span className="help-orange">PROOF</span>.
        </h1>
        <p className="help-body-text">
          Profile creation, proofs, editing, and profile states — pick a topic below to
          see exactly what to do.
        </p>
      </section>

      {/* ═══ QUICK ANSWERS ═══ */}
      <section className="help-quick-answers">
        <h2>QUICK ANSWERS — TOP 3 BLOCKERS</h2>
        <div className="help-qa-list">
          <div className="help-qa-item">
            <div className="help-qa-q">I don&apos;t have a Terminal ID.</div>
            <div className="help-qa-a">
              Go to{" "}
              <a href="https://lastshift.app" target="_blank" rel="noopener noreferrer">
                lastshift.app
              </a>
              , connect your wallet, and the Terminal issues one in ~30 seconds. Then
              come back here.
            </div>
          </div>
          <div className="help-qa-item">
            <div className="help-qa-q">
              My wallet connected, but the page says &quot;Operator not found.&quot;
            </div>
            <div className="help-qa-a">
              That wallet hasn&apos;t been registered with a Terminal ID yet. Get one
              from the Terminal (same link above), then paste it on /manage.
            </div>
          </div>
          <div className="help-qa-item">
            <div className="help-qa-q">I sent a payment but nothing happened.</div>
            <div className="help-qa-a">
              See the{" "}
              <button
                type="button"
                className="help-linklike"
                onClick={() => activate("faq")}
              >
                FAQ tab
              </button>{" "}
              (payment-stuck section) — common causes: wrong amount (must be exact),
              wrong token (no USDC), TX sent before modal opened.
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TAB BAR ═══ */}
      <nav
        className="help-tab-bar"
        role="tablist"
        aria-label="Help topics"
        ref={tabBarRef}
      >
        {VALID_TABS.map((t, idx) => {
          const { num, label } = TAB_LABELS[t];
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`help-panel-${t}`}
              data-tab={t}
              className={`help-tab ${active ? "is-active" : ""}`}
              onClick={() => activate(t)}
              onKeyDown={(e) => onTabKey(e, idx)}
              tabIndex={active ? 0 : -1}
            >
              <span className="help-tab-num">{num}</span>
              <span className="help-tab-lbl">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ═══ TAB: PROFILE CREATION ═══ */}
      <section
        id="help-panel-profile-creation"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-creation"
        hidden={tab !== "profile-creation"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">TOPIC 01 · 5 STEPS · ~5 MINUTES</div>
          <h2 className="help-panel-title">Profile Creation</h2>
          <p className="help-panel-intro">
            The full flow for a brand-new operator — from zero to a live @handle
            profile. No email, no password, just a wallet. Every step has a screenshot
            so you know exactly what to expect.
          </p>
        </div>

        {/* Stack analogy */}
        <div className="help-sec-label">WHY THE TERMINAL FIRST?</div>
        <p className="help-dim">
          If you&apos;ve used Microsoft products, you already understand this.
        </p>
        <div className="help-stack-compare">
          <div className="help-stack-heads">
            <div className="help-stack-col-head">Microsoft stack</div>
            <div />
            <div className="help-stack-col-head help-stack-col-head-ls">
              LASTSHIFT stack
            </div>
          </div>
          {[
            {
              tier: "COMPANY",
              msName: "Microsoft",
              msDesc: "The parent company",
              lsName: "LASTSHIFT.AI",
              lsDesc: "The company / ecosystem",
            },
            {
              tier: "PRODUCT SUITE",
              msName: "Office 365",
              msDesc: "The product suite",
              lsName: "LASTSHIFT TERMINAL",
              lsDesc: "The product suite",
            },
            {
              tier: "ONE TOOL",
              msName: "Word",
              msDesc: "One tool in the suite",
              lsName: "LASTPROOF",
              lsDesc: "One tool in the suite",
            },
            {
              tier: "CURRENCY",
              msName: "USD",
              msDesc: "How you pay",
              lsName: "$LASTSHFT",
              lsDesc: (
                <>
                  How you pay — <span className="help-green">40% off</span>
                </>
              ) as React.ReactNode,
            },
          ].map((r) => (
            <div className="help-stack-row" key={r.tier}>
              <div className="help-stack-tier">{r.tier}</div>
              <div className="help-stack-side help-stack-ms">
                <div className="help-stack-name">{r.msName}</div>
                <div className="help-stack-desc">{r.msDesc}</div>
              </div>
              <div className="help-stack-arrow" aria-hidden="true">
                →
              </div>
              <div className="help-stack-side help-stack-ls">
                <div className="help-stack-name">{r.lsName}</div>
                <div className="help-stack-desc">{r.lsDesc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="help-stack-quick">
          <span className="help-orange">
            LASTSHIFT.AI → LASTSHIFT TERMINAL → LASTPROOF
          </span>
          <br />
          <span className="help-dim">
            Same pattern as Microsoft → Office 365 → Word. The Terminal issues your
            license key (Terminal ID) — every tool uses the same key.
          </span>
        </div>

        {/* Terminal ID explainer */}
        <div className="help-sec-label">YOUR TERMINAL ID — THE KEY TO EVERYTHING</div>
        <div className="help-tid-display">XXXX-XXXX-XXXX-XXXX-XXXX</div>
        <p>
          Your Terminal ID is a license key issued by the Terminal at{" "}
          <span className="mono help-orange">lastshift.app</span>. It looks like a
          Windows product key. One key. Every tool.
        </p>
        <ul className="help-tid-bullets">
          <li>
            <span className="help-chk">✓</span> Issued once — free, wallet-only, takes
            30 seconds
          </li>
          <li>
            <span className="help-chk">✓</span> Works across every tool in the suite
            (LASTPROOF, and more coming)
          </li>
          <li>
            <span className="help-chk">✓</span> Regenerate anytime from the Terminal —
            old key instantly revoked
          </li>
        </ul>

        {/* 5 steps */}
        <div className="help-sec-label">STEP-BY-STEP — 2 MINUTES</div>

        <article className="help-step">
          <Shot
            url="lastshift.app"
            src="wireframes/screen1-launch-terminal.html"
            icon="▦"
            note="cold-boot · CONNECT WALLET"
            caption="lastshift.app — click CONNECT WALLET"
          />
          <div>
            <div className="help-step-num">STEP 01</div>
            <h3 className="help-step-title">Open the Terminal</h3>
            <div className="help-step-copy">
              <p>
                Go to <strong>lastshift.app</strong>. That&apos;s the suite. Click
                CONNECT WALLET. Phantom, Solflare, Backpack — any Solana wallet.
              </p>
              <a
                href="https://lastshift.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                LAUNCH TERMINAL →
              </a>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="lastshift.app/keygen"
            src="wireframes/screen2-key-generation.html"
            icon="⌨"
            note="XXXX-XXXX-XXXX-XXXX-XXXX"
            caption="Your Terminal ID. One key. Every tool."
          />
          <div>
            <div className="help-step-num">STEP 02</div>
            <h3 className="help-step-title">Receive your Terminal ID</h3>
            <div className="help-step-copy">
              <p>
                The Terminal generates a unique{" "}
                <span className="mono help-orange">XXXX-XXXX-XXXX-XXXX-XXXX</span> key.
                Save it — this is your license for every tool.
              </p>
              <div className="help-step-tip">
                <b>TIP:</b> Write it down, store it in a password manager, or keep it
                in a note. You&apos;ll need it once per tool, then it&apos;s automatic.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="lastshift.app/dashboard"
            src="wireframes/screen3-dashboard.html"
            icon="▥"
            note="LAUNCH LASTPROOF highlighted"
            caption="Terminal dashboard — click LAUNCH LASTPROOF in the sidebar."
          />
          <div>
            <div className="help-step-num">STEP 03</div>
            <h3 className="help-step-title">Launch LASTPROOF from the Terminal</h3>
            <div className="help-step-copy">
              <p>
                From the Terminal dashboard, click <strong>LAUNCH LASTPROOF</strong>.
                It opens lastproof.app in a new tab.
              </p>
              <div className="help-step-note">
                <b>NOTE:</b> The Terminal stays alive in its own tab — don&apos;t close
                it. Each tool has its own tab and its own session.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="lastproof.app/manage"
            src="wireframes/lastproof-onboarding.html + lastproof-dashboard-fresh.html"
            icon="▤"
            note="paste TID → claim @handle"
            caption="Paste your Terminal ID → claim your @handle."
            image="/help/t1-step-04-register-profile.png"
            alt="Register profile — paste your Terminal ID and claim your @handle"
            priority
          />
          <div>
            <div className="help-step-num">STEP 04</div>
            <h3 className="help-step-title">Register your profile on LASTPROOF</h3>
            <div className="help-step-copy">
              <p>
                On lastproof.app, paste your Terminal ID to authenticate. Pick your{" "}
                <strong>@handle</strong> (becomes your public URL:{" "}
                <span className="mono help-orange">lastproof.app/@you</span>). Add your
                bio, categories, and work history.
              </p>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="lastproof.app/@cryptomark"
            src="wireframes/lastproof-profile-public.html"
            icon="◉"
            note="public profile · shareable"
            caption="lastproof.app/@you — your on-chain resume. Drop it in any DM."
            image="/help/t1-step-05-public-profile.png"
            alt="Public profile — your on-chain resume, shareable link"
            priority
          />
          <div>
            <div className="help-step-num">STEP 05</div>
            <h3 className="help-step-title">Share your link and collect proofs</h3>
            <div className="help-step-copy">
              <p>
                Drop <span className="mono help-orange">lastproof.app/@you</span> in
                DMs, bios, proposals. Teammates and devs pay $1 ($5 for DEV) to verify
                your work on-chain. Your tier grows. Projects find you on the Grid.
              </p>
              <div className="help-step-note">
                <b>&gt;</b> Proofs are submitted BY SOMEONE ELSE for your work —
                you can&apos;t proof yourself. Share your link; they click VERIFY THIS
                WORK on a specific project. See the{" "}
                <button
                  type="button"
                  className="help-linklike"
                  onClick={() => activate("verify-work")}
                >
                  Verify Work tab
                </button>{" "}
                for the full proof flow.
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ═══ TAB: VERIFY WORK ═══ */}
      <section
        id="help-panel-verify-work"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="verify-work"
        hidden={tab !== "verify-work"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">TOPIC 02 · 6 STEPS · ~2 MIN PER PROOF</div>
          <h2 className="help-panel-title">Verify This Work (Proofs)</h2>
          <p className="help-panel-intro">
            Proofs are the heart of LASTPROOF. This covers both sides: how to submit a
            proof on someone else&apos;s work, and how to get proofs on your own
            profile.
          </p>
        </div>

        <div className="help-callout help-callout-dim">
          Proofs are paid on-chain transactions on Solana. When you submit one,
          you&apos;re publicly saying &quot;this person actually did this work&quot; —
          and the $1 ($5 for dev) fee makes the signal meaningful. Your proof gets
          linked to Solscan permanently. Fake proofs cost real money, so the system
          self-filters.
        </div>

        <div className="help-sec-label">HOW TO SUBMIT A PROOF — 6 STEPS</div>

        <article className="help-step">
          <Shot
            url="lastproof.app/@handle"
            src="wireframes/lastproof-profile-public.html"
            icon="◑"
            note="Proof of Work · VERIFY THIS WORK"
            caption="VERIFY THIS WORK — click the project you're vouching for."
            image="/help/t2-step-01-profile-verify-button.png"
            alt="VERIFY THIS WORK button on a project card"
          />
          <div>
            <div className="help-step-num">STEP 01</div>
            <h3 className="help-step-title">Find the work you want to vouch for</h3>
            <div className="help-step-copy">
              <p>
                Visit the operator&apos;s profile (
                <span className="mono help-orange">lastproof.app/@handle</span>). Scroll
                to Proof of Work. Find the project or campaign you worked on with them.
                Click <strong>VERIFY THIS WORK</strong> on that project card.
              </p>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="proof modal · screen 1"
            src="wireframes/lastproof-proof-modal-v2.html"
            icon="▦"
            note="Collaborator · Dev"
            caption="Two paths — Collaborator ($1) or Dev ($5)."
            image="/help/t2-step-02-modal-path-select.png"
            alt="Proof modal — choose Collaborator or Dev path"
          />
          <div>
            <div className="help-step-num">STEP 02</div>
            <h3 className="help-step-title">Pick your path: Collaborator or Dev</h3>
            <div className="help-step-copy">
              <ul>
                <li>
                  <strong>Collaborator — $1</strong> — teammates, community, anyone
                  who can vouch for the work.
                </li>
                <li>
                  <strong>Dev — $5</strong> — reserved for project deployer wallets.
                  Earns the operator a DEV badge.
                </li>
              </ul>
              <div className="help-step-warn">
                <b>WARNING:</b> The Dev path is verified against the project&apos;s
                actual deployer wallet on-chain. Picking Dev without being the real
                deployer = you lose the payment, no proof awarded. The system checks.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="proof modal · screen 2"
            src="wireframes/lastproof-proof-modal-v2.html"
            icon="◈"
            note="$LASTSHFT · SOL · USDT"
            caption="Pay with $LASTSHFT (40% off), SOL, or USDT. USDC not accepted."
            image="/help/t2-step-03-modal-token-select.png"
            alt="Proof modal — select payment token"
          />
          <div>
            <div className="help-step-num">STEP 03</div>
            <h3 className="help-step-title">Pick your token</h3>
            <div className="help-step-copy">
              <ul>
                <li>
                  <strong className="help-orange">$LASTSHFT</strong> — 40% off.
                  Cheapest path. Contributes to the 25% burn.
                </li>
                <li>
                  <strong>SOL</strong> — full price.
                </li>
                <li>
                  <strong>USDT</strong> — full price.
                </li>
              </ul>
              <div className="help-step-note">
                <b>NOTE:</b> USDC is not supported. Check your wallet has one of the 3
                tokens before starting.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="proof modal · screen 3"
            src="wireframes/lastproof-proof-modal-v2.html"
            icon="⎘"
            note="copy address · copy amount"
            caption="Copy address. Copy exact amount. Send from your wallet."
            image="/help/t2-step-04-modal-send.png"
            alt="Proof modal — copy address and exact amount to send"
          />
          <div>
            <div className="help-step-num">STEP 04</div>
            <h3 className="help-step-title">
              Copy the address + exact amount, then send
            </h3>
            <div className="help-step-copy">
              <p>
                The modal shows the destination address (copy button), the exact amount
                in your chosen token (copy button), and instructions to open your
                wallet and send that exact amount to that address.
              </p>
              <div className="help-step-note">
                <b>IMPORTANT:</b> Amount must be EXACT. $1.00 not $1.01. The webhook
                matches on the cent. Wrong amount = not credited.
              </div>
              <div className="help-step-tip">
                <b>ANTI-SCAM:</b> Transaction must happen AFTER you open this modal.
                Old transactions don&apos;t count — prevents scammers from reusing a
                paid TX for multiple proofs.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="proof modal · screen 4"
            src="wireframes/lastproof-proof-modal-v2.html"
            icon="▣"
            note="paste TX · 140-char comment"
            caption="Paste your TX signature. Add an optional 140-char comment."
            image="/help/t2-step-05-modal-paste.png"
            alt="Proof modal — paste TX signature and add optional comment"
          />
          <div>
            <div className="help-step-num">STEP 05</div>
            <h3 className="help-step-title">
              Paste the TX signature + add a comment
            </h3>
            <div className="help-step-copy">
              <ol>
                <li>Copy the transaction signature from your wallet.</li>
                <li>Paste it into the modal.</li>
                <li>
                  Add a short comment (optional, up to 140 chars) — e.g.
                  &quot;@kellen ran our Tier 1 raid team for 6 months. Real
                  one.&quot;
                </li>
              </ol>
              <div className="help-step-tip">
                <b>TIP:</b> Comments build social proof. Proofs with personalized
                comments hit harder than blank ones.
              </div>
            </div>
          </div>
        </article>

        <article className="help-step">
          <Shot
            url="proof modal · screen 5"
            src="wireframes/lastproof-proof-modal-v2.html"
            icon="✓"
            note="cascade · receipt · solscan"
            caption="1–5 second verification via Helius. Then the receipt."
          />
          <div>
            <div className="help-step-num">STEP 06</div>
            <h3 className="help-step-title">Watch it verify + see the receipt</h3>
            <div className="help-step-copy">
              <p>
                Backend verifies in <strong className="help-green">1–5 seconds</strong>{" "}
                via the Helius webhook. You&apos;ll see a terminal-style cascade of
                checks, then a receipt screen with a Solscan link. Reload the profile
                page — your proof is now permanent.
              </p>
              <div className="help-step-tip">
                <b>FALLBACK:</b> If the Helius webhook is slow or fails, a cron job
                picks it up within 60 seconds. No refresh loop — the modal handles it.
              </div>
            </div>
          </div>
        </article>

        {/* COLLECTING PROOFS */}
        <div className="help-sec-label">
          HOW TO GET PROOFS ON YOUR OWN PROFILE
        </div>
        <p className="help-dim">
          You can&apos;t proof yourself. Here&apos;s how to actually collect them.
        </p>
        <div className="help-card-grid">
          {[
            {
              eyebrow: "TACTIC 1",
              title: "Share after every project",
              body: (
                <>
                  When a project wraps, send the project lead your{" "}
                  <span className="mono help-orange">lastproof.app/@you</span> link with:
                  &quot;Would mean a lot if you dropped a proof on my @handle for the
                  [project] work.&quot; Most devs say yes if you ask.
                </>
              ),
            },
            {
              eyebrow: "TACTIC 2",
              title: "Target Dev Proofs ($5)",
              body: (
                <>
                  DEV Proofs come from the project&apos;s actual deployer wallet — the
                  strongest trust signal. One DEV Proof is worth 10 regular proofs in
                  credibility. It&apos;s also the only way to earn the DEV badge.
                </>
              ),
            },
            {
              eyebrow: "TACTIC 3",
              title: "Batch the ask",
              body: (
                <>
                  Hit 5–10 past collaborators in one week, not spread out. Profile goes
                  0 → 5 proofs fast, which pushes you past TIER 1 to TIER 2 in momentum.
                  Profiles with momentum convert teams better.
                </>
              ),
            },
            {
              eyebrow: "TACTIC 4",
              title: "Be specific about which project",
              body: (
                <>
                  Don&apos;t send &quot;hey proof me.&quot; Send: &quot;Can you drop a
                  proof on the $BONK raid campaign from Aug 2024?{" "}
                  <span className="mono help-orange">lastproof.app/@you</span>, scroll
                  to Proof of Work, the card says $BONK Raid Commander.&quot; Lower
                  the friction.
                </>
              ),
            },
          ].map((t) => (
            <div className="help-mini-card" key={t.eyebrow}>
              <div className="help-card-eyebrow">{t.eyebrow}</div>
              <h4>{t.title}</h4>
              <p>{t.body}</p>
            </div>
          ))}
        </div>

        <div className="help-callout help-callout-green">
          <span className="help-prefix">&gt;</span>
          Proofs are social capital. The cost to the other person ($1–$5) is the
          feature, not a bug — it proves they actually mean it.
        </div>
      </section>

      {/* ═══ TAB: UPDATING PROFILE ═══ */}
      <section
        id="help-panel-updating-profile"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="updating-profile"
        hidden={tab !== "updating-profile"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">TOPIC 03 · 8 SUB-TOPICS</div>
          <h2 className="help-panel-title">Updating My Profile</h2>
          <p className="help-panel-intro">
            Everything you can change about your profile after it&apos;s live — bio,
            work items, screenshots, handle, verification, plan tier, and minted
            projects.
          </p>
        </div>

        <div className="help-callout help-callout-orange">
          <span className="help-prefix">&gt;</span>All profile editing happens on{" "}
          <span className="mono help-orange">lastproof.app/manage</span>. Log in with
          your Terminal ID first — then use the sections in the manage dashboard.
        </div>

        {[
          {
            num: "3.1",
            title: "Editing your bio, pitch, and categories",
            url: "/manage · bio",
            src: "lastproof-dashboard.html",
            icon: "✎",
            note: "inline edit",
            caption: "Click EDIT on any section to open the inline editor.",
            image: "/help/t3-step-01-dashboard-bio.png",
            alt: "Dashboard — editing bio, pitch, and categories",
            body: (
              <>
                <p>
                  Head to /manage. Your bio, pitch, and categories all live in the
                  main profile panel. Click EDIT next to any field to open the inline
                  editor. Changes save instantly — no separate &quot;save&quot;
                  button.
                </p>
                <ul>
                  <li>
                    <strong>Bio:</strong> 240 chars
                  </li>
                  <li>
                    <strong>Pitch:</strong> 500 chars
                  </li>
                  <li>
                    <strong>Categories:</strong> pick up to 3 from the preset list (X
                    Growth, Raid Leading, Community Mgmt, Dev, Design, Content)
                  </li>
                </ul>
                <div className="help-step-tip">
                  <b>TIP:</b> Your pitch is what shows on your profile card on the
                  Grid. Treat it like an elevator pitch — 2 sentences max, lead with
                  the most impressive number.
                </div>
              </>
            ),
          },
          {
            num: "3.2",
            title: "Adding and editing work items",
            url: "/manage · work items",
            src: "lastproof-dashboard.html",
            icon: "▢",
            note: "+ ADD WORK ITEM",
            caption: "Work items are the projects proofs attach to.",
            image: "/help/t3-step-02-dashboard-work.png",
            alt: "Dashboard — add and edit work items",
            body: (
              <>
                <p>
                  Work items are individual projects or campaigns. Each gets its own
                  card with title, role, period, description, and a VERIFY THIS WORK
                  button that collaborators click to proof you.
                </p>
                <ol>
                  <li>
                    In /manage, scroll to &quot;Proof of Work&quot; and click{" "}
                    <strong>+ ADD WORK ITEM</strong>.
                  </li>
                  <li>
                    Fill in: ticker/project name, role, start + end dates, description
                    (280 chars).
                  </li>
                  <li>Save.</li>
                  <li>
                    Card appears on your public profile immediately, ready to collect
                    proofs.
                  </li>
                </ol>
                <div className="help-step-warn">
                  <b>IMPORTANT:</b> Work items with at least one proof are LOCKED —
                  you can&apos;t edit or delete them. This protects what proofers
                  vouched for. Plan the title/role/description before the first proof
                  lands.
                </div>
              </>
            ),
          },
          {
            num: "3.3",
            title: "Uploading screenshots",
            url: "/manage · screenshots",
            src: "lastproof-dashboard.html",
            icon: "⊞",
            note: "JPG/PNG · max 5MB",
            caption: "Drop JPG/PNG. Max 5MB per file.",
            image: "/help/t3-step-03-dashboard-screenshots.png",
            alt: "Dashboard — upload screenshots section",
            body: (
              <>
                <p>
                  Screenshots are visual proof — analytics dashboards, raid results,
                  campaign metrics. Upload from the &quot;Screenshots&quot; section of
                  /manage.
                </p>
                <ul>
                  <li>Up to 10 screenshots per profile</li>
                  <li>JPG or PNG, max 5MB each</li>
                  <li>Caption optional (120 chars)</li>
                </ul>
                <div className="help-step-warn">
                  <b>TIP:</b> Anonymize sensitive data before uploading — redact wallet
                  addresses, DMs, anything private. Screenshots are public.
                </div>
              </>
            ),
          },
          {
            num: "3.4",
            title: "Adding links (X, Telegram, LinkedIn, website)",
            url: "/manage · links",
            src: "lastproof-dashboard.html",
            icon: "⎔",
            note: "up to 5 links",
            caption: "Add up to 5 links. X and Telegram can be verified.",
            image: "/help/t3-step-04-dashboard-links.png",
            alt: "Dashboard — add links including X, Telegram, and more",
            body: (
              <>
                <p>
                  Links appear on your public profile as clickable icons. Add them
                  from the &quot;Links&quot; section of /manage.
                </p>
                <ul>
                  <li>X / Twitter (verifiable → adds badge)</li>
                  <li>Telegram (verifiable → adds badge)</li>
                  <li>LinkedIn</li>
                  <li>Personal website</li>
                  <li>GitHub</li>
                  <li>Additional link (custom label)</li>
                </ul>
                <p className="help-dim">Max: 5 links total.</p>
              </>
            ),
          },
          {
            num: "3.5",
            title: "Changing your @handle",
            url: "/manage · handle change",
            src: "handle-change-modal",
            icon: "↻",
            note: "$100 or $60 $LASTSHFT",
            caption: "Your handle is your public URL. Changing it is paid.",
            image: "/help/t3-step-05-handle-change.png",
            alt: "Handle change modal — check availability and pay to switch",
            body: (
              <>
                <p>
                  Your @handle is the permanent URL for your profile (
                  <span className="mono help-orange">lastproof.app/@you</span>).
                  Changing it is paid — to prevent squatting and keep old links
                  meaningful.
                </p>
                <ol>
                  <li>In /manage, go to Profile Settings → Change Handle.</li>
                  <li>Check availability of the new handle.</li>
                  <li>Pay via the 3-token paste-verify flow.</li>
                  <li>New handle activates immediately.</li>
                </ol>
                <div className="help-callout help-callout-orange" style={{ marginTop: 10 }}>
                  <strong>Cost:</strong> $100 in SOL or USDT, or{" "}
                  <strong className="help-orange">$60 in $LASTSHFT</strong> (40% off —
                  same discount applies across the whole platform).
                </div>
                <ul>
                  <li>
                    Old handle held in reserve for <strong>30 days</strong>, then
                    released back to the pool
                  </li>
                  <li>Old URL redirects to the new one during that window</li>
                  <li>
                    Proofs, tier, DEV badge carry over — only the URL changes
                  </li>
                </ul>
              </>
            ),
          },
          {
            num: "3.6",
            title: "Verifying X and Telegram",
            url: "/manage · verify X + TG",
            src: "lastproof-profile-public.html",
            icon: "✓",
            note: "verification badge",
            caption: "Green checkmark on your profile = verified identity.",
            image: "/help/t3-step-06-verify-social.png",
            alt: "Profile with green verification badge after X and Telegram verified",
            body: (
              <>
                <p>
                  Verifying your X and Telegram earns the Verification Badge — a green
                  checkmark on your public profile. Optional but adds credibility.
                </p>
                <p>
                  <strong>X:</strong> add X link in /manage → click VERIFY → post
                  pre-formatted tweet (we provide text + one-time token) → click
                  &quot;I&apos;ve posted it.&quot; Badge applies.
                </p>
                <p>
                  <strong>Telegram:</strong> add TG handle → click VERIFY → DM{" "}
                  <span className="mono help-orange">@LastShiftAuthBot</span> (sends
                  code) → paste code back in /manage. Badge applies.
                </p>
                <div className="help-step-tip">
                  <b>NOTE:</b> Both verifications needed for the full badge. One of
                  two = partial badge.
                </div>
              </>
            ),
          },
          {
            num: "3.7",
            title: "Upgrading to paid / reactivating",
            url: "/manage · upgrade",
            src: "lastproof-upgrade-modal.html",
            icon: "↑",
            note: "$10/mo · $6 $LASTSHFT",
            caption: "Paid tier unlocks Grid visibility, tier progression, DEV badge.",
            image: "/help/t3-step-07-upgrade.png",
            alt: "Upgrade modal — pay $10/mo or $6 in $LASTSHFT to unlock full profile",
            body: (
              <>
                <p>
                  Free profiles are limited — not findable on the Grid, no tier, no DEV
                  badge, no proofs visible publicly. Upgrade to paid ($10/mo or $6 in
                  $LASTSHFT) to unlock the full profile.
                </p>
                <ol>
                  <li>In /manage, click UPGRADE.</li>
                  <li>Pick a token ($LASTSHFT 40% off, SOL, or USDT).</li>
                  <li>Same paste-verify flow as proofs.</li>
                  <li>Upgrade activates in 1–5 seconds via the Helius webhook.</li>
                </ol>
                <div className="help-callout help-callout-green">
                  <strong>First 5,000 note:</strong> if you&apos;re in the EA
                  campaign, your profile is free until 30 days after Grid launch
                  (2026-06-07). Telegram reminder 3 days before auto-conversion.
                </div>
                <p>
                  <strong>Reactivating:</strong> same flow. Pay, features come back
                  instantly.
                </p>
              </>
            ),
          },
          {
            num: "3.8",
            title: "Minting projects (paid — pin your best work)",
            url: "/manage · mint",
            src: "lastproof-mint-modal.html",
            icon: "◈",
            note: "$1 · MINTED badge",
            caption: "Minted projects pin to the top of your profile.",
            image: "/help/t3-step-08-mint.png",
            alt: "Mint modal — pay $1 to pin a work item to the top of your profile",
            body: (
              <>
                <p>
                  Minted projects are your portfolio&apos;s greatest hits. Pinned to
                  the top of your Proof of Work section, separate from recent work.
                  Marked with a gold MINTED badge.
                </p>
                <p>
                  <strong>Cost:</strong> $1 per mint, same 3-token paste-verify flow.
                </p>
                <ol>
                  <li>In /manage → Proof of Work, find the work item.</li>
                  <li>Click MINT on that card.</li>
                  <li>Pay in the Mint modal.</li>
                  <li>Item gets the MINTED badge, pins to top.</li>
                </ol>
                <div className="help-step-tip">
                  <b>NOTE:</b> Minting is additive — doesn&apos;t change the
                  underlying work item or its proofs. Pure curation — &quot;I&apos;m
                  proud of this one.&quot;
                </div>
              </>
            ),
          },
        ].map((s) => (
          <article className="help-sub-topic" key={s.num}>
            <div className="help-sub-topic-grid">
              <Shot
                url={s.url}
                src={s.src}
                icon={s.icon}
                note={s.note}
                caption={s.caption}
                image={s.image}
                alt={s.alt}
              />
              <div>
                <h4>
                  <span className="help-sub-num">{s.num}</span>
                  {s.title}
                </h4>
                <div className="help-sub-topic-copy">{s.body}</div>
              </div>
            </div>
          </article>
        ))}

        {/* Two wallets explainer */}
        <div className="help-sec-label">TWO WALLETS? HERE&apos;S WHY</div>
        <p className="help-dim">
          When paying for any of the above, you can use a different wallet than your
          identity wallet.
        </p>
        <div className="help-card-grid">
          <div className="help-mini-card">
            <div className="help-card-eyebrow">TERMINAL WALLET · YOUR IDENTITY</div>
            <h4>The wallet you connect to lastshift.app</h4>
            <p>
              One Terminal ID per wallet. Use the wallet you&apos;re comfortable being
              recognized by.
            </p>
          </div>
          <div className="help-mini-card">
            <div className="help-card-eyebrow">TOOL WALLET · WHO PAYS</div>
            <h4>Any wallet you want to pay from</h4>
            <p>
              When paying for subscriptions, mints, or handle changes, you can pay
              from ANY wallet. Burner, treasury, whatever. Tools care about: valid
              Terminal ID + any wallet sending a valid TX.
            </p>
          </div>
        </div>
        <div className="help-callout help-callout-dim">
          <span className="help-prefix">&gt;</span>The wallet gets you into the
          Terminal. The Terminal ID gets you into each tool. The tool wallet is just
          who&apos;s paying.
        </div>
      </section>

      {/* ═══ TAB: PROFILE STATUS ═══ */}
      <section
        id="help-panel-profile-status"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-status"
        hidden={tab !== "profile-status"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">
            TOPIC 04 · 4 STATES · QUICK REFERENCE
          </div>
          <h2 className="help-panel-title">Profile Status</h2>
          <p className="help-panel-intro">
            Your LASTPROOF profile lives in one of four states. Each has different
            rules — what shows publicly, what you can edit, what you pay, and how to
            move between states.
          </p>
        </div>

        <div className="help-sec-label">STATUS AT A GLANCE</div>
        <div className="help-state-glance">
          <pre>
{`STATE              COLOR        ON PROFILE CARD         PAYING?
─────────────      ────────     ───────────────         ────────
`}
            <span className="help-c-green">ACTIVE PAID</span>
{`        `}
            <span className="help-c-green">green</span>
{`        "ACTIVE" pill           yes — $10/mo (or $6 in $LASTSHFT)
`}
            <span className="help-c-gold">FIRST 5,000 (EA)</span>
{`   `}
            <span className="help-c-gold">gold</span>
{`         "EA" ribbon + pill      not yet — free until 30d post-Grid
`}
            <span className="help-c-silver">FREE</span>
{`               `}
            <span className="help-c-silver">silver</span>
{`       "FREE" pill             no — profile is view-limited
`}
            <span className="help-c-red">DEFUNCT</span>
{`            `}
            <span className="help-c-red">red</span>
{`          "DEFUNCT" pill          no — 90+ days no payment / activity`}
          </pre>
        </div>
        <p className="help-dim" style={{ marginTop: 10 }}>
          ACTIVE PAID and FIRST 5,000 render the full profile. FREE and DEFUNCT render
          stripped-down versions. Upgrading brings everything back instantly — your
          data is never deleted.
        </p>

        {/* ACTIVE PAID */}
        <div className="help-state-card help-state-active-paid">
          <span className="help-state-badge help-state-badge-active-paid">
            ACTIVE PAID
          </span>
          <h3>Active Paid</h3>
          <div className="help-state-grid">
            <Shot
              url="lastproof.app/@you"
              src="lastproof-profile-public.html"
              icon="◉"
              note="full profile"
              caption="Everything on. This is what the Grid sees."
              image="/help/t4-active-paid-profile.png"
              alt="Active Paid profile — full profile with tier badge, proofs, and hire button"
            />
            <div className="help-state-details">
              <p className="help-what-means">
                <strong className="help-green">What it means:</strong> On a paid
                subscription in good standing. $10/mo or $6 in $LASTSHFT. Full feature
                access.
              </p>
              <h5>What shows publicly</h5>
              <ul>
                <li>Full profile: avatar, handle, bio, pitch, categories</li>
                <li>Tier badge (TIER 1–4 based on proof count)</li>
                <li>HIRE button — sends DM to your Telegram</li>
                <li>All work items + attached proofs, DEV badge if any</li>
                <li>Screenshots, links, verification badge</li>
                <li>Grid visibility post-launch (May 2026)</li>
              </ul>
              <h5>What you can do</h5>
              <ul>
                <li>Edit everything in /manage</li>
                <li>Receive proofs ($1 standard, $5 DEV)</li>
                <li>Change handle ($100 or $60 $LASTSHFT)</li>
                <li>Mint projects ($1 each)</li>
                <li>Verify X + Telegram</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>Get here:</strong> pay via /manage → UPGRADE PROFILE, or get
                credited during First 5,000.
                <br />
                <strong>Leave:</strong> stop paying → lapses to FREE; 90+ days no login
                → drops to DEFUNCT.
              </p>
            </div>
          </div>
        </div>

        {/* FIRST 5,000 */}
        <div className="help-state-card help-state-ea">
          <span className="help-state-badge help-state-badge-ea">
            FIRST 5,000 · EA
          </span>
          <h3>First 5,000 (Early Access)</h3>
          <div className="help-state-grid">
            <Shot
              url="lastproof.app/@you"
              src="lastproof-profile-5000.html"
              icon="★"
              note="gold ribbon + countdown"
              caption="Full profile + gold early-access ribbon + countdown."
              image="/help/t4-first-5000-profile.png"
              alt="First 5,000 EA profile — gold ribbon and countdown to conversion"
            />
            <div className="help-state-details">
              <p className="help-what-means">
                <strong className="help-gold">What it means:</strong> You claimed a
                spot before the Grid launched. Full Active Paid features — free until
                30 days after Grid launch (2026-06-07).
              </p>
              <h5>What shows publicly</h5>
              <ul>
                <li>Everything ACTIVE PAID shows, plus:</li>
                <li>Gold EA ribbon / badge</li>
                <li>
                  FOMO countdown timer (post Grid-launch) showing days until
                  auto-conversion
                </li>
              </ul>
              <div className="help-callout help-callout-red" style={{ marginTop: 10 }}>
                <span className="help-prefix">&gt;</span>
                <strong>Timing:</strong> the 30-day free window starts at{" "}
                <strong>GRID LAUNCH (2026-05-08)</strong>, not at claim time. If you
                claimed 2026-05-01, your window is &quot;May 8 → June 7,&quot; not
                &quot;May 1 → May 31.&quot; 30 days from launch day, always.
              </div>
              <div className="help-callout help-callout-orange">
                <span className="help-prefix">&gt;</span>3 days before your EA window
                closes, we send a Telegram reminder via{" "}
                <span className="mono">@LastShiftAuthBot</span>. Add a Telegram handle
                so we can reach you.
              </div>
              <p>
                <strong>Leave:</strong> don&apos;t pay by 2026-06-07 → drops to FREE.
                URL, handle, bio stay. Proofs + tier + DEV badge + Grid visibility go
                dark until you reactivate.
              </p>
            </div>
          </div>
        </div>

        {/* FREE */}
        <div className="help-state-card help-state-free">
          <span className="help-state-badge help-state-badge-free">FREE</span>
          <h3>Free</h3>
          <div className="help-state-grid">
            <Shot
              url="lastproof.app/@you"
              src="lastproof-profile-free.html"
              icon="◌"
              note="stripped · identity only"
              caption="Identity only. No tier, no Hire button, no proofs visible."
              image="/help/t4-free-profile.png"
              alt="Free profile — identity only, tier and proofs hidden"
            />
            <div className="help-state-details">
              <p className="help-what-means">
                <strong className="help-dim">What it means:</strong> Profile exists but
                isn&apos;t paying. Never upgraded, or subscription lapsed (not in the
                EA window). View-limited publicly.
              </p>
              <h5>What shows publicly</h5>
              <ul>
                <li>Avatar, name, handle, bio, location/timezone, language</li>
                <li>
                  <strong>Hidden:</strong> tier bar, HIRE button, proofs, DEV badge,
                  screenshots, links, verification badge, Grid visibility
                </li>
              </ul>
              <h5>What you can do in /manage</h5>
              <ul>
                <li>Edit bio, pitch, categories (always)</li>
                <li>GET VERIFIED is locked — no new proofs received</li>
                <li>Cannot change handle, mint, or receive proofs</li>
                <li>Can browse the Grid — just can&apos;t be found on it</li>
              </ul>
              <div className="help-callout help-callout-dim">
                <strong>Why &quot;GET VERIFIED&quot; is locked:</strong> the proof
                system only runs on a paid profile. Upgrade to unlock the whole proof
                side.
              </div>
              <p>
                <strong>Leave:</strong> /manage → UPGRADE PROFILE → pay. Hidden
                features return instantly.
              </p>
            </div>
          </div>
        </div>

        {/* DEFUNCT */}
        <div className="help-state-card help-state-defunct">
          <span className="help-state-badge help-state-badge-defunct">DEFUNCT</span>
          <h3>Defunct</h3>
          <div className="help-state-grid">
            <Shot
              url="lastproof.app/manage"
              src="lastproof-dashboard.html · .status-pill.defunct"
              icon="◎"
              note="red pill · 90+ days"
              caption={'Red "DEFUNCT" pill. 90+ days no payment + no login.'}
            />
            <div className="help-state-details">
              <p className="help-what-means">
                <strong className="help-red">What it means:</strong> No paid
                subscription AND no account activity for 90+ days. Profile is dormant.
              </p>
              <h5>What shows publicly</h5>
              <ul>
                <li>Same as FREE (identity only)</li>
                <li>
                  May display a dim &quot;DEFUNCT&quot; marker so visitors don&apos;t
                  waste Hire DMs on abandoned accounts
                </li>
              </ul>
              <h5>How to leave</h5>
              <ul>
                <li>
                  <strong>Log in</strong> — any /manage access pulls you back to FREE
                  automatically
                </li>
                <li>
                  <strong>Pay</strong> — jumps to ACTIVE PAID
                </li>
              </ul>
              <div className="help-callout help-callout-orange">
                <span className="help-prefix">&gt;</span>Defunct is a liveness signal,
                not a punishment. Profile, handle, bio, historic proofs — all intact.
                We never delete.
              </div>
            </div>
          </div>
        </div>

        {/* Transition diagram */}
        <div className="help-sec-label">STATE TRANSITIONS AT A GLANCE</div>
        <div className="help-transition-diagram">
          <pre>{`              [ new wallet ]
                    │
         connects via Terminal (lastshift.app)
                    │
                    ▼
              ┌─────────────┐
              │    FREE     │ ◄──── EA 30-day timer expires
              └─────────────┘       subscription lapses
                    │  ▲
        UPGRADE     │  │   stop paying / 90d no login
                    ▼  │
              ┌─────────────┐       ┌──────────────┐
              │ ACTIVE PAID │ ◄────►│ FIRST 5,000  │ ──── pay by 2026-06-07 ──► ACTIVE PAID
              └─────────────┘       │    (EA)      │ ──── don't pay ────────► FREE
                    │               └──────────────┘
         90+ days no login + no pay
                    │
                    ▼
              ┌─────────────┐
              │   DEFUNCT   │ ──── log in ──► FREE
              └─────────────┘ ──── upgrade ──► ACTIVE PAID`}</pre>
        </div>

        {/* Cost matrix */}
        <div className="help-sec-label">WHAT EACH STATE COSTS</div>
        <div className="help-cost-table-wrap">
          <table className="help-cost-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Subscription</th>
                <th>Handle change</th>
                <th>Proofs (paid by verifier)</th>
                <th>DEV proofs</th>
                <th>Mint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ACTIVE PAID</td>
                <td>$10/mo (SOL/USDT) or $6 $LASTSHFT</td>
                <td>$100 or $60 $LASTSHFT</td>
                <td>$1</td>
                <td>$5</td>
                <td>$1</td>
              </tr>
              <tr>
                <td>FIRST 5,000</td>
                <td>$0 until 2026-06-07, then $10/mo</td>
                <td>$100 or $60 $LASTSHFT</td>
                <td>$1</td>
                <td>$5</td>
                <td>$1</td>
              </tr>
              <tr>
                <td>FREE</td>
                <td>$0 (can&apos;t receive proofs)</td>
                <td>locked</td>
                <td>n/a</td>
                <td>n/a</td>
                <td>locked</td>
              </tr>
              <tr>
                <td>DEFUNCT</td>
                <td>$0 (reactivate to unlock)</td>
                <td>locked</td>
                <td>n/a</td>
                <td>n/a</td>
                <td>locked</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="help-callout help-callout-green">
          <span className="help-prefix">&gt;</span>$LASTSHFT gets you 40% off every
          paid action on the platform — subscription, handle change, mint, proof. Same
          discount everywhere.
        </div>

        {/* Tier × state */}
        <div className="help-sec-label">TIER × PROFILE STATE INTERACTION</div>
        <div className="help-callout help-callout-orange">
          <span className="help-prefix">&gt;</span>Tier is a function of (paid state) ×
          (proof count). A FREE profile with 100 proofs still has NO tier — it&apos;s
          hidden, not lost. Upgrade and it returns with the correct number based on
          current proof count.
        </div>
        <div className="help-tier-ladder">
          <pre>
            <span className="help-t1">
              TIER 1 · NEW{"          "}→ 0+ proofs silver
            </span>
            {"\n"}
            <span className="help-t2">
              TIER 2 · VERIFIED{"     "}→ 10+ proofs bronze
            </span>
            {"\n"}
            <span className="help-t3">
              TIER 3 · EXPERIENCED{"  "}→ 25+ proofs gold
            </span>
            {"\n"}
            <span className="help-t4">
              TIER 4 · LEGEND{"       "}→ 50+ proofs purple
            </span>
          </pre>
        </div>
        <p className="help-dim" style={{ marginTop: 10 }}>
          Tier is never shown as a bare number — always &quot;TIER N · NAME.&quot;
          Internally a Tier 5 sentinel means &quot;off the ladder&quot; (not paid / not
          published) — you&apos;ll never see it in UI.
        </p>
      </section>

      {/* ═══ TAB: FAQ ═══ */}
      <section
        id="help-panel-faq"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="faq"
        hidden={tab !== "faq"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">TOPIC 05 · {FAQS.length} QUESTIONS</div>
          <h2 className="help-panel-title">Frequently Asked Questions</h2>
          <p className="help-panel-intro">
            Quick answers to the most common questions across all topics. Click any
            question to expand.
          </p>
        </div>

        <div className="help-faq-search">
          <input
            type="search"
            placeholder={'Search questions... (e.g. "defunct", "wrong amount", "terminal id")'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search FAQ"
          />
        </div>

        <div className="help-faq-list">
          {filteredFaqs.length === 0 ? (
            <div className="help-faq-empty">
              <p>
                No match for <strong>&ldquo;{query}&rdquo;</strong>. Try a broader
                term, or{" "}
                <button
                  type="button"
                  className="help-linklike"
                  onClick={() => activate("contact")}
                >
                  jump to Contact
                </button>
                .
              </p>
            </div>
          ) : (
            filteredFaqs.map((f) => (
              <details
                key={f.q}
                className="help-faq"
                id={f.id}
                open={searchActive ? true : f.defaultOpen}
              >
                <summary>{f.q}</summary>
                <div className="help-faq-body">{f.a}</div>
              </details>
            ))
          )}
        </div>

        {filteredFaqs.length > 0 ? (
          <p
            className="help-dim"
            style={{ marginTop: 20, textAlign: "center" }}
          >
            Didn&apos;t find your answer? Try the{" "}
            <button
              type="button"
              className="help-linklike"
              onClick={() => activate("contact")}
            >
              Contact tab →
            </button>
          </p>
        ) : null}
      </section>

      {/* ═══ TAB: CONTACT ═══ */}
      <section
        id="help-panel-contact"
        className="help-tab-panel"
        role="tabpanel"
        aria-labelledby="contact"
        hidden={tab !== "contact"}
      >
        <div className="help-panel-head">
          <div className="help-panel-eyebrow">TOPIC 06 · STILL STUCK?</div>
          <h2 className="help-panel-title">Contact Support</h2>
          <p className="help-panel-intro">
            If the topics and FAQ above didn&apos;t unblock you, here&apos;s how to
            reach a real human.
          </p>
        </div>

        <div className="help-contact-hero">
          <div
            className="help-dim mono"
            style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}
          >
            Primary support channel
          </div>
          <div className="help-big-tg">@lastshiftcoinbreakroom</div>
          <p>
            Drop into the Telegram channel — active team + community. Real responses,
            usually within a few hours during work days.
          </p>
          <a
            href="https://t.me/lastshiftcoinbreakroom"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            OPEN TELEGRAM →
          </a>
        </div>

        <div className="help-contact-info-grid">
          <div className="help-info-card">
            <h4>WHAT TO INCLUDE IN YOUR MESSAGE</h4>
            <ul>
              <li>
                Your <strong>@handle</strong> (if you have one)
              </li>
              <li>
                First 4 + last 4 characters of your wallet address (e.g.{" "}
                <span className="mono">DFUZ...4axP</span>)
              </li>
              <li>TX signature if your issue is about a payment</li>
              <li>Screenshot of the problem if it&apos;s visual</li>
              <li>What you tried already</li>
            </ul>
          </div>
          <div className="help-info-card">
            <h4>NEVER SHARE</h4>
            <ul>
              <li>
                Your <strong>full wallet address</strong> (first4+last4 is enough for
                lookup)
              </li>
              <li>
                Your <strong>private key</strong> or{" "}
                <strong>seed phrase</strong> — no one on our team will ever ask
              </li>
              <li>
                Your full <strong>Terminal ID</strong> — we can help you without it
              </li>
            </ul>
          </div>
        </div>

        <div className="help-callout help-callout-red">
          <span className="help-prefix">&gt;</span>
          <strong>Scam alert:</strong> anyone claiming to be &quot;LASTPROOF
          support&quot; in your DMs asking for your seed phrase or private key is NOT
          us. Real support only happens inside the @lastshiftcoinbreakroom channel.
          Don&apos;t click unknown links; don&apos;t screen-share with strangers.
        </div>

        <div className="help-sec-label">READY TO KEEP GOING?</div>
        <div className="help-card-grid">
          <div
            className="help-mini-card"
            style={{ textAlign: "center", padding: 28 }}
          >
            <h4>Need a Terminal ID?</h4>
            <p>
              Start at the Terminal. Connect your wallet, get your key, come back. 30
              seconds.
            </p>
            <a
              href="https://lastshift.app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              LAUNCH TERMINAL →
            </a>
          </div>
          <div
            className="help-mini-card"
            style={{ textAlign: "center", padding: 28 }}
          >
            <h4>Already have your key?</h4>
            <p>
              Head to /manage, paste your Terminal ID, and start building your profile.
            </p>
            <Link href="/manage" className="btn btn-secondary">
              GO TO /MANAGE →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ JSON-LD for SEO */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
    </div>
  );
}
