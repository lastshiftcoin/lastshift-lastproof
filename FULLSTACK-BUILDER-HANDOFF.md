# LASTPROOF — Full-Stack Builder Handoff (2026-04-11)

**Product:** lastproof.app — Web3 operator verification platform on Solana
**Live URL:** https://lastshift-lastproof.vercel.app
**Repo:** https://github.com/lastshiftcoin/lastshift-lastproof
**Stack:** Next.js 16 App Router, React 19, Supabase, Solana, TypeScript
**Dev port:** 3001 (Terminal uses 3000 — do not collide)

---

## WHO YOU'RE WORKING WITH

The user is the sole operator of LASTSHIFT. They relay between multiple AI builder sessions (frontend, terminal, backend). They are not a developer — they are the architect and product owner.

### Non-negotiable rules

1. **No patches.** Trace the full data flow before writing any fix. Grep the entire codebase for the same broken pattern. Fix ALL instances, not just the one that errored. Code for 100K concurrent users.
2. **Do work before replying.** Execute the backend work first, then draft the relay message. Never promise work in a reply — do it, then report.
3. **Check before asking.** Search memory, env files, code, and shared docs before asking the user for ANY information. They have already told you once.
4. **No quick fixes.** No band-aids, no temporary workarounds, no "we can fix this later." Core solutions only.
5. **No unnecessary additions.** Don't add docstrings, comments, type annotations, or refactoring to code you didn't change. Don't add features beyond what was asked.

---

## ARCHITECTURE — THE GROUND TRUTH

### Source of truth hierarchy

1. **Wireframes** (`wireframes/*.html`) — visual + functional canon. When anything disagrees with wireframes, wireframes win.
2. **CLAUDE.md** — architectural anchor (tier system, store architecture, priorities)
3. **LASTPROOF-BUILDER-HANDOFF.md** — wireframe-to-route mapping, design tokens, brand rules
4. **This document** — current state, pending work, known issues

### Tier system (LOCKED — do not modify)

| Tier | Name | Proof threshold | Color |
|------|------|-----------------|-------|
| TIER 1 | NEW | 0+ | silver `#9ca3af` |
| TIER 2 | VERIFIED | 10+ | bronze `#cd7f32` |
| TIER 3 | EXPERIENCED | 25+ | gold `#ffd700` |
| TIER 4 | LEGEND | 50+ | purple `#a78bfa` |

- Internal sentinel `5` = unpaid/unpublished (free variant, never rendered as a word)
- Tier is always shown as `TIER N · NAME`, never the number alone
- Computed by `src/lib/tier.ts` → `computeTier()` — pure function, zero I/O
- Free profiles show no tier section at all (free-variant wireframe strips it)

### Key identity concepts

- **operator_id** = UUID in `operators` table. Internal primary key.
- **walletAddress** = Solana pubkey string. Stored as `terminal_wallet` in operators table.
- **These are NOT interchangeable.** The lookup chain is always: `walletAddress` → operators table (`terminal_wallet`) → `operator.id` → profiles table (`operator_id`).
- Session cookie (`lp_session`) stores `walletAddress`. To get a profile, you must go through the chain above via `resolveProfileFromSession()` in `src/lib/auth/resolve-profile.ts`.

### Payment/subscription status

- `profile.isPaid` is the authoritative field for "is this a paid profile." Use it directly.
- **DO NOT** use `isPaidNow()` from `subscription.ts` — it returns false for EA profiles that have `null` subscription_expires_at (pre-grid-launch). This caused a multi-hour bug chain.
- EA campaign profiles (first 5,000) have `is_paid = true` but `subscription_expires_at = null`. Their 30-day timer starts at grid launch (`GRID_LAUNCH_DATE=2026-05-08`), not at claim time.

### Store architecture

All 10 stores on Supabase. The original 6 support memory/dual/supabase modes via `LASTPROOF_DB_*` env vars. The 4 newer adapters (work_items, screenshots, profile_links, profile_categories) are supabase-direct.

### Session & auth

- Cookie-based auth: `lp_session` (signed HttpOnly, HMAC-SHA256)
- No NextAuth. Custom implementation in `src/lib/session.ts`.
- Wallet connects → Terminal validates → session cookie set → all API routes check session.

---

## WHAT'S BUILT AND WORKING (as of 2026-04-11)

### Authentication
- [x] Wallet connection + Terminal ID validation
- [x] Session cookie management
- [x] X/Twitter OAuth 2.0 with PKCE (full redirect flow)
- [x] Telegram verification via Login Widget bridge on lastshift.ai

### Telegram auth architecture (IMPORTANT — hard-won solution)
- `*.vercel.app` subdomains do NOT deliver Telegram Login Widget confirmation messages
- Bridge page at `lastshift.ai/auth/telegram-bridge` hosts the widget on the custom domain
- LASTPROOF opens a popup to the bridge, user authenticates on lastshift.ai
- Bridge sends signed data back via `window.postMessage` (origin-locked)
- LASTPROOF receives postMessage, POSTs to `/api/auth/telegram/callback`
- Backend verifies HMAC-SHA256, saves handle + `telegram_verified = true`
- **Bot:** `@Auth_lastproof_bot` (ID: 8328869003), BotFather domain: `lastshift.ai`
- **Token:** `8328869003:AAF-u3DtVnjgTs728nzCT7S2eakIN0c5rKE`
- **Bridge code lives in:** `lastshift-ai/app/auth/telegram-bridge/page.js` (deployed via `vercel --prod` from `lastshift-ai/` directory — NOT a git repo, CLI deploys only)
- **Previous failed bots:** `@lastproof_authbot` (never delivered messages). Do NOT reuse.

### Dashboard
- [x] Full profile editor (identity, handle, categories, pitch, about, links, screenshots, work items)
- [x] Trust Tier display with dynamic colors per tier
- [x] GET VERIFIED card (disabled/locked for free profiles, active for paid)
- [x] Campaign claim (first 5,000 free upgrade)
- [x] Status bar with subscription countdown
- [x] StatQuad (views, proofs, tier, token balance)
- [x] SHIFTBOT pitch rewriter (Groq)

### Public profile
- [x] Three variants: free, public, legend (first-5000)
- [x] Projector computes tier live from `isPaid + isPublished + proofsConfirmed`
- [x] HIRE button shows when Telegram is verified (falls back to verified handle)
- [x] Previously Known As (handle history)
- [x] Work items, screenshots, links with platform tabs

### Proof flow
- [x] SSE-streamed eligibility checks
- [x] Quote locking with pricing
- [x] Solana transaction building + broadcast
- [x] Transaction status polling
- [x] Helius webhook for payment confirmation

---

## WHAT'S NOT BUILT / PENDING

### Critical gaps

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **Profile view count always 0** | StatQuad shows 0 views forever | RPC function `increment_profile_view()` exists in DB but is never called. Need to call it on public profile page load (non-owner only) |
| 2 | **Handle change payment not verified** | Accepts any txSignature without on-chain validation | Query Solana RPC to confirm signature + amount + recipient before updating |
| 3 | **Proof deduplication incomplete** | No `payer_wallet` column on proofs table | Add column + check so same wallet can't proof same work item twice |
| 4 | **FOMO strip attribution** | "BUILD YOUR PROFILE" doesn't hand off to Terminal with affiliate tracking | Redirect to `lastshift.app/?ref=[slug]` |
| 5 | **`/how-it-works` page** | Wireframe exists, no route built | Build from `wireframes/how-it-works.html` |

### Env vars not set on Vercel

| Variable | Purpose | Status |
|----------|---------|--------|
| `TOKEN_RATE_SOURCE=live` | Jupiter live rates for payment pricing | NOT SET (using stubs) |

### SQL backfills needed (may already be done — verify first)

```sql
-- Fix EA profiles stuck at tier 5 from early bug
UPDATE profiles SET tier = 1 WHERE ea_claimed = true AND tier = 5;

-- Fix screenshots with null preview_url
UPDATE screenshots SET preview_url = image_url WHERE preview_url IS NULL;
```

---

## ENV VARS ON VERCEL (production)

Verify these exist — they should all be set:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
HELIUS_RPC_URL
HELIUS_WEBHOOK_SECRET
LASTSHFT_MINT
LASTPROOF_AR_WALLET
TERMINAL_API_URL
INTER_TOOL_API_SECRET
INTER_TOOL_KEY_ID
TOOL_SLUG
LASTPROOF_GROQ_API_KEY
PAYMENTS_ENABLED
GRID_LAUNCH_DATE
X_CLIENT_ID
X_CLIENT_SECRET
X_REDIRECT_URI
TG_BOT_TOKEN (8328869003:AAF-u3DtVnjgTs728nzCT7S2eakIN0c5rKE)
TG_BOT_ID (8328869003)
NEXT_PUBLIC_TG_BOT_USERNAME (Auth_lastproof_bot)
NEXT_PUBLIC_SITE_URL (https://lastshift-lastproof.vercel.app)
```

All `LASTPROOF_DB_*` store mode vars should be `supabase`.

---

## FILE MAP — KEY FILES

### Config
- `CLAUDE.md` — architectural source of truth
- `LASTPROOF-BUILDER-HANDOFF.md` — wireframe mapping + design tokens
- `telegram-auth-bot-implementation.md` — reference guide for Telegram widget auth
- `telegram-bot-working-source-code.md` — working bot code from lastshift.ai

### Core lib
- `src/lib/tier.ts` — tier computation (LOCKED)
- `src/lib/pricing.ts` — single source for all prices ($1 proof, $5 dev, $10 sub, $100 handle)
- `src/lib/session.ts` — cookie session layer
- `src/lib/auth/resolve-profile.ts` — session → operator → profile chain
- `src/lib/projector/public-profile.ts` — public profile data projection
- `src/lib/token-dev-verify.ts` — most critical security logic (dev wallet verification)
- `src/lib/subscription.ts` — subscription expiry (DO NOT use `isPaidNow()` for payment status)

### Dashboard components
- `src/components/dashboard/DashboardContent.tsx` — routes all dashboard cards
- `src/components/dashboard/VerifiedCard.tsx` — X + Telegram verification
- `src/components/dashboard/TrustTierRow.tsx` — tier display with dynamic colors
- `src/components/dashboard/StatusBar.tsx` — subscription + publish status

### Profile components
- `src/components/profile/ProfileHero.tsx` — hero section with HIRE button
- `src/lib/projector/public-profile.ts` — computes everything for public view

### Auth routes
- `src/app/api/auth/x/authorize/route.ts` — X OAuth initiation
- `src/app/api/auth/x/callback/route.ts` — X OAuth callback
- `src/app/api/auth/telegram/callback/route.ts` — Telegram HMAC verification (POST, not GET)

---

## DEPLOYMENT

- **Repo:** GitHub `lastshiftcoin/lastshift-lastproof` → auto-deploys on push to `main`
- **Vercel project:** `lastshift-lastproof` (org: `lastshift`)
- **URL:** `lastshift-lastproof.vercel.app`
- **Custom domain:** `lastproof.app` exists on Vercel account but DNS points to Cloudflare (not yet wired)
- **Bridge (lastshift.ai):** deployed via `cd lastshift-ai && npx vercel --prod` (no git repo, CLI deploy)

---

## RECENT GIT HISTORY (context for what changed)

```
67b7f9f Trust Tier card: dynamic colors match tier color system
22baff6 Disable GET VERIFIED section for free profiles
95b269e HIRE button: fall back to verified Telegram handle
d8607f5 Telegram auth via lastshift.ai bridge popup + postMessage
2859a51 Switch to new Telegram bot @Auth_lastproof_bot
faf0cac Rewrite Telegram auth: Login Widget replaces redirect-based OAuth
a45e7b7 Fix paid status: use profile.isPaid instead of isPaidNow across codebase
8429249 Fix View Live showing free profile: compute tier live in projector
3587f4d Auto-publish profile on campaign claim, update all state fields
da29224 Fix campaign claim: look up operator by wallet, then profile by operator ID
```

---

## PATTERNS THAT CAUSED BUGS — LEARN FROM THESE

### 1. operator_id vs walletAddress (appeared 3 times)
`operator_id` is a UUID. `walletAddress` is a Solana pubkey. Code that uses one where the other is needed silently returns null. Always look up: `walletAddress` → `operators.terminal_wallet` → `operator.id` → `profiles.operator_id`.

### 2. isPaidNow() vs profile.isPaid (appeared 3 times)
`isPaidNow()` checks `subscription_expires_at` — returns false for EA profiles with null expiry. `profile.isPaid` is the authoritative field. Use it everywhere.

### 3. Tier cached in DB vs computed live
The projector was reading `profile.tier` from the DB (stale value of 5). Fixed to compute live: `computeTier({ isPaid, isPublished, proofsConfirmed })`. Never trust the cached `tier` column — always recompute.

### 4. Telegram *.vercel.app domains
Telegram's Login Widget does NOT deliver confirmation messages on `*.vercel.app` subdomains. Must use a custom domain. Solution: bridge page on lastshift.ai with postMessage relay.

---

## PRIORITIES (set by user)

1. Public profile — the shareable cold link
2. Proof flow — token-dev verification is highest security stakes
3. Onboarding + MVP dashboard
4. Subscription payments
5. Dashboard polish
6. Grid (launches 2026-05-08 per `GRID_LAUNCH_DATE`)
7. SHIFTBOT search over populated Grid

---

*Generated 2026-04-11 from Frontend V2 session. All code on `main`, all Vercel env vars current.*
