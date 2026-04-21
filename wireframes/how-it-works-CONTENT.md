# LASTPROOF — Help Page (`/help`)

**Purpose:** single destination that resolves new-user confusion on lastproof.app — especially the "I don't have a Terminal ID" gap. Linked from every Terminal-ID prompt across the platform.

**Primary route:** `lastproof.app/help`
**Also reachable via:** `lastproof.app/how-it-works`, `lastproof.app/faq` (both redirect to `/help`)

**Audience:** new operators who landed on lastproof without visiting the Terminal first, plus returning operators who got stuck.

**Tone:** help-desk direct. "You're stuck — here's the fix." No marketing fluff, no hero-hype language. Terminal/CRT visual language (same as /manage and onboarding). Think Stripe docs meets a terminal boot screen.

**Page mental model:** a help page, not a marketing page. The goal is to resolve the problem the user walked in with as fast as possible, then offer the full walkthrough for people who want the whole story.

---

## Entry Points — where this page is linked from

| From | Link text | Placement |
|---|---|---|
| `/manage` (auth screen) | "Need help?" | Under the "Don't have a Terminal ID?" line |
| `/manage` (auth screen) | "?" help icon | Top-right of terminal frame |
| Global header/footer (every page) | "Help" | Footer link, always visible |
| Onboarding — any step | "Stuck? Get help" | Footer of onboarding screens |
| Proof modal — before payment | "What am I paying for?" | Below the pay button |
| Public profile (`/@handle`) | "Help" | Footer link |
| Homepage (`/`) | "How it works →" | Below hero |
| 404 page | "Lost? Start here." | Main CTA |

---

## Page Metadata (SEO)

- **Title:** `LASTPROOF Help — Terminal ID, Setup, and FAQ`
- **Meta description:** `Need help with LASTPROOF? Get your Terminal ID, fix login issues, learn how the LASTSHIFT stack works, and read answers to the most-asked questions.`
- **OG/Twitter card:** use the ecosystem diagram as the share image
- **JSON-LD:** `FAQPage` schema using the Q&A below

---

## Page Order (top-to-bottom)

The help page is ordered by **what a stuck user needs first**, not by narrative:

1. **Hero** — short, help-desk tone. No marketing.
2. **Quick Answers** — the 3 most common blockers with instant fixes. Above the fold.
3. **Topic Hub** — 4 big clickable topic cards: *Profile Creation · Verify This Work · Updating My Profile · Profile Status*. This is the primary navigation.
4. **TOPIC 1 — Profile Creation** — 5-step visual quick-start: Terminal → Terminal ID → /manage → handle + profile → publish.
5. **TOPIC 2 — Verify This Work (Proofs)** — 6-step visual for submitting a proof + the "How to collect proofs" playbook for operators.
6. **TOPIC 3 — Updating My Profile** — edit bio, add/edit work items, screenshots, links, categories, change handle, verify X/TG, upgrade, mint projects.
7. **TOPIC 4 — Profile Status** — what Active Paid, First 5,000 (EA), Free, and Defunct mean; what each shows publicly and to the owner; how to move between states.
8. **FAQ (cross-topic)** — questions that don't belong to a single topic.
9. **Reference — The Stack** — the Microsoft → Office → Word analogy.
10. **Reference — What each piece is** — the 4 ecosystem cards.
11. **Reference — Terminal ID explainer.**
12. **Reference — Two wallets.**
13. **Still stuck? Contact us** — escalation.
14. **Footer** — standard.

**NOTE for frontend builder:** TOPIC 1 / 2 / 3 are the primary content. The topic hub cards at the top of the page scroll-jump to those sections. Each topic has its own FAQ block at the bottom of that section, and the cross-topic FAQ sits between the topics and the reference material. Topics may later split into sub-pages (`/help/profile-creation`, `/help/verify-this-work`, `/help/updating-my-profile`) — structure the content so this is a cheap migration later (each topic should stand alone).

**OUT OF SCOPE (for now):** The Grid. Ignore any Grid-related content until Grid launches (May 2026).

---

## SECTION 1 — Hero

**Eyebrow (orange, mono, uppercase):** `LASTPROOF // HELP`

**Headline (H1):** `How can we help?`

**Sub (one line, text-secondary):** `Most people land here because they don't have a Terminal ID yet. Scroll down — the fix takes 30 seconds.`

---

## SECTION 1.5 — Quick Answers (NEW — above the fold)

**Section heading:** `THE TOP 3 BLOCKERS`

Three cards in a row (stack on mobile). Each is a one-line problem + one-line fix + CTA.

### Card 1 — "I don't have a Terminal ID"
**Problem (mono, dim):** `> ERROR: terminal ID required`
**Fix (text-primary):** Get one at the Terminal — lastshift.app. Connect wallet. 30 seconds. Save the SHIFT-XXXX-XXXX-XXXX-XXXX key.
**CTA:** `LAUNCH TERMINAL →` (orange primary, href: https://lastshift.app)

### Card 2 — "The page says 'no registry match'"
**Problem (mono, dim):** `> NO REGISTRY MATCH`
**Fix:** Your wallet isn't linked to a Terminal ID yet. Head to the Terminal with the same wallet and register first.
**CTA:** `GO TO TERMINAL →` (orange primary, href: https://lastshift.app)

### Card 3 — "I have my key but can't log in"
**Problem (mono, dim):** `> AUTHENTICATION FAILED`
**Fix:** Did you regenerate your Terminal ID recently? Old keys are revoked instantly. Grab the current key from the Terminal dashboard.
**CTA:** `CHECK MY KEY →` (ghost button, href: https://lastshift.app)

---

## SECTION 1.75 — Topic Hub (primary navigation)

**Section heading:** `WHAT DO YOU NEED HELP WITH?`

**Sub:** `Pick a topic.`

**3 big clickable cards** (stack on mobile, 3-column on desktop). Each card = a mini landing for that topic, scroll-jumps to the full section below.

### Card 1 — Profile Creation
**Icon (SVG, orange outline):** user-plus
**Title:** `PROFILE CREATION`
**Body:** `New here? Start from zero — Terminal ID, @handle, first profile.`
**Steps in the bag:** `5 steps · ~5 minutes`
**CTA (terminal-style):** `> go to profile creation`
**Scroll target:** `#topic-profile-creation`

### Card 2 — Verify This Work (Proofs)
**Icon (SVG, orange outline):** shield-check
**Title:** `VERIFY THIS WORK`
**Body:** `Submit a proof on someone else's work — or figure out how to collect proofs on your own.`
**Steps in the bag:** `6 steps · ~2 minutes per proof`
**CTA (terminal-style):** `> go to proof flow`
**Scroll target:** `#topic-verify-work`

### Card 3 — Updating My Profile
**Icon (SVG, orange outline):** edit
**Title:** `UPDATING MY PROFILE`
**Body:** `Change your bio, add work items, swap your handle, upgrade to paid, verify X/Telegram.`
**Steps in the bag:** `8 sub-topics`
**CTA (terminal-style):** `> go to profile editing`
**Scroll target:** `#topic-updating-profile`

### Card 4 — Profile Status
**Icon (SVG, orange outline):** activity / pulse
**Title:** `PROFILE STATUS`
**Body:** `Active Paid, First 5,000, Free, or Defunct — what each state means, what shows publicly, and how to change state.`
**Steps in the bag:** `4 states · quick reference`
**CTA (terminal-style):** `> go to profile status`
**Scroll target:** `#topic-profile-status`

**Note (below cards, dim):** `> The Grid launches May 2026 — that's getting its own help section when it goes live.`

---

## SECTION 1.8 — Anchor Nav (thin sticky bar below topic hub)

Thin terminal-command-style anchor bar that becomes sticky after the topic hub scrolls out of view:

`> profile creation` · `> verify work` · `> updating profile` · `> profile status` · `> faq` · `> contact`

Smooth-scroll, focuses section header for screen readers. Becomes sticky at `position: sticky; top: 0` once user scrolls past the topic hub cards.

---

## SECTION 2 — The Stack (the analogy)

**Section heading:** `THE STACK — IN PLAIN ENGLISH`

**Intro line:** `If you've used Microsoft products, you already understand this.`

**Visual — side-by-side comparison (two columns, mono, terminal-style):**

```
MICROSOFT STACK                  LASTSHIFT STACK
───────────────                  ───────────────
Microsoft            →           LASTSHIFT.AI
  (the company)                    (the company / ecosystem)

Office 365           →           LASTSHIFT TERMINAL
  (the product suite)              (the product suite)

Word                 →           LASTPROOF
  (one tool in the suite)          (one tool in the suite)

USD                  →           $LASTSHFT
  (how you pay)                    (how you pay — 40% off)
```

**Below the visual (card, text-secondary):**
`LASTSHIFT.AI → LASTSHIFT TERMINAL → LASTPROOF`
`Same pattern as Microsoft → Office 365 → Word. That's it.`

---

## SECTION 3 — What Each Piece Is

**Section heading:** `WHAT EACH PIECE DOES`

Four cards (stacked mobile, 2×2 desktop):

### Card 1 — LASTSHIFT.AI
**Label (mono, dim):** `THE ECOSYSTEM`
**Title:** `LASTSHIFT.AI`
**Body:** `The parent company. Home of our roadmap, brand, and the $LASTSHFT token. You don't log in here — it's the front door.`
**Link:** `Visit lastshift.ai →`

### Card 2 — LASTSHIFT TERMINAL
**Label (mono, dim):** `THE PRODUCT SUITE`
**Title:** `LASTSHIFT TERMINAL`
**URL shown:** `lastshift.app`
**Body:** `Your dashboard for everything. The Terminal issues your Terminal ID — one license key that unlocks every tool in the suite. Connect your wallet once, use it across the whole stack.`
**Link:** `Open the Terminal →` (href: https://lastshift.app)

### Card 3 — LASTPROOF
**Label (mono, dim):** `THE FIRST TOOL`
**Title (two-tone):** `LAST`**`PROOF`** *(orange PROOF)*
**URL shown:** `lastproof.app`
**Body:** `The pseudonymous on-chain resume for web3 marketers. Collect paid verifications, earn tiers, land hires. The first tool live in the Terminal.`
**Link:** `Build your profile →` (href: /manage)

### Card 4 — $LASTSHFT
**Label (mono, dim):** `THE CURRENCY`
**Title:** `$LASTSHFT`
**Body:** `The ecosystem token. Pay for any tool or proof with $LASTSHFT and get 40% off. SOL and USDT also accepted at full price. USDC not supported.`
**Link:** `Buy on Jupiter →`

---

## SECTION 4 — Terminal ID Explainer

**Section heading:** `YOUR TERMINAL ID — THE KEY TO EVERYTHING`

**Visual — mono key display (centered, orange, large):**
```
SHIFT-XXXX-XXXX-XXXX-XXXX
```

**Body:**
`Your Terminal ID is a license key issued by the Terminal at lastshift.app. It looks like a Windows product key. One key. Every tool.`

**Three inline bullets (with green checkmarks):**
- ✓ Issued once — free, wallet-only, takes 30 seconds
- ✓ Works across every tool in the suite (LASTPROOF, and more coming)
- ✓ Regenerate anytime from the Terminal — old key instantly revoked

**Callout (orange-bordered box):**
`> You don't create your Terminal ID here on LASTPROOF. You get it from the Terminal. That's why — if you're new — the first step is always: LAUNCH TERMINAL.`

---

## TOPIC 1 — Profile Creation {#topic-profile-creation}

**Topic banner (orange eyebrow + green check icon):** `TOPIC 01 · PROFILE CREATION`

**Topic intro (text-secondary):** `The full flow for a brand-new operator — from zero to a live @handle profile. No email, no password, just a wallet.`

---

## SECTION 5 — Quick Start (step-by-step, VISUAL)

**Section heading:** `QUICK START — 2 MINUTES`

**Sub:** `Every step has a screenshot so you know exactly what to expect.`

**Layout rule:** each step is a card with IMAGE on one side, TEXT on the other (image above on mobile). Image is a real screenshot of that exact screen — captured from the wireframes or live UI. Border-radius 10px, 1px border, subtle orange glow on hover.

**5-step numbered flow:**

### STEP 01 — Open the Terminal
**Visual:** `/wireframes/screen1-launch-terminal.html` — the cold-boot wallet-connect screen. Caption: *"lastshift.app — click CONNECT WALLET"*
**Copy:** `Go to lastshift.app. That's the suite. Click CONNECT WALLET. Phantom, Solflare, Backpack — any Solana wallet.`
**Inline CTA:** `LAUNCH TERMINAL →` (href: https://lastshift.app)

### STEP 02 — Receive your Terminal ID
**Visual:** `/wireframes/screen2-key-generation.html` — the key-gen ceremony screen with the SHIFT-XXXX key displayed. Caption: *"Your Terminal ID. One key. Every tool."*
**Copy:** `The Terminal generates a unique SHIFT-XXXX-XXXX-XXXX-XXXX key. Save it — this is your license for every tool.`
**Tip:** `Write it down, store it in a password manager, or keep it in a note. You'll need it once per tool, then it's automatic.`

### STEP 03 — Launch LASTPROOF from the Terminal
**Visual:** `/wireframes/screen3-dashboard.html` with the LAUNCH LASTPROOF button highlighted (use a subtle orange pulse/arrow callout on that button). Caption: *"Terminal dashboard — click LAUNCH LASTPROOF in the sidebar."*
**Copy:** `From the Terminal dashboard, click LAUNCH LASTPROOF. It opens lastproof.app in a new tab.`
**Note:** `The Terminal stays alive in its own tab — don't close it. Each tool has its own tab and its own session.`

### STEP 04 — Register your profile on LASTPROOF
**Visual:** split-screen composite — left half: the /manage auth screen (`/wireframes/lastproof-onboarding.html` or the exact screenshot the user shared of the AUTHENTICATE screen), right half: the dashboard after auth (`/wireframes/lastproof-dashboard-fresh.html`). Caption: *"Paste your Terminal ID → claim your @handle."*
**Copy:** `On lastproof.app, paste your Terminal ID to authenticate. Pick your @handle (becomes your public URL: lastproof.app/@you). Add your bio, categories, and work history.`

### STEP 05 — Share your link and collect proofs
**Visual:** `/wireframes/lastproof-profile-public.html` — the public profile view (the shareable artifact). Caption: *"lastproof.app/@you — your on-chain resume. Drop it in any DM."*
**Copy:** `Drop lastproof.app/@you in DMs, bios, proposals. Teammates and devs pay $1 ($5 for DEV) to verify your work on-chain. Your tier grows. Projects find you on the Grid.`
**Important clarifier (orange callout below step):**
`> Proofs are submitted BY SOMEONE ELSE for your work — you can't proof yourself. You share your link, they click VERIFY THIS WORK on a specific project. See the next section for the full proof flow.`

---

---

## TOPIC 2 — Verify This Work (Proofs) {#topic-verify-work}

**Topic banner (orange eyebrow + shield icon):** `TOPIC 02 · VERIFY THIS WORK`

**Topic intro (text-secondary):** `Proofs are the heart of LASTPROOF. This topic covers both sides: how to submit a proof on someone else's work, and how to get proofs collected on your own profile.`

---

## SECTION 5.5 — How to submit a proof (for someone else's work)

**Section heading:** `HOW PROOFS WORK — THE 6-STEP FLOW`

**Sub:** `If a teammate or project you worked with has a LASTPROOF profile, you can vouch for their work on-chain. No wallet connect, no signing popups — just paste and verify.`

**Intro context (card, text-secondary):**
`Proofs are paid on-chain transactions on Solana. When you submit one, you're publicly saying "this person actually did this work" — and the $1 ($5 for dev) fee makes the signal meaningful. Your proof gets linked to Solscan permanently. Fake proofs cost real money, so the system self-filters.`

**6-step visual flow** (same card treatment as the quick-start above — screenshot on one side, copy on the other):

### STEP 01 — Find the work you want to vouch for
**Visual:** `/wireframes/lastproof-profile-public.html` scrolled to the "Proof of Work" section with one project card highlighted. Caption: *"VERIFY THIS WORK button — click the project you're vouching for."*
**Copy:** `Visit the operator's profile (lastproof.app/@handle). Scroll to Proof of Work. Find the specific project or campaign you worked on with them. Click VERIFY THIS WORK on that project card.`

### STEP 02 — Pick your path: Collaborator or Dev
**Visual:** `/wireframes/lastproof-proof-modal-v2.html` — Screen 1 of the modal (path selection). Caption: *"Two paths — Collaborator ($1) or Dev ($5)."*
**Copy:** Two options:
- **Collaborator — $1** — teammates, community, anyone who can vouch for the work.
- **Dev — $5** — reserved for project deployer wallets. Earns the operator a DEV badge.
**Warning callout (red):** `The Dev path is verified against the project's actual deployer wallet on-chain. Picking Dev without being the real deployer = you lose the payment, no proof awarded. The system checks.`

### STEP 03 — Pick your token
**Visual:** `/wireframes/lastproof-proof-modal-v2.html` — Screen 2 (token select). Caption: *"Pay with $LASTSHFT (40% off), SOL, or USDT. USDC not accepted."*
**Copy:** Three options:
- **$LASTSHFT** — 40% off. Cheapest path. Contributes to the 25% burn.
- **SOL** — full price.
- **USDT** — full price.
**Note:** `USDC is not supported. Check your wallet has one of the 3 tokens before starting.`

### STEP 04 — Copy the address + exact amount, then send
**Visual:** `/wireframes/lastproof-proof-modal-v2.html` — Screen 3 (send instructions with copy buttons). Caption: *"Copy address. Copy exact amount. Send from your wallet."*
**Copy:** The modal shows:
- The destination address (copy button next to it)
- The exact amount in your chosen token (copy button next to it)
- Open your Solana wallet (Phantom, Solflare, Backpack) and send that exact amount to that address.
**Important callout (orange):** `Amount must be EXACT. $1.00 not $1.01. The webhook matches on the cent. Wrong amount = not credited.`
**Anti-scam note:** `The transaction must happen AFTER you open this modal. Old transactions don't count — prevents scammers from reusing a paid TX for multiple proofs.`

### STEP 05 — Paste the TX signature + add a comment
**Visual:** `/wireframes/lastproof-proof-modal-v2.html` — Screen 4 (paste signature + optional comment field). Caption: *"Paste your TX signature. Add an optional 140-char comment."*
**Copy:** After your wallet confirms the send:
1. Copy the transaction signature from your wallet (usually a "Signature" field after confirming).
2. Paste it into the modal.
3. Add a short comment (optional, up to 140 chars) — e.g. "@kellen ran our Tier 1 raid team for 6 months. Real one." This shows up on the proof card publicly.
**Tip:** `Comments build social proof. Proofs with personalized comments hit harder than blank ones.`

### STEP 06 — Watch it verify + see the receipt
**Visual:** `/wireframes/lastproof-proof-modal-v2.html` — Screen 5 (cascade/receipt). Caption: *"1-5 second verification via Helius. Then the receipt."*
**Copy:** Backend verifies in **1-5 seconds** via the Helius webhook. You'll see a terminal-style cascade of checks:
- `> Transaction found on-chain ✓`
- `> Amount matches ✓`
- `> Token matches ✓`
- `> Not self-proof ✓`
- `> Dev verification passed ✓` *(Dev path only)*
- `> Proof recorded`

**Then a receipt screen** with a Solscan link to the transaction. Reload the profile page — your proof is now on the operator's profile permanently. Their proof count ticks up, their tier may have advanced.
**Fallback:** `If the Helius webhook is slow or fails, a cron job picks it up within 60 seconds. No refresh loop — the modal handles it.`

---

## SECTION 5.75 — How to get proofs on YOUR profile (for operators)

**Section heading:** `HOW TO REQUEST PROOFS FOR YOUR OWN WORK`

**Sub:** `You can't proof yourself. Here's how to actually collect them.`

**4 tactics, each in a compact card:**

### Tactic 1 — Share your profile link after every project
**Body:** `When a project wraps — raid ends, campaign ships, contract finishes — send the project lead your lastproof.app/@you link with a one-liner: "Would mean a lot if you dropped a proof on my @handle profile for the [project name] work." Most devs say yes if you ask.`

### Tactic 2 — Target Dev Proofs (the $5 ones)
**Body:** `DEV Proofs are the most valuable — they come from the project's actual deployer wallet. Ask the founder or head dev specifically. One DEV Proof is worth 10 regular proofs in credibility signal. It's also the only way to earn the DEV badge.`

### Tactic 3 — Batch the ask
**Body:** `Hit up 5-10 past collaborators in one week, not spread out. Your profile goes from 0 to 5 proofs fast, which pushes you past TIER 1 (0+) to TIER 2 (10+) → TIER 3 (25+) in momentum. Profiles with momentum convert teams better than profiles with one old proof.`

### Tactic 4 — Be specific about which project
**Body:** `Don't send "hey proof me." Send "hey, can you drop a proof on the $BONK raid campaign card from Aug 2024? lastproof.app/@you, scroll to Proof of Work, the card says $BONK Raid Commander." Lower the friction.`

**Callout (green):** `> Proofs are social capital. The cost to the other person ($1-$5) is the feature, not a bug — it proves they actually mean it.`

---

## TOPIC 3 — Updating My Profile {#topic-updating-profile}

**Topic banner (orange eyebrow + edit icon):** `TOPIC 03 · UPDATING MY PROFILE`

**Topic intro (text-secondary):** `Everything you can change about your profile after it's live — bio, work items, screenshots, handle, verification badges, plan tier, and minted projects.`

**Entry point reminder (callout):** `All profile editing happens on lastproof.app/manage. Log in with your Terminal ID first — then use the sections in the manage dashboard.`

### Sub-topic index (8 sub-topics in this section)

Each sub-topic below is its own mini-card with a screenshot and short copy:

1. Editing your bio, pitch, and categories
2. Adding and editing work items
3. Uploading screenshots
4. Adding links (X, Telegram, LinkedIn, website)
5. Changing your @handle
6. Verifying X and Telegram (earns the Verification Badge)
7. Upgrading to paid / reactivating
8. Minting projects (paid feature — pin your best work)

---

### 3.1 — Editing your bio, pitch, and categories
**Visual:** `/wireframes/lastproof-dashboard.html` — the manage dashboard with the "About" / bio edit panel open. Caption: *"Click EDIT on any section to open the inline editor."*
**Copy:** `Head to /manage. Your bio, pitch, and categories all live in the main profile panel. Click EDIT next to any field to open the inline editor. Changes save instantly — no separate "save" button.`
**Field limits:**
- Bio: 240 chars
- Pitch: 500 chars
- Categories: pick up to 3 from the preset list (e.g. X Growth, Raid Leading, Community Mgmt, Dev, Design, Content)
**Tip:** `Your pitch is what shows on your profile card on the Grid. Treat it like an elevator pitch — 2 sentences max, lead with the most impressive number.`

---

### 3.2 — Adding and editing work items
**Visual:** `/wireframes/lastproof-dashboard.html` — the "Proof of Work" section with add/edit controls visible. Caption: *"Work items are the projects proofs attach to."*
**Copy:** `Work items are the individual projects or campaigns on your profile. Each gets its own card with a title, role, period, description, and a VERIFY THIS WORK button that collaborators click to proof you.`
**Steps:**
1. In /manage, scroll to "Proof of Work" and click + ADD WORK ITEM.
2. Fill in: ticker/project name, your role, start + end dates, description (280 chars).
3. Save.
4. The card appears on your public profile immediately, ready to collect proofs.
**Important callout (red):** `Work items with at least one proof are LOCKED — you can't edit or delete them. This protects the integrity of what proofers vouched for. Plan the title/role/description carefully before the first proof lands.`

---

### 3.3 — Uploading screenshots
**Visual:** `/wireframes/lastproof-dashboard.html` — screenshots upload panel. Caption: *"Drop JPG/PNG. Max 5MB per file."*
**Copy:** `Screenshots are visual proof — analytics dashboards, raid results, campaign metrics — attached to your profile. Upload them from the "Screenshots" section of /manage.`
**Limits:**
- Up to 10 screenshots per profile
- JPG or PNG, max 5MB each
- Caption optional (120 chars)
**Tip:** `Anonymize sensitive data before uploading — redact wallet addresses, DMs, anything private. Screenshots are public on your profile.`

---

### 3.4 — Adding links (X, Telegram, LinkedIn, website)
**Visual:** `/wireframes/lastproof-dashboard.html` — links panel. Caption: *"Add up to 5 links. X and Telegram can be verified."*
**Copy:** `Links appear on your public profile as clickable icons. Add them from the "Links" section of /manage.`
**Supported platforms:**
- X / Twitter (verifiable → adds badge)
- Telegram (verifiable → adds badge)
- LinkedIn
- Personal website
- GitHub
- Additional link (custom label)
**Max:** 5 links total.

---

### 3.5 — Changing your @handle
**Visual:** `/wireframes/lastproof-profile-public.html` mock of URL + inline modal screenshot for handle change. Caption: *"Your handle is your public URL. Changing it is a paid action."*
**Copy:** `Your @handle is the permanent URL for your profile (lastproof.app/@you). Changing it is possible but paid — to prevent squatting and ensure old links stay meaningful for 30 days.`
**Flow:**
1. In /manage, go to Profile Settings → Change Handle.
2. Check availability of the new handle.
3. Pay via the same 3-token paste-verify flow ($LASTSHFT, SOL, or USDT).
4. New handle activates immediately.
**Important rules:**
- Old handle is held in reserve for **30 days** (not claimable by anyone else).
- After 30 days, old handle is released back to the pool.
- Anyone hitting your old URL gets redirected to your new one during the 30-day window.
- Your proofs, tier, and DEV badge carry over — only the URL changes.
**Cost (TBD — confirm with Kellen):** `$[X] per handle change.`

---

### 3.6 — Verifying X and Telegram (Verification Badge)
**Visual:** verification badge displayed on `/wireframes/lastproof-profile-public.html`. Caption: *"Green checkmark on your profile = verified identity."*
**Copy:** `Verifying your X and Telegram accounts earns you the Verification Badge — a green checkmark on your public profile. It's completely optional but adds credibility.`
**Flow (X):**
1. In /manage, add your X link and click VERIFY.
2. Post a pre-formatted tweet from that account (we provide the text with a one-time token).
3. Come back and click "I've posted it" — we check the tweet, badge applies.
**Flow (Telegram):**
1. In /manage, add your Telegram handle and click VERIFY.
2. DM our Telegram auth bot (@LastShiftAuthBot) — it sends you a one-time code.
3. Paste the code back into /manage — badge applies.
**Note:** `Both verifications required for the full Verification Badge. One of two = partial badge.`

---

### 3.7 — Upgrading to paid / reactivating
**Visual:** `/wireframes/lastproof-upgrade-modal.html` — the Upgrade modal. Caption: *"Paid tier unlocks Grid visibility, tier progression, DEV badge."*
**Copy:** `Free profiles are limited — not findable on the Grid, no tier progression, no DEV badge, no proofs visible publicly. Upgrade to paid ($10/mo, $6 in $LASTSHFT) to unlock the full profile.`
**Flow:**
1. In /manage, click UPGRADE (or the upgrade prompt in the profile banner).
2. Pick a token ($LASTSHFT 40% off, SOL, or USDT).
3. Same paste-verify flow as proofs — copy address, send exact amount, paste TX.
4. Upgrade activates in 1-5 seconds via the Helius webhook.
**First 5,000 early-access note (green callout):** `If you're in the First 5,000, your profile is free until 30 days after Grid launch (May 2026). No payment needed yet — upgrade auto-charges only after the free window closes. Warning + Telegram reminder 3 days before.`
**Reactivating (after a downgrade):** same flow — pay, profile features come back instantly.

---

### 3.8 — Minting projects (paid feature — pin your best work)
**Visual:** `/wireframes/lastproof-mint-modal.html` — the Mint modal. Caption: *"Minted projects pin to the top of your profile."*
**Copy:** `Minted projects are your portfolio's greatest hits — the campaigns you're most proud of. Pinned to the top of your Proof of Work section, separate from recent work. Marked with a gold MINTED badge.`
**Cost:** `$1 per mint, same 3-token paste-verify flow.`
**Flow:**
1. In /manage → Proof of Work, find the work item you want to mint.
2. Click MINT on that card.
3. Pay in the Mint modal — pick token, send, paste TX.
4. Item gets the MINTED badge instantly, pins to top.
**Note:** `Minting is additive — it doesn't change the underlying work item or its proofs. You can mint a work item that has 0 proofs or 50 proofs. The MINT badge is purely curatorial — "I'm proud of this one."`

---

## TOPIC 4 — Profile Status {#topic-profile-status}

**Topic banner (orange eyebrow + pulse icon):** `TOPIC 04 · PROFILE STATUS`

**Topic intro (text-secondary):** `Your LASTPROOF profile lives in one of four states. Each state has different rules — what shows publicly, what you can edit, what you pay, and how to get to the next state. Here's the full map.`

---

### 4.0 — Status at a glance

**Visual (centered, mono, 4-column terminal table — stacks on mobile):**

```
STATE              COLOR        ON PROFILE CARD         PAYING?
─────────────      ────────     ───────────────         ────────
ACTIVE PAID        green        "ACTIVE" pill           yes — $10/mo (or $6 in $LASTSHFT)
FIRST 5,000 (EA)   gold         "EA" ribbon + pill      not yet — free until 30d post-Grid
FREE               silver       "FREE" pill             no — profile is view-limited
DEFUNCT            red          "DEFUNCT" pill          no — 90+ days no payment / activity
```

**Quick-read below the table (text-secondary):**
`ACTIVE PAID and FIRST 5,000 render the full profile. FREE and DEFUNCT render stripped-down versions. Upgrading brings everything back instantly — your data is never deleted.`

---

### 4.1 — ACTIVE PAID

**Visual:** `/wireframes/lastproof-profile-public.html` — full public profile. Caption: *"Everything on. This is what the Grid sees."*

**What it means:** `You're on a paid subscription in good standing. $10/mo or $6 in $LASTSHFT. Full feature access.`

**What shows publicly:**
- Full profile: avatar, handle, bio, pitch, categories
- Tier badge (TIER 1–4 based on proof count)
- HIRE button (green) — sends DM to your Telegram
- All work items + attached proofs
- DEV badge if any DEV Proofs exist
- Screenshots, links, verification badge (if X + TG verified)
- Appears on the Grid (post-launch May 2026), searchable by devs and teams

**What you can do:**
- Edit everything in /manage
- Receive proofs ($1 standard, $5 DEV — paid by the verifier, not you)
- Change your handle (fee — TBD)
- Mint projects ($1 each)
- Verify X + Telegram for the Verification Badge

**How to get here:** pay via /manage → UPGRADE PROFILE, OR get credited during the First 5,000 campaign.

**How to leave:** stop paying (lapses to FREE at subscription expiry), or don't log in for 90+ days (drops to DEFUNCT — see 4.4).

---

### 4.2 — FIRST 5,000 (EA — Early Access)

**Visual:** `/wireframes/lastproof-profile-5000.html` — full profile with gold EA ribbon + countdown. Caption: *"Full profile + gold early-access ribbon + countdown timer."*

**What it means:** `You claimed a spot in the First 5,000 campaign before the Grid launched. Your profile is Active Paid — but free until 30 days after Grid launch (2026-06-07).`

**What shows publicly:**
- Everything an ACTIVE PAID profile shows, PLUS:
- Gold EA ribbon / badge (`#ffd700`) — marks you as early
- FOMO countdown timer (post Grid-launch only, showing days until auto-conversion)

**What you can do:**
- Everything an ACTIVE PAID profile can do
- NO cost for the subscription (until 2026-06-07)
- Proofs, DEV proofs, handle changes, mints — at normal price (fees paid by the verifier, not you)

**How to get here:** claimed during campaign window (before 2026-05-08) while spots remained.

**How to leave:** don't pay by **2026-06-07** (30 days after Grid launch) → drops to FREE. Your URL, handle, bio, photo stay. Proofs + tier + DEV badge + Grid visibility go dark until you reactivate.

**Important timing callout (red):**
`> The 30-day free window starts at GRID LAUNCH (2026-05-08), not at the time you claimed. If you claim on 2026-05-01, your free window is NOT "May 1 through May 31" — it's "May 8 through June 7." You get 30 days from launch day. Plan accordingly.`

**Warning (orange):** `3 days before your EA window closes, we send a Telegram reminder via @LastShiftAuthBot + an in-app banner. Add a real Telegram handle to your profile so we can reach you.`

---

### 4.3 — FREE

**Visual:** `/wireframes/lastproof-profile-free.html` — stripped-down public view. Caption: *"Identity only. No tier, no Hire button, no proofs visible."*

**What it means:** `Your profile exists but isn't paying. Either never upgraded, or subscription lapsed and you're not in the EA window. View-limited publicly. Your data is never deleted.`

**What shows publicly:**
- Avatar, name, handle, bio, location/timezone, language
- **Hidden:** tier bar, HIRE button, proofs, DEV badge, screenshots, links, verification badge, Grid visibility

**What you can do (in /manage):**
- Edit bio, pitch, categories (always)
- View existing proofs internally — but the GET VERIFIED card is locked and no new proofs can be received
- Cannot change handle
- Cannot mint
- Can browse the Grid (when live) for free — you just can't be found on it

**Why "GET VERIFIED" is locked:**
`The proof system only runs on a paid profile. Free profiles can be seen, but they can't collect new proofs or show existing ones publicly. Upgrade to unlock the whole proof side.`

**How to get here:**
- Never upgraded past the wallet-connect step
- EA 30-day window closed without paying
- Active subscription expired and not renewed

**How to leave:** /manage → UPGRADE PROFILE → pay ($10/mo or $6 in $LASTSHFT). Subscription flips on instantly, hidden features return.

---

### 4.4 — DEFUNCT

**Visual:** `/wireframes/lastproof-dashboard.html` (crop showing the `.status-pill.defunct` red state). Caption: *"Red 'DEFUNCT' pill. 90+ days no payment + no login."*

**What it means:** `No paid subscription AND no account activity for 90+ days. Profile is dormant. Public view is minimal, and the inactive state is flagged on the dashboard.`

**What shows publicly:**
- Same as FREE (identity only)
- May additionally display a dim "DEFUNCT" marker on the profile card — signals to anyone landing on the URL that this operator isn't active. Keeps Hire DMs from going to abandoned accounts.

**What you can do:**
- Log in — any /manage access pulls you back to FREE state automatically
- Reactivate by paying via /manage → UPGRADE PROFILE — jumps you to ACTIVE PAID

**How to leave:**
- Log in → FREE
- Pay → ACTIVE PAID

**Important status callout (orange):**
`> Defunct is a liveness signal, not a punishment. Your profile, handle, bio, and historic proofs are ALL intact — we never delete. The state just tells visitors "this operator hasn't been around in a while" so they don't waste a Hire DM on someone who left the space.`

---

### 4.5 — State transitions at a glance (diagram)

**Visual (mono, terminal-style transition diagram):**

```
              [ new wallet ]
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
              └─────────────┘ ──── upgrade ──► ACTIVE PAID
```

---

### 4.6 — What each state costs

| State | Subscription | Handle change | Proofs (paid by verifier) | DEV proofs (paid by verifier) | Mint |
|---|---|---|---|---|---|
| ACTIVE PAID | $10/mo ($6 in $LASTSHFT) | $[X] | $1 | $5 | $1 |
| FIRST 5,000 | $0 until 2026-06-07 then $10/mo | $[X] | $1 | $5 | $1 |
| FREE | $0 (can't receive proofs) | locked | n/a | n/a | locked |
| DEFUNCT | $0 (reactivate to unlock) | locked | n/a | n/a | locked |

---

### 4.7 — Tier & Profile State interaction

**Callout (orange):**
`> Tier is a function of (paid state) × (proof count). A FREE profile with 100 proofs still has NO tier — tier is hidden until the profile is Active Paid. Tier isn't lost, it's hidden. Upgrade and it returns with the correct number based on your current proof count.`

**Tier ladder (reference, mono):**
```
TIER 1 · NEW          →  0+  proofs   silver
TIER 2 · VERIFIED     →  10+ proofs   bronze
TIER 3 · EXPERIENCED  →  25+ proofs   gold
TIER 4 · LEGEND       →  50+ proofs   purple
```

**Note:** `Tier is never shown as a bare number — always "TIER N · NAME." Internally there's a Tier 5 sentinel meaning "off the ladder" (not paid / not published) — you'll never see it in UI.`

---

## SECTION 6 — The Two Wallets (optional depth)

**Section heading:** `TWO WALLETS? HERE'S WHY`

**Intro:** `We respect how web3 actually works — most operators have multiple wallets.`

**Two-column explainer:**

### Terminal Wallet — your identity
`The wallet you connect to lastshift.app. This is your identity wallet — one Terminal ID per wallet. Use the wallet you're comfortable being recognized by.`

### Tool Wallet — who pays
`When you pay for a LASTPROOF subscription, mint a proof, or change your handle, you can pay from ANY wallet. It doesn't have to be your Terminal wallet. Use a burner, a treasury, whatever works.`

**Callout:** `The wallet gets you into the Terminal. The Terminal ID gets you into each tool. The tool wallet is just who's paying.`

---

## SECTION 7 — FAQ

**Section heading:** `FREQUENTLY ASKED QUESTIONS`

**Format:** accordion — question bold + orange "+", expanded answer below. First 3 open by default.

### Q: I don't have a Terminal ID. How do I get one?
Head to **lastshift.app** (the Terminal) and connect your Solana wallet. It auto-generates your Terminal ID in about 30 seconds — no email, no password, no KYC. Save the key, then come back here.
**Visual (inline thumbnail):** mini screenshot of the Terminal's key-gen screen (`/wireframes/screen2-key-generation.html`) showing the SHIFT-XXXX key. 240px wide, clickable → expands to full.
**CTA inline:** `LAUNCH TERMINAL →` (href: https://lastshift.app)

### Q: Why are there two websites? Why can't I just sign up on LASTPROOF?
Because LASTPROOF is one tool in a bigger suite. Same reason you don't sign up for Microsoft Word directly — you sign into Microsoft's system (Office 365), which gives you access to Word, Excel, PowerPoint, etc. One identity, many tools. The Terminal is our Office 365. LASTPROOF is our Word.

### Q: What's a Terminal ID, exactly?
A license key — formatted `SHIFT-XXXX-XXXX-XXXX-XXXX`. Think of it like a Windows product key. You paste it into each tool once to register, then it authenticates you automatically forever after. One key works for every tool in the LASTSHIFT suite.

### Q: Is it free?
Getting your Terminal ID is **free**. LASTPROOF itself: during the First 5,000 early-access campaign, your profile is **free until 30 days after the Grid launches (May 2026)**. After that, it's $10/mo ($6 in $LASTSHFT). Proofs cost $1 each (paid by the person vouching for you), DEV proofs cost $5.

### Q: I connected my wallet but the page says "Operator not found in local registry."
**Visual (inline):** a cropped thumbnail of the exact /manage error state (the one from Kellen's 2026-04-19 screenshot — the orange "New wallet detected [NO REGISTRY MATCH]" log lines). Makes it obvious this FAQ matches what the user is looking at.
That means your wallet hasn't been registered with a Terminal ID yet. You need to:
1. Go to **lastshift.app**, connect the same wallet, and get your Terminal ID.
2. Come back to this page and paste your Terminal ID.

### Q: Can I use a different wallet to pay than the one I use to log in?
Yes. Your Terminal wallet is your identity — it's how we know it's you. But when it comes to paying for subscriptions, proofs, or handle changes, you can pay from ANY wallet. Burner, treasury, whatever. Tools care about valid Terminal ID + any wallet sending a valid transaction.

### Q: I regenerated my Terminal ID in the Terminal. Now LASTPROOF rejects my old key.
**Visual (inline):** before/after thumbnail — left: the Terminal dashboard Terminal-ID card with REGENERATE button (from `/wireframes/screen3-dashboard.html`); right: the /manage re-auth prompt. Makes the cause-effect crystal clear.
That's by design. Regenerating invalidates your old key **instantly across all tools** — it's how you revoke a compromised key. Paste the new Terminal ID on lastproof.app/manage to re-authenticate.

### Q: I lost my Terminal ID. Can I recover it?
Connect the same wallet at lastshift.app — the Terminal dashboard shows your current ID. If you've lost the wallet too, you can't recover — your wallet is your identity. This is standard web3 custody.

### Q: What wallets are supported?
Phantom, Solflare, and Backpack. More coming.

### Q: What's the difference between a Proof and a DEV Proof?
**Visual (inline):** side-by-side — standard proof card vs DEV-badged proof card, pulled from the public profile wireframe (`/wireframes/lastproof-profile-public.html`). Users SEE the visual distinction: green check vs orange DEV shield.
- **Proof ($1)** — any collaborator, teammate, or community member vouches for your work on-chain.
- **DEV Proof ($5)** — a project's **deployer wallet** vouches for you. Cryptographically proven — the actual team verified your work. Earns you the DEV badge, the strongest trust signal on the platform.

### Q: Can I proof myself?
No. Self-proofing is blocked — the system compares the paying wallet against the profile's Terminal wallet. If they match, you lose the payment and no proof is awarded. Proofs only have meaning because someone ELSE vouches for you.

### Q: Do I need to connect my wallet to submit a proof?
**No.** As of V3 (shipped April 2026), proofs are wallet-free. You just open your Solana wallet (Phantom, Solflare, Backpack), send the exact amount to the address shown, paste the transaction signature into the modal, and you're done. No wallet connect popups, no signing prompts on lastproof.app itself. Works on any browser, any device.

### Q: How long does proof verification take?
**1-5 seconds** in the normal case. We run a Helius webhook that watches incoming transactions to our treasury and credits them immediately. If the webhook is slow or misses, a cron fallback picks it up within 60 seconds. Either way — no refresh needed, the modal updates itself.

### Q: I sent the payment but nothing happened. What went wrong?
Most common causes:
- **Wrong amount.** Must be exact to the cent. $1.00 not $1.01.
- **Wrong token.** Only $LASTSHFT, SOL, or USDT. USDC is not supported.
- **TX before modal opened.** Anti-scam protection — the transaction must be timestamped AFTER you opened the proof modal.
- **Self-proof.** You paid from the profile owner's own Terminal wallet — auto-rejected.
- **Duplicate.** You already proofed this specific work item with this wallet (1 wallet = 1 proof per work item).

If none of those apply, DM us with the transaction signature and we'll investigate.

### Q: I picked "Dev" but I'm not the deployer — what happens?
You lose the payment. The post-payment check compares the sending wallet against the project's actual deployer wallet on-chain. No match = no proof, no refund. Only pick Dev if you're actually the deployer.

### Q: Can two different people proof the same project for the same operator?
Yes — multiple people can each drop a proof on the same work item. The operator's proof count goes up by one per person. **But:** the same wallet can only proof the same work item once (1 wallet = 1 proof per work item). So you can't stack proofs with one wallet.

### Q: I can't find a way to "submit a proof." Where is the button?
Proofs are submitted on the **public profile** of the person you're vouching for — not on your own profile. Go to `lastproof.app/@theirhandle`, scroll down to "Proof of Work," find the specific project card you worked on with them, and click **VERIFY THIS WORK**.

### Q: How do I get proofs on my own profile?
Share your `lastproof.app/@you` link with past collaborators, teammates, and project teams. Ask them directly. Be specific — point them to the exact work item ("the $BONK raid campaign card from August"). $1 for them isn't much, especially when most people are happy to back up someone they've actually worked with. See the "How to Collect Proofs" section above for 4 tactics that work.

### Q: I'm on Android and Phantom keeps opening LASTPROOF inside its in-app browser — I'm stuck.
This is a known Phantom-on-Android issue — it hijacks links into its built-in browser, which traps you inside the wallet app. **The V3 paste-verify flow is designed to work around this exactly.** You don't need to stay on lastproof.app while paying — just:
1. In Phantom's browser, open the proof modal and copy the destination address + exact amount.
2. Switch back to the Phantom wallet view and send from there.
3. Copy the TX signature.
4. Return to the LASTPROOF tab and paste the signature. Done.
No wallet connect, no deep-linking popup. Works even inside the Phantom IAB.

### Q: I approved a payment in Phantom but it took a while and now it says "blockhash expired" / "transaction failed."
Solana transactions have a ~60-90 second window before the blockhash expires. If you took too long to review and approve in Phantom, the blockhash died and the broadcast failed. The **transaction was never sent** — you weren't charged.
**Fix:** Close the proof modal and start over. Be quick when approving — Phantom's review screen has all the info you need.

### Q: Phantom says "This dApp could be malicious" when I try to pay. Should I panic?
No. That's a cosmetic warning Phantom shows for any domain that hasn't been manually verified with their team. It doesn't mean anything is wrong — it just means we haven't submitted for Phantom's verified-domain list yet. You can safely proceed; the transaction is standard.

### Q: I sent to the address but used the wrong token (or wrong amount). What now?
- **Wrong amount:** Must be exact to the cent — $1.00, not $1.01 or $0.99. The webhook matches exactly; mismatch = no proof credited. **Funds aren't lost** — they're in our treasury. DM support with the TX signature and we'll manually credit or refund.
- **Wrong token:** USDC is not supported. If you sent USDC (or another token), same deal — DM support. Don't resend a second TX hoping it'll work; open a ticket first.

### Q: I don't see LASTPROOF as a tool in my Terminal dashboard — only the "LAUNCH LASTPROOF" button is missing.
If LASTPROOF doesn't appear in the sidebar of lastshift.app, refresh once. If it's still missing, your wallet may not have completed Terminal ID issuance. Disconnect and reconnect in the Terminal — that triggers re-provisioning. If it still doesn't show up, contact support with your wallet address (first 4 + last 4).

### Q: My profile shows "DEFUNCT." What does that mean?
You haven't paid AND you haven't logged in for 90+ days. It's a liveness flag — not a ban. Your data, handle, bio, and past proofs are all intact. Log into /manage (pulls you back to FREE), then upgrade to return to ACTIVE PAID.

### Q: My First 5,000 profile just expired and dropped to FREE. Can I get my tier back?
Yes. Pay the subscription ($10/mo or $6 in $LASTSHFT) from /manage and everything comes back instantly — tier, DEV badge, Grid visibility, proofs. Your proof count never resets, only its visibility.

### Q: When exactly does my First 5,000 free window end?
**2026-06-07** — 30 days after the Grid launches on 2026-05-08. The clock starts at Grid launch, NOT at the time you claimed your spot. Whether you claimed in February or the day before Grid launch, you get 30 days from May 8. Plan accordingly.

### Q: I got a Telegram message from @LastShiftAuthBot about my First 5,000 profile expiring. Is this real?
Yes. 3 days before your EA free window closes, we send a reminder via @LastShiftAuthBot. If you have a Telegram handle on your profile, it goes to that. If not, we can only nudge via the in-app banner. **Add a Telegram handle to your profile now if you want the reminder.**

### Q: Why does my free profile look so empty compared to other profiles?
Free profiles are deliberately stripped-down to encourage upgrading. You see only identity (avatar, handle, bio) — no tier, no proofs, no HIRE button, no DEV badge, no Grid visibility. It's not a penalty; it's the free tier. Upgrade to unlock everything — your existing data instantly renders fully.

### Q: I was on ACTIVE PAID but now I'm FREE. What happened?
Your subscription expired. The system checks each day for lapsed subscriptions and flips them to FREE. You were NOT charged again — billing is manual (pay-to-extend, not auto-renew). Renew from /manage when you're ready; all features return.

### Q: Can a view counter say I have 0 views forever?
Known issue: view counts aren't currently incrementing on page load. Doesn't mean no one's looking — just that the counter isn't wired up yet. This will be fixed; don't interpret 0 as "nobody cares."



### Q: What's $LASTSHFT and do I need it?
$LASTSHFT is the ecosystem's native token. You don't need it — SOL and USDT work too. But paying with $LASTSHFT gets you **40% off** everything. 25% of every transaction in $LASTSHFT, SOL, or USDT is permanently burned from the supply.

### Q: Why don't you accept USDC?
We support SOL, USDT, and $LASTSHFT. USDC is intentionally not supported at this time.

### Q: Do you store my wallet's private keys? My email?
**No.** We never see your private keys — wallet signing happens in your wallet app, not on our servers. We don't collect email by default. Your handle and profile metadata are the only identifiers we store.

### Q: What if I just want to browse profiles, not create one?
You don't need a Terminal ID for that. The Grid (launching May 2026) is **free to browse**. Click through profiles, click Hire on anyone — no login, no account, no fees.

### Q: How do I hire someone?
On any profile, click the **Hire** button. It sends a DM directly to the operator's Telegram. No platform fee on the connection. No middleman.

### Q: Is my profile permanent if I stop paying?
Your URL stays. Your handle, bio, and photo stay. But when you go off the paid tier, your **proofs, tier, DEV badge, and Grid visibility go dark** until you reactivate. Your data is never deleted.

### Q: Can I change my handle?
Yes — there's a Handle Change flow in /manage. Small fee. Your old handle is released back to the pool after 30 days.

### Q: I'm stuck / something's broken. How do I get help?
Reach out via [Telegram TBD] or email [support TBD]. Include your wallet address (first 4 + last 4) so we can look up your account without asking for the full string.

---

## SECTION 8 — Still Stuck? Contact

**Section heading:** `STILL STUCK?`

**Body (text-secondary):** `If none of the above fixed your issue, reach out. Include your wallet address (first 4 + last 4) so we can find your account without you typing the whole thing.`

**Two-column contact card:**

### Left — Telegram support
**Label:** `TELEGRAM`
**Handle:** `@[TBD]`
**Hint:** `Fastest. Usually under 1 hour.`
**CTA:** `OPEN TELEGRAM →`

### Right — Email support
**Label:** `EMAIL`
**Address:** `help@lastshift.ai` *(or TBD — confirm with Kellen)*
**Hint:** `Best for long descriptions. 24h response.`
**CTA:** `SEND EMAIL →`

**Fallback link below the card:** `Or DM @LastShiftAI on X →`

---

## SECTION 8.5 — Final CTAs (secondary, after contact)

**Section heading:** `READY TO GO?`

**Two-column CTA block:**

### Left column — "I'm new here"
**Heading:** `Need a Terminal ID?`
**Body:** `Start at the Terminal. Connect your wallet, get your key, come back. 30 seconds.`
**CTA:** `LAUNCH TERMINAL →` (orange primary button, href: https://lastshift.app)

### Right column — "I have a Terminal ID"
**Heading:** `Already have your key?`
**Body:** `Head to /manage, paste your Terminal ID, and start building your profile.`
**CTA:** `GO TO /MANAGE →` (green secondary button, href: /manage)

---

## SECTION 9 — Footer

**Standard LASTSHIFT footer:**
- `LASTPROOF by lastshift.ai`
- Links: Terms · Privacy · X · Telegram
- `25% burn on every transaction` tagline

---

## Design Notes for Frontend Builder

- **Chrome:** match /manage — full terminal chrome (system bar, titlebar "how-it-works — lastproof — 80x24", scrollable body, bottom bar). CRT scanlines + vignette.
- **Typography:** Inter for body/paragraphs, JetBrains Mono for labels/stack diagrams/Terminal IDs/code.
- **Colors:** orange (#ff9100) for primary CTAs and accents, green (#00e676) for checks/secondary confirmations, red (#ff5252) reserved for error states only.
- **Motion:** subtle only — fade-in on scroll per section, accordion on FAQ. No autoplay, no parallax.
- **Mobile-first:** all cards stack, accordion closed by default on mobile, Terminal ID key display shrinks to fit.
- **Accessibility:** `<details>`/`<summary>` for FAQ (works without JS), aria-labels on `?` icon links from other pages, sufficient contrast on all text (existing tokens pass).
- **Link target:** external Terminal CTAs (`lastshift.app`) open in `target="_blank"` with `rel="noopener"`. Internal `/manage` stays same-tab.
- **SEO:** emit FAQ JSON-LD from the Q&A. Page should rank for "how does lastproof work" and "what is a terminal id lastshift".

---

## Visual Assets Inventory

Every visual on this page pulls from an existing wireframe or a real UI screen we already built. No stock imagery, no mockups that don't match reality. If the screen is in the product, its screenshot goes here.

| # | Where on the page | Source wireframe / UI | What to show | Treatment |
|---|---|---|---|---|
| V1 | Section 2 — The Stack | N/A — custom diagram | Two-column side-by-side: Microsoft stack vs LASTSHIFT stack, arrows between tiers | Mono typography, terminal-style box drawing |
| V2 | Section 3 — LASTSHIFT TERMINAL card | `/wireframes/screen3-dashboard.html` | Zoomed-out preview of Terminal dashboard | 320px wide, 1px border, hover: subtle orange glow |
| V3 | Section 3 — LASTPROOF card | `/wireframes/lastproof-profile-public.html` | Zoomed-out preview of a populated public profile | Same treatment as V2 |
| V4 | Section 4 — Terminal ID key display | Rendered inline (not a screenshot) | Large mono `SHIFT-XXXX-XXXX-XXXX-XXXX` with segment separators highlighted in orange | Matches the exact key typography from screen2-key-generation |
| V5 | Step 01 — Open the Terminal | `/wireframes/screen1-launch-terminal.html` | Full screenshot of cold-boot wallet-connect screen | Browser chrome frame with `lastshift.app` in URL bar |
| V6 | Step 02 — Receive your Terminal ID | `/wireframes/screen2-key-generation.html` | Key-gen ceremony mid-generation (partial key visible) | Browser chrome frame, Terminal titlebar visible |
| V7 | Step 03 — Launch LASTPROOF | `/wireframes/screen3-dashboard.html` | Dashboard with LAUNCH LASTPROOF button highlighted via orange pulse/arrow | Browser chrome frame, sidebar visible |
| V8 | Step 04 — Register on LASTPROOF | Split: `/wireframes/lastproof-onboarding.html` + Kellen's /manage screenshot (2026-04-19) | Before: paste-Terminal-ID state. After: fresh dashboard. | Two browser chrome frames side-by-side with "→" between |
| V9 | Step 05 — Share your link | `/wireframes/lastproof-profile-public.html` | Full public profile, scrolled to show handle URL, tier badge, proof count | Browser chrome frame, URL bar shows `lastproof.app/@cryptomark` |
| V10 | FAQ — "I don't have a Terminal ID" | `/wireframes/screen2-key-generation.html` crop | Just the key-gen section, compact thumbnail | 240px wide, clickable → expands |
| V11 | FAQ — "Operator not found" error | Kellen's screenshot (2026-04-19, /manage error state) | The exact orange error log section cropped out | 240px wide |
| V12 | FAQ — Regenerated key rejection | Dashboard TERMINAL-ID card + /manage prompt | Before/after composite | 2×240px |
| V13 | FAQ — Proof vs DEV Proof | `/wireframes/lastproof-profile-public.html` | Two proof card examples side-by-side | 2×200px cards |

**Capture protocol (for the frontend builder):**
- Use Playwright/Puppeteer on the actual HTML wireframes at 1440×900 → crop/scale as needed. Avoids manual drift.
- Export as WebP (primary) + PNG (fallback). 2x retina.
- Lazy-load below the fold.
- Each screenshot is clickable → opens a full-size lightbox.
- Alt text is mandatory and descriptive (not "screenshot" — say what the image shows).
- Store in `/public/how-it-works/` with semantic filenames (e.g. `step-02-terminal-id-keygen.webp`).

## Open Questions for Kellen

1. Confirm the Telegram support handle + support email for the final FAQ entry.
2. Confirm the `lastshift.ai` destination for the "ecosystem card" — is there a dedicated /stack page there we should deep-link, or just the homepage?
3. Should the FAQ include a "What's the First 5,000 campaign?" entry, or keep that separate on the existing 5,000 landing page?
4. Do we want a "Last updated" timestamp at the bottom? (Useful for trust, but adds a maintenance step.)
5. **Handle change cost** — confirm the price (shown in the HandleChangeModal). I've left it as `$[X]` in sub-topic 3.5 and the Topic 4 cost table.
6. **Topic hub as single page vs sub-pages?** — currently spec'd as one page with scroll-jump to each topic. If topics grow more content, we may want `/help/profile-creation`, `/help/verify-this-work`, `/help/updating-my-profile`, `/help/profile-status` as sub-routes. Confirm whether to design for this split now or leave as one page.
7. **Sub-topic screenshots (Topic 3)** — several of the "Updating My Profile" sub-topics reference `/wireframes/lastproof-dashboard.html` but that dashboard may not have every editing affordance I described. Before the wireframe phase, confirm which sub-sections exist in the live dashboard vs need to be added.
8. **Defunct state — exact definition** — our research surfaced the 90-day rule from your message and the `.status-pill.defunct` CSS but I did not find a formal documented transition rule (cron job, schedule, etc.). Confirm:
   - Trigger: 90+ days AND no payment AND no login — correct?
   - Does logging in alone exit Defunct, or is payment required?
   - Is the dormant indicator shown on the public profile page itself, or only on the owner's dashboard?
9. **Reactivation from Defunct** — does a simple login pull profile back to FREE, or does it stay DEFUNCT until reactivation via payment? The doc currently says "log in → FREE"; confirm.
10. **Known bugs surfaced in research** — these affect the FAQ. Confirm whether we acknowledge them in the Help page or wait for fixes:
    - Profile view counter always shows 0 (increment RPC not wired up)
    - Handle change payment not yet fully on-chain verified
    - Proofs table missing `payer_wallet` column → dedup gap (same wallet can double-proof a work item)
    If these are getting fixed soon, leave them out of the FAQ. If they'll linger, the current transparent FAQ copy is the honest move.
