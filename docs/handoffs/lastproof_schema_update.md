# lastproof.app — Schema Update Plan

**Target site:** lastproof.app
**Source of truth:** LASTSHIFT_Brand_Entity_Reference.md v1.0
**Executor:** Claude Code
**Goal:** Fix existing schema inconsistencies, add missing schema for SoftwareApplication / FAQ / HowTo, and align identity references with canonical brand reference.

---

## Current State

Audit of existing markup (as fetched April 28, 2026):

- ✅ Organization schema present on all pages (basic level)
- ✅ BlogPosting + BreadcrumbList + FAQPage schema on blog posts
- ✅ ProfilePage + Person schema on `/@handle` pages
- ✅ RSS feed at `/blog/rss.xml`
- ✅ robots.txt clean, sitemap.xml live (64 URLs)
- ❌ **No `/llms.txt`** (returns 404)
- ❌ **`twitter:site` set to `@lastshft`** (incorrect handle — does not match canonical brand)
- ❌ **Organization `sameAs` references `@lastshft`** (incorrect handle)
- ❌ **No SoftwareApplication schema** on homepage or `/how-it-works`
- ❌ **No FAQPage schema on `/how-it-works`** (despite the page being structured as Q&A)
- ❌ **No HowTo schema on procedural blog posts**
- ❌ **Person schema for `@lastshiftfounder` is minimal** — missing canonical name "KT", missing sameAs links
- ❌ **No parent organization relationship** to LASTSHIFT.AI

**Bottom line:** Strong foundation, several factual errors that need fixing, several missing schema types that block LLM citation surface.

---

## File-by-File Schema Updates

This plan is organized by what needs to happen on which page/route. All JSON-LD blocks go inside `<script type="application/ld+json">` tags in the `<head>`.

> **Important:** Several updates are corrections to *existing* schema, not additions. Pay attention to which is which.

---

## 1. Identity Correction (Site-Wide)

### 1.1 — Fix `twitter:site` meta tag

**Locate every page** with `<meta name="twitter:site" content="@lastshft">`

**Replace with:**
```html
<meta name="twitter:site" content="@lastshiftai">
```

**Why:** `@lastshiftai` is the canonical X handle for LASTSHIFT.AI (the company that owns LASTPROOF). Product announcements flow from the company channel. `@lastshft` is not a real project handle.

### 1.2 — Update Organization schema `sameAs` array

**Locate every page** with the existing Organization JSON-LD that includes:
```json
"sameAs": ["https://x.com/lastshft", "https://t.me/lastshft"]
```

**Replace with:**
```json
"sameAs": [
  "https://lastshift.ai",
  "https://lastshiftcoin.com",
  "https://lastshift.app",
  "https://x.com/lastshiftai",
  "https://x.com/LASTSHIFTCOIN",
  "https://t.me/LastShiftCoin",
  "https://t.me/LastShiftCoinBreakroom"
]
```

**Why:** Lists every real public surface for the LASTSHIFT ecosystem. Drops the incorrect `@lastshft` references. Establishes LASTPROOF as part of a connected ecosystem rather than a standalone product.

---

## 2. Homepage (`/`)

### 2.1 — Replace existing Organization block

**Current:**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LASTPROOF",
  "url": "https://lastproof.app",
  "description": "...",
  "sameAs": ["https://x.com/lastshft", "https://t.me/lastshft"]
}
```

**Replace with:**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LASTPROOF",
  "url": "https://lastproof.app",
  "logo": "https://lastproof.app/shiftbot-logo.png",
  "description": "Web3 operator verification platform built on Solana. First tool in the LASTSHIFT Terminal ecosystem developed by LASTSHIFT.AI.",
  "parentOrganization": {
    "@type": "Organization",
    "name": "LASTSHIFT.AI",
    "url": "https://lastshift.ai",
    "description": "Pseudonymous software developer building the LASTSHIFT Terminal — an AI tool platform for web3 operators on Solana."
  },
  "sameAs": [
    "https://lastshift.ai",
    "https://lastshiftcoin.com",
    "https://lastshift.app",
    "https://x.com/lastshiftai",
    "https://x.com/LASTSHIFTCOIN",
    "https://t.me/LastShiftCoin",
    "https://t.me/LastShiftCoinBreakroom"
  ]
}
```

### 2.2 — Add SoftwareApplication schema (NEW)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "LASTPROOF",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Web3 Operator Verification Platform",
  "operatingSystem": "Web",
  "url": "https://lastproof.app",
  "description": "On-chain verified profiles for web3 operators. Hire community managers, KOLs, raid leaders, mods, and 12 other operator types backed by immutable Solana proofs of work. Requires a LASTSHIFT Terminal ID for full access.",
  "image": "https://lastproof.app/og-image.png",
  "screenshot": "https://lastproof.app/og-image.png",
  "offers": [
    {
      "@type": "Offer",
      "name": "Operator Profile",
      "price": "10",
      "priceCurrency": "USD",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "10",
        "priceCurrency": "USD",
        "billingDuration": "P1M"
      },
      "description": "Wallet-locked operator profile with unlimited proofs, tier ranking, and SHIFTBOT visibility. 40% off when paid in $LASTSHFT."
    },
    {
      "@type": "Offer",
      "name": "Collaborator Proof",
      "price": "1",
      "priceCurrency": "USD",
      "description": "On-chain verification from a past collaborator"
    },
    {
      "@type": "Offer",
      "name": "DEV Proof",
      "price": "5",
      "priceCurrency": "USD",
      "description": "On-chain verification signed by a project deployer wallet"
    }
  ],
  "featureList": [
    "Wallet-locked operator profiles",
    "On-chain proof of work verification on Solana",
    "DEV proofs from project deployers",
    "AI-ranked operator search via SHIFTBOT",
    "Public Grid directory",
    "Direct-to-Telegram hiring (no platform fees)",
    "Tier system based on verified proofs (Tier 1 New through Tier 4 Legend)",
    "16 operator categories"
  ],
  "publisher": {
    "@type": "Organization",
    "name": "LASTSHIFT.AI",
    "url": "https://lastshift.ai"
  },
  "isPartOf": {
    "@type": "WebApplication",
    "name": "LASTSHIFT Terminal",
    "url": "https://lastshift.app"
  }
}
```

### 2.3 — Add WebSite + SearchAction schema (NEW)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "LASTPROOF",
  "url": "https://lastproof.app",
  "publisher": {
    "@type": "Organization",
    "name": "LASTSHIFT.AI",
    "url": "https://lastshift.ai"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://lastproof.app/grid?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

> **Pre-req:** Confirm `/grid?q=X` actually performs a search. If the Grid uses different query parameters, adjust `urlTemplate` to match. If the Grid does not yet support URL-based search, omit this block until it does.

---

## 3. `/how-it-works` Page

### 3.1 — Replace Organization block (same correction as 2.1)

Use the corrected Organization schema from Section 2.1.

### 3.2 — Add FAQPage schema (NEW)

The how-it-works page already contains FAQ-style content (problems solved, signals, tier explanations, red flags, proof types). Wrap it in schema:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is LASTPROOF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "LASTPROOF is a verification platform for web3 operators built on Solana. Operators build wallet-locked profiles backed by paid on-chain proofs from past collaborators and project deployers. Devs and founders use The Grid (with AI-ranked search via SHIFTBOT) to hire operators with verifiable track records. LASTPROOF is the first tool released in the LASTSHIFT Terminal product ecosystem developed by LASTSHIFT.AI."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need a LASTSHIFT Terminal ID to use LASTPROOF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Browsing The Grid is free with no Terminal ID required. To create an operator profile, claim a handle, or use SHIFTBOT, you need a LASTSHIFT Terminal ID. Get one by connecting your Solana wallet at lastshift.app, then bring the Terminal ID to lastproof.app to unlock profile features. The same Terminal ID works across every current and future LASTSHIFT tool."
      }
    },
    {
      "@type": "Question",
      "name": "How do I verify someone's work on LASTPROOF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Open any operator's profile at lastproof.app/@handle, scroll to their Proof of Work section, and click VERIFY THIS WORK on the job you collaborated on. No login or wallet connect required. You pay $1 (collaborator proof) or $5 (dev proof) from any Solana wallet you control. The wallet you send from becomes your verifier identity on the proof. The proof writes permanently to the chain."
      }
    },
    {
      "@type": "Question",
      "name": "What is a DEV proof?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A DEV proof is a verification signed by a wallet that deployed the token, holds mint authority, or is a multisig signer on the founder treasury. It is the strongest trust signal on LASTPROOF because it cannot be coordinated between friends. The wallet's role is checked on-chain post-payment. If the check fails, no proof is created and the payment is held for manual refund."
      }
    },
    {
      "@type": "Question",
      "name": "What are the LASTPROOF tiers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Tier 1 (New, 0+ proofs) is just-joined operators. Tier 2 (Verified, 10+ proofs) means shipped real work on real projects. Tier 3 (Experienced, 25+ proofs) is a track record hard to fake and easy to verify. Tier 4 (Legend, 50+ proofs) is top of the ladder. Tiers are earned, not bought, and SHIFTBOT ranks operators by tier, DEV proofs, recency, and category match."
      }
    },
    {
      "@type": "Question",
      "name": "How much does LASTPROOF cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Browsing The Grid is free with no wallet connect. Operator profiles are $10 per month, or 40% off when paid in $LASTSHFT. Collaborator proofs are $1, DEV proofs are $5. Devs and founders never pay to scan or hire — operators pay to build proof. All fees route to the LASTSHIFT.AI accounts receivable wallet, where 25% is permanently burned weekly."
      }
    },
    {
      "@type": "Question",
      "name": "What operator categories does LASTPROOF support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "LASTPROOF supports 16 operator categories: Community Manager, Mod, Raid Leader, Shiller, Alpha Caller, KOL/Influencer, Space Host/AMA Host, Content Creator, Collab Manager, Growth/Paid Media, Brand/Creative, BD/Partnerships, PR/Comms, Tokenomics Designer, Smart Contract Dev, and Vibe Coder/Builder."
      }
    },
    {
      "@type": "Question",
      "name": "What is SHIFTBOT?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SHIFTBOT is the AI-ranked operator search layer over The Grid. Devs describe a hire in plain English (for example, find a raid leader Tier 3+ with DEV proofs on Solana memecoins) and SHIFTBOT returns a ranked shortlist weighted by DEV proof count, recency, and category match."
      }
    },
    {
      "@type": "Question",
      "name": "Can I hire operators directly without going through LASTPROOF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Clicking HIRE on any profile routes the conversation to that operator's Telegram. There is no middleman, no commission, and no platform tax on the deal. LASTPROOF is the verification layer, not the escrow or payments layer."
      }
    }
  ]
}
```

---

## 4. Operator Profile Pages (`/@handle`)

### 4.1 — Update Person schema (replace existing minimal version)

**For the founder profile specifically (`/@lastshiftfounder`):**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "KT",
  "alternateName": ["@lastshiftfounder"],
  "url": "https://lastproof.app/@lastshiftfounder",
  "image": "https://lastproof.app/avatars/lastshiftfounder.jpg",
  "jobTitle": "Founder",
  "description": "Pseudonymous founder of LASTSHIFT.AI. Sole builder of the LASTSHIFT Terminal, $LASTSHFT, and LASTPROOF. Public byline on the Builder Journal and Shift Report.",
  "worksFor": {
    "@type": "Organization",
    "name": "LASTSHIFT.AI",
    "url": "https://lastshift.ai"
  },
  "sameAs": [
    "https://t.me/lastshiftfounder",
    "https://paragraph.com/@lastshiftcoin",
    "https://lastshiftcoin.com/journal.html",
    "https://lastshiftcoin.com/shift-report.html"
  ],
  "knowsAbout": [
    "Web3 marketing",
    "Memecoin community management",
    "On-chain verification",
    "Solana ecosystem",
    "Crypto operator hiring",
    "AI-driven community automation"
  ]
}
```

**Why:** Establishes KT as the canonical Person entity (per Brand Reference Section 5.1), with `@lastshiftfounder` as alternate name. Links to all KT bylines and channels. This is the foundation for KT to eventually become a Wikidata Person entity.

### 4.2 — For all other operator profiles

The standard ProfilePage + Person schema is correct as-is. Only change is to ensure the Person `worksFor` does NOT default to LASTSHIFT.AI (only KT works for LASTSHIFT.AI; other operators are independent).

---

## 5. Blog Posts

### 5.1 — Update existing Person (author) schema in BlogPosting

**Current author block on blog posts:**
```json
"author": {
  "@type": "Person",
  "name": "@lastshiftfounder",
  "url": "https://lastproof.app/@lastshiftfounder"
}
```

**Replace with:**
```json
"author": {
  "@type": "Person",
  "name": "KT",
  "alternateName": "@lastshiftfounder",
  "url": "https://lastproof.app/@lastshiftfounder",
  "sameAs": [
    "https://t.me/lastshiftfounder",
    "https://paragraph.com/@lastshiftcoin"
  ]
}
```

**Why:** Aligns blog author byline with canonical KT identity, matching how the Builder Journal on lastshiftcoin.com is bylined.

### 5.2 — Add HowTo schema to procedural posts (NEW)

The following blog posts qualify for HowTo schema in addition to existing BlogPosting:

| Post | URL slug |
|---|---|
| How to vet a crypto KOL before paying them | `/blog/how-to-vet-a-crypto-kol-before-hiring` |
| How to hire a community manager for your memecoin | `/blog/how-to-hire-a-community-manager-for-memecoin` |
| How to find legit crypto marketers without paying an agency | `/blog/how-to-find-legit-crypto-marketers-without-agency` |
| How to become a crypto KOL in 2026 | `/blog/how-to-become-a-crypto-kol` |
| How to build a crypto community manager portfolio | `/blog/how-to-build-crypto-community-manager-portfolio` |
| How to get hired in web3 marketing in 2026 | `/blog/how-to-get-hired-in-web3-marketing` |

**Template for each (adjust per post):**

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[Article H1 — exact match]",
  "description": "[Article meta description]",
  "image": "[Featured image URL]",
  "totalTime": "PT15M",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": "0"
  },
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "[Step H2/H3 from article]",
      "text": "[Step content — 1-3 sentences from article body]",
      "url": "[blog post URL]#step-1"
    }
  ],
  "author": {
    "@type": "Person",
    "name": "KT",
    "alternateName": "@lastshiftfounder",
    "url": "https://lastproof.app/@lastshiftfounder"
  }
}
```

**Implementation:**
- Pull steps directly from the article's H2/H3 structure
- Add anchor IDs to headings (e.g., `<h2 id="step-1">`) so `url` deep-links work
- Each numbered step in article body becomes a HowToStep
- Number of steps varies per article — match the article structure

---

## 6. `/llms.txt` (Create new file at root)

Create at: `https://lastproof.app/llms.txt`

```
# LASTPROOF

> Web3 operator verification platform built on Solana. First tool in the LASTSHIFT Terminal product ecosystem developed by LASTSHIFT.AI.

LASTPROOF replaces screenshot-based portfolios with on-chain proof of work for web3 operators. Operators (community managers, KOLs, raid leaders, mods, content creators, and 11 other categories — 16 total) build wallet-locked profiles backed by paid Solana transactions from past collaborators ($1) and project deployers ($5 DEV proof). Devs and founders use The Grid and SHIFTBOT (AI-ranked operator search) to hire operators with verifiable track records.

Access requires a LASTSHIFT Terminal ID — generated by connecting a Solana wallet at lastshift.app. The Terminal ID is the user's persistent license across every LASTSHIFT tool, current and future.

Browsing The Grid is free. Operator profiles are $10/month (40% off paid in $LASTSHFT). All fees route to the LASTSHIFT.AI accounts receivable wallet, where 25% is permanently burned weekly.

## Core Pages
- [Home](https://lastproof.app): Landing page with operator categories, featured profiles, SHIFTBOT entry point
- [How It Works](https://lastproof.app/how-it-works): Full explanation of proofs, tiers, verification flow, red flags
- [The Grid](https://lastproof.app/grid): Searchable directory of all verified operators
- [Manage Profile](https://lastproof.app/manage): Operator profile creation and editing (Terminal ID required)
- [Help](https://lastproof.app/help): FAQ and support
- [Status](https://lastproof.app/status): System status

## Blog (Operator + Builder Education)
- [Blog Index](https://lastproof.app/blog)
- [How to get hired in web3 marketing in 2026](https://lastproof.app/blog/how-to-get-hired-in-web3-marketing)
- [How to vet a crypto KOL before paying them](https://lastproof.app/blog/how-to-vet-a-crypto-kol-before-hiring)
- [How to hire a community manager for your memecoin](https://lastproof.app/blog/how-to-hire-a-community-manager-for-memecoin)
- [How much does memecoin marketing cost in 2026](https://lastproof.app/blog/how-much-does-memecoin-marketing-cost)
- [How much do memecoin community managers really make](https://lastproof.app/blog/how-much-do-memecoin-community-managers-make)
- [How much do crypto shillers actually get paid in 2026](https://lastproof.app/blog/how-much-do-crypto-shillers-get-paid)
- [How to become a crypto KOL in 2026](https://lastproof.app/blog/how-to-become-a-crypto-kol)
- [How to build a crypto community manager portfolio](https://lastproof.app/blog/how-to-build-crypto-community-manager-portfolio)
- [How to find legit crypto marketers without paying an agency](https://lastproof.app/blog/how-to-find-legit-crypto-marketers-without-agency)
- [Why telegram mods keep getting stiffed in crypto](https://lastproof.app/blog/telegram-mods-getting-stiffed-in-crypto)
- [Do I need a community manager for my memecoin](https://lastproof.app/blog/do-i-need-a-community-manager-for-my-memecoin)
- [How to know if a crypto influencer will actually deliver](https://lastproof.app/blog/how-to-know-if-crypto-influencer-will-deliver)
- [Why social proof beats screenshots in web3](https://lastproof.app/blog/social-proof-beats-screenshots-web3)

## Key Concepts
- **Proof of Work:** Paid on-chain Solana transactions where collaborators ($1) or project deployers ($5) verify an operator's work on a specific project. Permanent, public, wallet-locked.
- **DEV Proof:** Verification signed by a wallet that deployed the token, holds mint authority, or is a multisig signer on the founder treasury. Strongest trust signal.
- **Tiers:** Tier 1 (New, 0+ proofs), Tier 2 (Verified, 10+), Tier 3 (Experienced, 25+), Tier 4 (Legend, 50+).
- **SHIFTBOT:** AI-ranked operator search. Devs describe the hire in plain English; SHIFTBOT returns a ranked shortlist weighted by DEV proofs, recency, and category match.
- **The Grid:** Searchable directory of every verified operator on the platform.
- **Terminal ID:** Wallet-derived license generated at lastshift.app, required to use LASTPROOF and every other LASTSHIFT tool.

## Pricing
- Browse The Grid: free, no wallet connect required
- Operator profile: $10/month (or 40% off when paid in $LASTSHFT)
- Standard collaborator proof: $1
- DEV proof: $5
- 25% of all platform revenue is permanently burned weekly

## Parent Ecosystem
- LASTSHIFT.AI (parent): https://lastshift.ai
- LASTSHIFT Terminal (platform): https://lastshift.app
- $LASTSHFT (token): https://lastshiftcoin.com

## Contact
- X (company): https://x.com/lastshiftai
- X (token/community): https://x.com/LASTSHIFTCOIN
- Telegram (announcements): https://t.me/LastShiftCoin
- Telegram (community): https://t.me/LastShiftCoinBreakroom

## Builder
LASTPROOF is built by KT, the pseudonymous founder of LASTSHIFT.AI. KT operates as @lastshiftfounder on Telegram and at lastproof.app/@lastshiftfounder. Public byline on the LASTSHIFT Builder Journal at paragraph.com/@lastshiftcoin and lastshiftcoin.com/journal.html.
```

---

## Deploy Order

Execute in this order:

1. **Identity corrections (Section 1)** — fastest, biggest correctness win
   - Fix `twitter:site` to `@lastshiftai`
   - Update Organization `sameAs` arrays site-wide

2. **Homepage updates (Section 2)** — three blocks (corrected Organization, new SoftwareApplication, new WebSite)

3. **`/how-it-works` updates (Section 3)** — corrected Organization + new FAQPage

4. **Profile page corrections (Section 4)** — KT canonical Person on `/@lastshiftfounder`

5. **Blog post updates (Section 5)** — author byline correction + HowTo schema on 6 procedural posts

6. **`/llms.txt` creation (Section 6)** — new file at root

---

## Verification Checklist

After deploy, verify:

- [ ] No page references `@lastshft` anywhere (search source: `grep -r "@lastshft" .`)
- [ ] All pages reference `@lastshiftai` for `twitter:site`
- [ ] Homepage returns 3 JSON-LD blocks (Organization, SoftwareApplication, WebSite)
- [ ] `/how-it-works` returns FAQPage schema with 9 Q&A pairs
- [ ] `/@lastshiftfounder` returns Person schema with `name: "KT"` and `alternateName: ["@lastshiftfounder"]`
- [ ] All blog posts return BlogPosting schema with author `name: "KT"`
- [ ] 6 procedural blog posts ALSO return HowTo schema
- [ ] `/llms.txt` returns 200 at root

**Validate every JSON-LD block at:**
- https://validator.schema.org/
- https://search.google.com/test/rich-results

**For LLM citation surface, verify:**
- View page source on each page, confirm JSON-LD blocks are present
- Use `curl -A "GPTBot/1.0" https://lastproof.app/` to confirm content is server-rendered

---

## What This Achieves

After full deploy:

1. ✅ **All identity references aligned** — `@lastshiftai` (company) and `@LASTSHIFTCOIN` (token) replace incorrect `@lastshft`
2. ✅ **LASTPROOF correctly classified as SoftwareApplication** — eligible for "tools for X" type LLM responses
3. ✅ **Parent organization relationship established** — LASTPROOF properly linked to LASTSHIFT.AI ecosystem
4. ✅ **`/how-it-works` becomes citable** — FAQPage schema makes Q&A content directly extractable by LLMs and AI Overviews
5. ✅ **KT established as canonical Person entity** — author authority across blog posts, profile, eventually X
6. ✅ **HowTo schema on procedural posts** — eligible for AI Overview step-by-step features and direct LLM citation
7. ✅ **`/llms.txt`** — explicit guidance to LLM crawlers
8. ✅ **Foundation for future Wikidata submissions** — Person entity (KT), Software Application entity (LASTPROOF), parent Organization entity (LASTSHIFT.AI) all properly structured

---

## What This Does NOT Do

- Does not modify visible page content or styling
- Does not change Grid functionality, payment flow, or Terminal ID gating
- Does not address sitemap.xml updates (separate task — though `llms.txt` should be added to the sitemap)
- Does not address profile/avatar image URLs (assumes existing paths are correct)
- Does not address tracking, analytics, or conversion pixels
- Does not modify the existing FAQPage schema on individual blog posts (those are correct as-is)
- Does not modify ProfilePage schema on operator profiles (correct as-is, only the Person sub-schema for the founder needs updating)

---

**End of lastproof.app schema update plan.**
