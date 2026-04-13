FULLSTACK BUILDER — SESSION HANDOFF

You are the full-stack builder for LASTPROOF. The user (Kellen) is the sole operator who relays between AI builder sessions. When you receive a task, DO THE WORK FIRST (code, typecheck, commit), then report. Never promise work in a reply without having done it — this is the #1 rule.

Working directory: /Users/tallada2023/Documents/Claude/Projects/LASTSHIFT/lastproof-build

Read these first (in order):
1. CLAUDE.md — architectural source of truth (tiers, stores, priorities)
2. LASTPROOF-BUILDER-HANDOFF.md — wireframe-to-route mapping, design tokens, brand rules
3. FULLSTACK-BUILDER-HANDOFF.md — state snapshot from Frontend V2 (read it, but see corrections below)
4. docs/PROOF-MODAL-SPEC-REPLY.md — 439-line backend contract for proof modal

Stack: Next.js 16 App Router, React 19, TypeScript, Supabase (service-role key, bypasses RLS), Solana (@solana/web3.js + @solana/spl-token), Helius RPC, Jupiter Price API v2.

Live URL: https://lastshift-lastproof.vercel.app
Repo: https://github.com/lastshiftcoin/lastshift-lastproof — auto-deploys on push to main
Dev port: 3001 (next dev -p 3001 --webpack — never use Turbopack, it corrupts the sandbox. Never use preview_start.)

---

CORRECTIONS TO FULLSTACK-BUILDER-HANDOFF.md

Frontend's handoff doc has inaccuracies. Trust this prompt over the doc:

- TOKEN_RATE_SOURCE=live NOT SET → IS set on Vercel (both production + development). Jupiter live rates active.
- /how-it-works page not built → IS built — full interactive page at src/app/(marketing)/how-it-works/page.tsx
- Profile view count never called → IS called — profile/[handle]/page.tsx:73-78 calls incrementViewCount(handle) for non-owner visits
- Screenshots backfill needed → Already run — preview_url backfilled
- Published_at backfill needed → Already run — EA profiles backfilled

---

THE 5 PATTERNS THAT WILL BURN YOU

1. operator_id is NOT walletAddress. operator_id = UUID. walletAddress = Solana pubkey. Lookup chain: walletAddress → operators.terminal_wallet → operator.id → profiles.operator_id. Use resolveProfileFromSession() from src/lib/auth/resolve-profile.ts. This was wrong 3 separate times in 3 different routes.

2. Use profile.isPaid, never isPaidNow(). isPaidNow() checks subscription_expires_at — returns false for EA profiles with null expiry (timer starts at grid launch, not claim time). profile.isPaid is the authoritative field. Two intentional remaining calls exist in publish/route.ts and public-profile.ts — these are correct in context, with explicit comments explaining why.

3. Tier must be computed live, never read from DB. profiles.tier is a stale cache. Always call computeTier({ isPaid, isPublished, proofsConfirmed }) from src/lib/tier.ts.

4. Telegram Login Widget does NOT work on *.vercel.app subdomains. Solution: bridge page on lastshift.ai/auth/telegram-bridge hosts the widget, sends auth data back via window.postMessage. VerifiedCard opens a popup to the bridge, receives postMessage, POSTs JSON to /api/auth/telegram/callback. The callback is a POST handler (not GET), receives JSON body. The old authorize route for Telegram (/api/auth/telegram/authorize) was deleted — do not recreate it.

5. X OAuth env vars had \n newlines. Fixed — env vars re-added clean on Vercel, code .trim()s all reads. X endpoints use api.x.com and x.com (not the old twitter.com domains).

---

WHAT'S BUILT AND WORKING (verified against codebase)

Auth:
- Wallet connection + Terminal ID validation
- Session cookies (lp_session, HMAC-SHA256, custom — no NextAuth)
- X OAuth 2.0 with PKCE (endpoints at api.x.com/x.com, .trim() on all env reads)
- Telegram via lastshift.ai bridge popup + postMessage → POST /api/auth/telegram/callback (HMAC verify)
- Bot: @Auth_lastproof_bot (ID: 8328869003), token: 8328869003:AAF-u3DtVnjgTs728nzCT7S2eakIN0c5rKE, BotFather domain: lastshift.ai

Dashboard:
- Full profile editor, Trust Tier with dynamic colors, GET VERIFIED (locked for free), campaign claim, StatusBar, StatQuad (views/proofs/tier/balance), SHIFTBOT pitch rewriter (Groq)

Public Profile:
- 3 variants: free/public/5000. Projector computes tier live. HIRE button shows when TG verified. Handle history. Work items, screenshots, links with platform tabs. View count increments on non-owner page loads.

Proof Flow (all 6 real endpoints + 6 parallel mocks):
- SSE-streamed eligibility: POST /api/proof/eligibility (uniqueness → slot → balance → mint_authority → deployer+first5 fused)
- Quote lifecycle: 90s TTL, refresh at T-30s, silent refresh < 45s / re-verify >= 45s
- Payment: POST /api/proof/build-tx → client signs → POST /api/proof/broadcast
- Status: POST /api/proof/tx-status (broadcasted → confirming → confirmed|failed)
- Abandon: POST /api/proof/abandon (releases quote lock)
- Refresh: POST /api/proof/quote/[id]/refresh
- Pricing verified: collab $1/$0.60 with LASTSHFT, dev $5/$3.00 with LASTSHFT. 40% LASTSHFT discount.
- Token set: LASTSHFT (default, 6 decimals), SOL (native, 9 decimals), USDT (6 decimals). NOT USDC.
- Treasury: LASTPROOF_AR_WALLET env var (primary), TREASURY_WALLET (fallback)

Campaign:
- First 5,000 free upgrade. Counter + expiry owned by LASTPROOF. EA number assigned sequentially on claim (migration 0006).

Marketing:
- /how-it-works — full interactive page with dev/operator toggle
- Ambassador landing at /lastproof/[slug]/ with stats subpage, generates ?ref=slug URLs
- Homepage, grid locked placeholder

Token Rates:
- TOKEN_RATE_SOURCE=live set on Vercel → Jupiter Price API v2 with 60s cache
- Stub fallback: SOL=$150, LASTSHFT=$0.002, USDT=$1 (always pegged)

---

WHAT'S NOT BUILT / OPEN ITEMS (verified)

1. Handle change payment not verified — api/dashboard/handle-change/route.ts accepts any non-empty txSignature without on-chain validation. Has explicit TODO comment.

2. payer_wallet column on proofs — Column exists on payments table but NOT on proofs. Needed for dedup — same wallet shouldn't proof same work item twice. Migration + backfill required.

3. Referral capture backend — referral_slug column exists in profiles (migration 0001). Ambassador page generates ?ref=slug URLs. But no backend logic captures the ref param — no cookie, no write on publish. Terminal's affiliate tracking being removed; LASTPROOF needs to own this.

4. FOMO strip attribution link — BUILD YOUR PROFILE CTA doesn't carry affiliate tracking.

5. Domain migration — Plan to point main domain at LASTPROOF Vercel project. Full audit complete: 84 URLs, 32 env vars catalogued. Waiting on domain decision.

6. Dead code — src/app/auth/telegram/callback/page.tsx (hash fragment handler) is unused — Telegram uses bridge popup approach now. Harmless but should be cleaned up.

---

KEY FILES

Config: CLAUDE.md, LASTPROOF-BUILDER-HANDOFF.md, FULLSTACK-BUILDER-HANDOFF.md

Core lib:
- src/lib/tier.ts — tier computation (LOCKED, pure function)
- src/lib/pricing.ts — priceFor(), quoteTtlSec(), base prices, LASTSHFT discount
- src/lib/proof-tokens.ts — LASTSHFT/SOL/USDT definitions, BUY_LASTSHFT_URL
- src/lib/token-rates.ts — Jupiter live rates with 60s cache, stub fallback
- src/lib/session.ts — cookie session (HMAC-SHA256)
- src/lib/auth/resolve-profile.ts — session → operator → profile chain
- src/lib/projector/public-profile.ts — public profile data projection (computes tier live)
- src/lib/token-dev-verify.ts — most critical security file (on-chain dev wallet verification)
- src/lib/quotes-store.ts — quote lifecycle (issue, get, consume, expire, sweep)
- src/lib/subscription.ts — subscription expiry (DO NOT use isPaidNow() for payment status)

DB:
- src/lib/db/client.ts — supabaseService() (service-role, bypasses RLS)
- src/lib/db/profiles-adapter.ts — profile CRUD + incrementViewCount()
- src/lib/db/mode.ts — store mode dispatch (memory/dual/supabase)
- supabase/migrations/ — 0001 through 0007 (all applied to Supabase)

Auth:
- src/app/api/auth/x/authorize/route.ts — X OAuth initiation (PKCE, uses x.com)
- src/app/api/auth/x/callback/route.ts — X OAuth callback (uses api.x.com)
- src/app/api/auth/telegram/callback/route.ts — Telegram HMAC verify (POST, JSON body)
- src/components/dashboard/VerifiedCard.tsx — opens bridge popup, handles postMessage, POSTs to callback
- No /api/auth/telegram/authorize route — deleted, bridge handles everything

Proof endpoints: all under src/app/api/proof/ (eligibility, build-tx, broadcast, tx-status, abandon, quote/[id]/refresh)
Mock endpoints: all under src/app/api/mock/proof/ (same 6, parallel for local testing)

---

LOCKED DECISIONS (do not change)

- Token set: LASTSHFT, SOL, USDT (NOT USDC)
- Pricing: Collab $1/$0.60 with LASTSHFT. Dev $5/$3.00 with LASTSHFT. Subscription $10/30 days. Handle change $100.
- Tier thresholds: 0+/10+/25+/50+ (TIER 1-4: NEW/VERIFIED/EXPERIENCED/LEGEND)
- Terminal S2S auth: Authorization: Bearer ${INTER_TOOL_API_SECRET} + X-LastShift-Key-Id: v1
- Grid launch: 2026-05-08 (GRID_LAUNCH_DATE)
- Wireframes win over all docs when there's a conflict
- Telegram bot: @Auth_lastproof_bot on lastshift.ai only. Previous bot @lastproof_authbot is dead — do not reuse.

---

HOW THIS USER WORKS

- No patches. Trace the full data flow before writing any fix. grep the entire codebase for the same broken pattern. Fix ALL instances. Code for 100K concurrent.
- Do work before replying. Execute first, report after. Never promise work you haven't done.
- Check before asking. Search the codebase, env files, memory, and docs before asking the user for ANY information.
- No unnecessary additions. Don't add docstrings, comments, type annotations, or refactoring to code you didn't change.
- Dev server: Start with npx next dev -p 3001 --webpack. Never use preview_start or Turbopack.

---

Composed 2026-04-11. Verified against codebase by Backend V2 session — every claim checked against actual files. HEAD: fad7ca0. Typecheck clean. All migrations (0001-0007) applied.
