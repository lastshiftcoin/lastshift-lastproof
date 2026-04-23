# LASTPROOF — Build Story Source Material

*For the blog writer. Everything here is real. Use what resonates, ignore what doesn't.*

---

## The Problem We Solved

Web3 operators — community managers, raid leaders, KOLs, growth marketers — have no way to prove they did the work. Memecoins launch, operators grind, the coin dies in 3 weeks, and all the work vanishes. Next gig? Start from zero. Screenshots in DMs. "Trust me bro." No receipts.

LASTPROOF makes work permanent. On-chain, wallet-verified, immutable. Your proof of work survives every dead project.

---

## The Build — What Actually Happened

### V1: Wallet Connect (The Obvious Approach)

Started with what every Solana dApp does — connect wallet, sign transaction, done. Built the full pipeline: Phantom, Solflare, Backpack adapters. Desktop extensions. Mobile Wallet Adapter (MWA) for Android. Browse deep links for iOS.

**What went wrong:**
- Phantom's in-app browser on Android trapped users in a dead end. They'd open a profile link, Phantom would intercept it, load the page inside its browser, and the proof modal couldn't escape to complete the payment flow.
- Wallet Standard falsely reported wallets as "DETECTED" on mobile Chrome even when they couldn't actually inject — users clicked "Phantom" and got a download page instead of the app opening.
- MWA (Mobile Wallet Adapter) worked on Android Chrome but not Brave, not Firefox, not iOS. Every browser was a different code path.
- We wrote 3 complete wallet integration reports (Phantom, Solflare, Backpack), each documenting desktop, Android MWA, and iOS browse deep link flows separately. 87 planned screen files across 9 platforms. It was architecturally correct and completely impractical.

**The lesson:** We were building wallet infrastructure, not a proof system. The wallet was never the product — the proof was.

### V2: Paste-Verify (The Breakthrough)

Threw out the wallet adapter entirely. The new flow:

1. Pick what you're verifying (collaborator or dev)
2. Pick your payment token ($LASTSHFT at 40% off, SOL, or USDT)
3. See the treasury address + exact amount
4. Go pay in whatever wallet you want — Phantom, Solflare, Backpack, Jupiter, Binance, a hardware wallet, anything
5. Come back, paste the Solscan URL or transaction signature
6. Backend verifies everything on-chain
7. Proof deployed to the operator's profile

**Why it works:** The user is anonymous until they submit a transaction. No wallet adapter. No extension popups. No deep links. No MWA handshakes. Works in any browser, on any device, with any wallet. The blockchain itself is the verification layer — we just read from it.

**The technical move:** Helius enhanced webhook watches the treasury wallet. When payment arrives (1-5 seconds), the backend immediately verifies: correct recipient, correct amount, correct time window, unique signature. Cron fallback every 60 seconds catches anything the webhook misses.

### Anti-Scam: Session Timestamps

When someone opens the proof modal, we record the timestamp server-side. The transaction's on-chain `blockTime` must be AFTER that timestamp. This kills the attack where someone finds an old transaction to the treasury wallet and tries to submit it as their proof.

The denial message for this? "Nice try. Scamming will die in web3. Support your friend and purchase a proof for them."

### Silent Duplicate Handling

If someone submits a transaction signature that's already been used for a proof, we don't show an error. We show the success flow. The scammer thinks it worked. The proof was already counted for the real person. No information leakage.

---

## The Numbers

- **6 screens** in the proof flow (down from 9 with wallet connect)
- **1-5 second** verification via Helius webhook (down from 60 seconds via cron-only)
- **3 payment tokens**: $LASTSHFT (40% discount), SOL, USDT
- **$1** for a collaborator proof, **$5** for a dev verification
- **5,000** free upgrades for early access operators
- **4 tiers**: New (0 proofs) → Verified (10+) → Experienced (25+) → Legend (50+)
- **1 wallet per work item** — unlimited unique wallets can proof the same project, but each wallet can only do it once
- **1 dev proof per project** — the deployer/mint authority/first-5-holder verification is the strongest trust signal on the platform

---

## The Stack

- **Next.js 16** with Turbopack on Vercel
- **Supabase** Pro ($25/mo) — Postgres, RLS, service role key
- **Solana mainnet** — all proofs are real on-chain transactions
- **Helius** — RPC + enhanced webhooks for instant verification
- **Jupiter Price API** — live $LASTSHFT/SOL rates with 60s cache
- **$LASTSHFT token** — live on-chain, 40% discount on all proofs

---

## The Ugly Parts (Honest)

### Turbopack Gotchas
- Next.js 16 Turbopack silently ignored `middleware.ts` — had to rename to `proxy.ts`, then discovered the function export name also changed from `middleware()` to `proxy()`. Documentation existed but was buried.
- `NEXT_PUBLIC_` env vars weren't available in middleware/proxy on Vercel's Turbopack build. Had to find workarounds.
- Security headers in `next.config.ts` via `headers()` function broke ALL serverless API routes on Vercel Turbopack. Had to revert immediately. Still unresolved — headers need to go through Vercel project settings instead.

### Mobile Wallet Debugging
- Spent days building per-wallet mobile connection flows before realizing the entire wallet-connect paradigm was wrong for our use case.
- Wallet Standard reports wallets as available on mobile Chrome when they can't actually inject. This is by design (Wallet Standard is for extension discovery), but it creates a misleading UX.
- Phantom's in-app browser on Android was a trap — debug logs showed 100% of Android Phantom users hitting the old flow and 0% reaching the paste-verify path.

### The Subscription Cron Bug
- A daily cron job expired subscriptions by checking `subscription_expires_at`. Early access profiles have `null` expiry (their timer starts at grid launch, not at claim time). The cron saw `null` + `isPaid=true` → flipped them to unpaid. The founder's profile got downgraded to free. Fixed by adding an `isEarlyAdopter && !subscriptionExpiresAt` guard.

---

## The Good Parts

### Proof Immutability
Once a work item has a single proof, it's locked. Can't be edited. Can't be deleted. The operator's profile becomes permanent once on-chain proofs exist. This is the core trust primitive — the thing the entire platform exists for.

### The Terminal Chrome Aesthetic
Every modal — proof, mint, handle change, subscription — uses the same visual language: dark background, monospace fonts, terminal-style cascading text, CRT scanlines, orange accent. It looks like a developer tool, not a consumer app. That's intentional — the target users are web3 operators who live in terminals and Discord.

### Ambassador System
6 ambassadors, each with a unique campaign URL that looks like a generic landing page (not a referral link). `lastproof.app/early-access-free`, `lastproof.app/first-5000-free`, etc. Dual-track attribution: URL param (primary) + cookie (backup). Rolling 7-day payout tiers. Admin dashboard at `/5k/god-ops`. The referral is invisible to the user — they just see a campaign page and sign up.

### Dev Verification
The $5 dev proof checks if the paying wallet is the token's mint authority, deployer, or one of the first 5 holders. All checked on-chain via Helius RPC. If the wallet doesn't qualify, they lose their $5. Stronger deterrent than a pre-check.

---

## The Relief

The moment paste-verify worked on mobile — opening a profile in Chrome, tapping "Verify This Work," copying the treasury address, switching to Phantom, sending the payment, switching back, pasting the Solscan URL, watching the terminal cascade verify each check in real time, and seeing "PROOFED ON-CHAIN" — that was the moment it became real.

No wallet extension. No deep link. No app switch gymnastics. Just a payment and a receipt. The blockchain doing what it was designed to do — verify truth.

---

## Quotes / Lines to Use

> "Memecoins die. Your reputation shouldn't."

> "Your wallet is your proof."

> "Trust me bro" is dead. On-chain receipts are the new resume.

> The user is anonymous until they submit a transaction. We don't need their wallet — we need their payment.

> We built 87 screen files for 3 wallets across 3 platforms before realizing we were solving the wrong problem.

> The blockchain is the verification layer. We just read from it.

> Scamming will die in web3. Support your friend and purchase a proof for them.

---

## Timeline

- **Apr 10-11**: Initial architecture, payment pipeline, ambassador system
- **Apr 11-12**: Wallet-per-platform research, 3 wallet reports, per-wallet flow attempt
- **Apr 12**: V3 pivot — wallet-free paste-verify architecture
- **Apr 12-13**: V3 build, Helius webhook integration, terminal cascade UX, anti-scam
- **Apr 13**: Security hardening, domain migration, lastproof.app goes live
- **May 8**: Grid launch (the discovery layer — operators ranked by proofs)

---

*Everything above is real. No embellishment. The build happened across multiple AI builder sessions working in parallel — fullstack, frontend, modals, terminal — with one human operator relaying between them.*
