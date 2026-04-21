# LASTPROOF Updates — Backfill Proposal

**Scope:** 2026-04-08 (git init) through 2026-04-20
**Source commits:** 281 total → clustered to 42 user-facing entries
**Version range:** V0.0.0 (launch) → V0.6.2 (current head)
**Reserved:** V1.0.0 for Grid launch on 2026-05-08
**Status:** DRAFT — awaiting approval. Each entry shows source commits so you can trace back.

**Voice rules applied:** 1–3 sentences, App Store tone, no jargon (no "schema," "API," "commit," "migration"), focus on what the user feels, not what the code does.

**Skipped entirely:** WORKLOG entries, protocol codification, iCloud cleanup, pure observability/logging internals, dev-only toggles, deployment triggers, reverted changes (added then removed same day), pre-launch scaffolding (most of Apr 8–9).

**Versioning logic:** MAJOR.MINOR.PATCH. **MAJOR=0 throughout this backfill** — LASTPROOF is pre-launch until the Grid goes live (2026-05-08), at which point MAJOR bumps to 1 as the externally-communicable milestone (`V1.0.0 — The Grid is live.`). MAJOR bumps are reserved for that kind of external milestone and are never triggered by regular commits. MINOR bumps on meaningful new user-facing features (`[update: added]`). PATCH bumps on fixes + improvements (`[update: fixed]`, `[update: improved]`).

**V0.0.0 = 2026-04-10**, the initial shippable build — the day LASTPROOF became a product rather than scaffolding. **V0.1.0 = 2026-04-11**, the first post-launch feature (Android Phantom wallet support). **Current head: V0.6.2** (2026-04-18, mobile wallet return resume). From V0.6.3 onward, future `[update: X]` commits drive version bumps automatically.

---

## Newest first

---

### V0.6.2 — 2026-04-18 — `[improved]`
**Mobile wallet returns now resume where you left off.**
Switching to your wallet app during a payment or proof no longer loses your spot. When you come back to LASTPROOF, you'll pick up exactly where you were — no restart, no re-entering details.
*Source: d04e9e9*

---

### V0.6.1 — 2026-04-18 — `[fixed]`
**Ambassador referrals now track correctly from the very first sign-in.**
If you were referred to LASTPROOF by a Terminal ambassador, your profile is linked to them the moment you land — no lost attribution, no missing credit.
*Source: 67fc011, adca9f1*

---

### V0.6.0 — 2026-04-16 — `[added]`
**Proof modal now checks your wallet's dev eligibility *before* you pay.**
No more spending to find out you don't qualify. You'll see a clear yes/no up front, with the exact reason if it's a no.
*Source: 3fc41bb*

---

### V0.5.3 — 2026-04-16 — `[improved]`
**Public profiles now show every proof, not just the first five.**
Visitors can scroll through your full work history without clicking through. Longer careers, longer feeds — no artificial cap.
*Source: 0abae83*

---

### V0.5.2 — 2026-04-15 — `[fixed]`
**Work item dates save reliably when you enter just a month and year.**
Editing a project with a date like "Mar 2026" no longer throws an error. Whether you enter a full date or month-only, it saves cleanly.
*Source: 9255503*

---

### V0.5.1 — 2026-04-15 — `[fixed]`
**Treasury address copy button now works cleanly.**
Copying the treasury address no longer picks up surrounding whitespace, and clicking COPY no longer highlights random page text.
*Source: a04e3ae*

---

### V0.5.0 — 2026-04-15 — `[improved]`
**Work items now sort by date automatically.**
We removed the manual drag-to-reorder step — your proofs appear newest-first everywhere, on the dashboard and on your public profile. One less thing to manage.
*Source: 1955ba0*

---

### V0.4.4 — 2026-04-14 — `[improved]`
**Share your profile straight from the name bar.**
The share icon moved from the topbar to sit right next to your @handle on the public profile, where visitors actually expect it.
*Source: 2fadfdd, 4c5f59a*

---

### V0.4.3 — 2026-04-14 — `[improved]`
**Clearer helper text on the Pitch and About Me fields.**
Reworded and brightened the hints on your dashboard so it's obvious what to put where.
*Source: 605a6b1*

---

### V0.4.2 — 2026-04-14 — `[added]`
**Report inappropriate claims at reportclaims@lastshift.ai.**
A dedicated inbox for flagging fake or misleading proofs on any profile.
*Source: db319bb*

---

### V0.4.1 — 2026-04-14 — `[added]`
**New landing page: /earlyaccess.**
A general-marketing destination for the platform, separate from the campaign and ambassador pages.
*Source: 9540bae, fe949d6*

---

### V0.4.0 — 2026-04-14 — `[added]`
**How It Works now explains Verify This Work.**
A new third tab on /how-it-works walks you through the proof-verification flow — what verifiers see, how disputes work, and why the trust tier matters.
*Source: f7a78f8, 763dfe8, d0a99fd, 3ce08a9*

---

### V0.3.9 — 2026-04-13 — `[added]`
**In-app browser warning banner.**
Opening LASTPROOF inside Telegram, Instagram, or Twitter's in-app browser now shows a banner with a one-tap "copy link" — wallets don't work in those browsers, so we route you out cleanly.
*Source: dc160af*

---

### V0.3.8 — 2026-04-13 — `[added]`
**Mint + Handle Change now use paste-to-verify — no wallet connect required.**
The same frictionless flow that powers proofs now works for paying to mint and paying to change your @handle. Send the transaction from any wallet, paste the signature, done.
*Source: 7792c17, c479e60, df1fb81, 8b476a4*

---

### V0.3.7 — 2026-04-13 — `[improved]`
**Modals share a consistent visual language.**
The proof, mint, and handle-change modals now match the onboarding design — same spacing, same colors, same feel across every paid action.
*Source: 0800506, 2196bbf, 8523049, ca1030f*

---

### V0.3.6 — 2026-04-13 — `[improved]`
**Work item dates now display as "Mar 2026" instead of raw ISO strings.**
Cleaner reading on public profiles, no more `2026-03-15T00:00:00Z` leaking through.
*Source: 7bc1bc6*

---

### V0.3.5 — 2026-04-13 — `[improved]`
**Work items now sort newest-first on public profiles.**
Matches the dashboard order and the way most people read timelines.
*Source: 310672d*

---

### V0.3.4 — 2026-04-13 — `[improved]`
**Cleaner timezone picker.**
We stripped city and country names — you'll see the UTC offset only, which is what actually matters.
*Source: 9864115*

---

### V0.3.3 — 2026-04-13 — `[improved]`
**Payment modals now cover the full screen on mobile.**
No more dashboard bleeding through the corners of the modal on smaller devices.
*Source: 33fa1e7, ff72ec2, b0b3257*

---

### V0.3.2 — 2026-04-13 — `[improved]`
**Logo and wordmark in the topbar now link back to the homepage.**
Click anywhere on the brand to go home, the way every other site works.
*Source: 280b533*

---

### V0.3.1 — 2026-04-13 — `[fixed]`
**Dev verification now correctly checks the original mint authority.**
The verify flow looks at your wallet's full history with the token, not just current holdings, so legitimate launch-wallet devs qualify reliably.
*Source: 3f7286a, 5e053d6, 30ca999*

---

### V0.3.0 — 2026-04-13 — `[added]`
**Site is discoverable: SEO, sitemap, social cards, and analytics.**
Google can now index LASTPROOF properly, link previews on X and Telegram show a real card, and we can see which pages get traffic.
*Source: d5ec54c, bd00a4f, 6cfb8ea*

---

### V0.2.9 — 2026-04-12 — `[improved]`
**Token picker in the proof modal now shows token logos.**
Faster to spot SOL vs USDT vs $LASTSHFT at a glance.
*Source: 93b7dac*

---

### V0.2.8 — 2026-04-12 — `[improved]`
**Live conversion rates on the payment screen.**
The amount-to-send now updates in real time using live Raydium and Jupiter price feeds, so the number you paste into your wallet matches what your wallet will charge.
*Source: b06b421, 99f6973*

---

### V0.2.7 — 2026-04-12 — `[fixed]`
**Tier progress bar now fills within the right segment.**
The bar used to show progress toward the *final* tier — it now fills within your *current* tier, which is what people actually want to see.
*Source: 9666f20, d66de17*

---

### V0.2.6 — 2026-04-12 — `[fixed]`
**Five smaller fixes across the profile and dashboard.**
- Comments now render correctly on public profiles
- Tier math edge cases cleaned up
- "Past projects" section displays correctly
- Animated dot indicators no longer jitter
- Dashboard proof counts fixed for paste-verified proofs
*Source: b4fd7b2, ad6e041, 234fec6*

---

### V0.2.5 — 2026-04-12 — `[improved]`
**Work items capped at 6, proofs at 10 — with expand buttons.**
Cleaner first view of any profile, with a one-click way to see everything.
*Source: 3f95f22*

---

### V0.2.4 — 2026-04-12 — `[improved]`
**Gold glow on the VERIFY THIS WORK button.**
Makes it unmistakable where the action is on a public profile.
*Source: 3730fb4*

---

### V0.2.3 — 2026-04-12 — `[improved]`
**Profile automatically reloads after minting a proof.**
"Back to Profile" now shows the fresh proof count and updated tier without a manual refresh.
*Source: d6543ab*

---

### V0.2.2 — 2026-04-12 — `[improved]`
**Android wallet sign-in flow is more reliable.**
Multiple rounds of fixes to mobile wallet authorization on Android — the handshake no longer hangs or races, and stale sessions get cleared automatically.
*Source: 6ac8c76, d8bf55c, 12cb54c, 2ec63eb, 335b2cb, 4444e96*

---

### V0.2.1 — 2026-04-12 — `[fixed]`
**Payment confirmation screen no longer crashes on narrow terminals.**
The animated terminal readout on Screen 5 is now safe against missing data and timing edge cases.
*Source: f2b6207, fdd897b, 73603bc, 915c4b5*

---

### V0.2.0 — 2026-04-12 — `[added]`
**Proof Flow V3: paste-to-verify — no wallet connect required.**
The biggest single improvement we've shipped. Send payment from any wallet, paste the transaction signature, and your proof verifies instantly via a webhook. No wallet connect, no 60-second wait, no mobile wallet headaches.
*Source: a201574, 37fb831, 376520c, 4c1ce78*

---

### V0.1.8 — 2026-04-11 — `[fixed]`
**Subscription cron no longer accidentally downgrades Early Access profiles.**
First-5000 profiles stay First-5000 until you choose otherwise.
*Source: cca0572*

---

### V0.1.7 — 2026-04-11 — `[improved]`
**HIRE button falls back to your verified Telegram handle.**
If a visitor clicks HIRE and you haven't set X, we point them to your Telegram instead of leaving them stuck.
*Source: 95b269e*

---

### V0.1.6 — 2026-04-11 — `[added]`
**Ambassador landing pages.**
Dedicated pages for Terminal ambassadors to share with their audience, with stats and attribution built in.
*Source: dfa2e92*

---

### V0.1.5 — 2026-04-11 — `[improved]`
**Tier badge colors now match the tier everywhere.**
Silver for TIER 1 · NEW, bronze for TIER 2 · VERIFIED, gold for TIER 3 · EXPERIENCED, purple for TIER 4 · LEGEND. Consistent across public profiles, dashboard, and Trust Tier cards.
*Source: 67b7f9f, 8429249*

---

### V0.1.4 — 2026-04-11 — `[improved]`
**Links tabs now filter by platform.**
Click the X or Telegram tab on your profile's Links section and you'll see only the links for that platform.
*Source: 2e7dec6, 27972c4*

---

### V0.1.3 — 2026-04-11 — `[fixed]`
**Six smaller fixes in one pass.**
- Paste into Previously Known As no longer strips whitespace
- Pinning links shows a clear visual confirmation
- Clicking a pinned link works in all contexts
- Screenshot thumbnails load reliably
- Work item dates parse correctly
- Handle history shows the full trail
*Source: 0e8de72, ad0976a*

---

### V0.1.2 — 2026-04-11 — `[added]`
**First-5000 profiles auto-publish on campaign claim.**
Claim a 5K slot and your profile goes live immediately — no extra publish step.
*Source: 3587f4d, eea0b74*

---

### V0.1.1 — 2026-04-11 — `[improved]`
**Telegram login now uses the official Login Widget.**
Cleaner sign-in flow that works reliably on mobile, including inside in-app browsers where the old popup broke.
*Source: faf0cac, 2859a51, 9bf97d5, face91d, d8607f5*

---

### V0.1.0 — 2026-04-11 — `[added]`
**Phantom wallet now works on Android.**
Android users can connect their Phantom wallet and mint proofs end-to-end. Full mobile wallet adapter integration with a guided 9-screen flow.
*Source: 157eca6, 1c0a379, b371f23, f55740f*

---

### V0.0.3 — 2026-04-10 — `[improved]`
**SHIFTBOT can now rewrite your Pitch and About Me fields.**
Click the SHIFTBOT button on any long-form field to get an AI-polished version, instantly. Keep the tone, fix the structure.
*Source: 994ec22*

---

### V0.0.2 — 2026-04-10 — `[added]`
**Screenshot gallery with lightbox view.**
Upload up to six screenshots per work item — visitors can click any thumbnail to view it full-size without leaving your profile.
*Source: 852c8fa*

---

### V0.0.1 — 2026-04-10 — `[added]`
**Profile view counter.**
Your dashboard now shows how many times your public profile has been viewed, counted fresh on every page load.
*Source: c1e2c04*

---

### V0.0.0 — 2026-04-10 — `[added]`
**LASTPROOF is live.**
The first shippable build. What's in it:
- Public profiles with the tier system (TIER 1 NEW → TIER 4 LEGEND) based on on-chain minted proofs
- The FIRST 5,000 campaign — claim a free premium slot while supply lasts, with a live counter and badge
- Onboarding flow: claim a handle, add your first proofs, publish
- Dashboard: identity, pitch, about me, work items, screenshots, links, categories
- Proof verification modal (first version)
- 16 supported languages including Tagalog, Hindi, Indonesian, and Thai
- Wallet connect, X and Telegram authentication
- Subscription at $10 / 30 days, handle changes at $100 USD
- **Pay in $LASTSHFT for 40% off every paid action** — subscription, handle change, mint, proof. Discount wired through the entire payment pipeline from day one.
*Source: the whole Apr 8–10 window, anchored by 98d7cb4, 86bdee5, 746dc3e, 4068095, e563375, 07cb73b, 28e884b, ec847c6, e32288b, and roughly 90 others.*

---

## Skipped (internal, not user-visible)

The following categories of commits were filtered out:

- **Protocol / docs:** all Apr 20 session protocol work, WORKLOG entries, CLAUDE.md updates
- **Help wireframe:** /help isn't live yet — will be its own V0.x.0 entry when it ships
- **Pure observability:** debug logging, Sentry (later reverted), event loggers
- **Deployment triggers:** "Trigger redeploy" commits, env var cleanup on Vercel
- **Reverted same day:** Security headers → reverted (5bdb130), Sentry → reverted (d4016fd), X OAuth twitter→x → reverted (cb0fc1a), Maintenance gate → removed (1c7ef5d)
- **Dev-only:** hidden eligibility toggle, health endpoint, admin API endpoints
- **Pre-launch scaffolding:** Apr 8–9 store adapters, proof modal component plumbing, backend specs
- **Internal cleanup:** .next 2/ file removal, env var renames, iCloud drift fixes
- **Ambassador `THE REALITY` section:** (a055925) — copy change on an internal landing variant, doesn't belong on the Updates feed

---

## Clustering notes for your review

A few places where I merged what git sees as separate commits into one user-facing entry — flagging so you can split back out if you disagree:

- **V0.1.0 (Android Phantom):** four commits combined into one "Android wallet support shipped" entry because from the user's perspective it was one feature arriving.
- **V0.2.0 (Proof Flow V3):** four commits combined — paste-verify, instant webhook verification, and the Android MWA removal (since paste-verify replaced it) are one conceptual shift.
- **V0.2.2 (Android wallet reliability):** six fix commits across one day — users only care that "mobile wallet got more reliable," not that it took six attempts.
- **V0.1.1 (Telegram auth):** five commits consolidating the Telegram sign-in architecture — shipped incrementally but reads as one thing.
- **V0.0.0 (launch):** ~90 commits rolled up. Listing every initial-build feature would read as a war diary; the bulleted summary captures what a user would feel on day one.

If you want any of these split into multiple version entries instead, tell me which and I'll break them out.

---

## What happens after you approve

1. Entries become `updates.json` — one record per entry with `{version, date, category, headline, copy, source_commits}`
2. The `/status` page (built from the wireframe) reads that file
3. The "View All" archive page groups them by month
4. **From V0.6.3 onward, everything goes through the Groq + GHA pipeline** — no more hand-writing. These backfilled entries are the one-time seed.
