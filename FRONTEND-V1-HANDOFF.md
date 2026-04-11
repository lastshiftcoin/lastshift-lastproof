# LASTPROOF Frontend V1 Session Handoff

**Session**: Frontend V1 (completed 2026-04-10)
**Next session**: Frontend V2
**Domain**: lastproof.app (Vercel)

---

## What Was Done (Priority List Progress)

### #1 — First 5,000 Campaign (COMPLETE)
Made the campaign LASTPROOF-owned instead of dependent on Terminal's `firstFiveThousand` session flag.

**Files created:**
- `src/app/api/campaign/claim/route.ts` — instant free premium activation. Counts `ea_claimed = true` profiles in Supabase, enforces 5,000 cap. Pre grid-launch: no expiry. Post grid-launch: 30 days. Idempotent.

**Files modified:**
- `src/components/dashboard/DashboardContent.tsx` — removed `session.firstFiveThousand` gate. Now shows `CampaignFomoStrip` for any unpaid profile regardless of Terminal session data. Passes `campaignActive` and `onProfileUpdate` to StatusBar.
- `src/components/dashboard/StatusBar.tsx` — added `handleFreeClaim()` calling `/api/campaign/claim`. Button shows "Upgrade Profile -- $0" (green) during campaign, "CLAIMED -- ACTIVE" after claim.
- `src/app/(marketing)/manage/profile/dashboard.css` — added `.btn-free` and `.btn-claimed` CSS states.

**DB requirement**: The `ea_claimed` column must exist on the profiles table. SQL migration was run in a prior step (confirmed "Success. No rows returned").

**Communication sent to Terminal builder**: Notified Terminal that LASTPROOF now owns the 5,000 count independently and no longer gates on `firstFiveThousand` from Terminal session.

---

### #2 — Payments: Mock to Real (COMPLETE)
Replaced all mock payment endpoints with real Solana transaction endpoints.

**Files created:**
- `src/app/api/proof/build-tx/route.ts` — real Solana transaction builder. Builds SOL or SPL transfer to treasury with SPL Memo + quote reference. Checks balance before serializing. Error codes: 402 insufficient, 410 expired, 409 lock lost, 503 RPC degraded.
- `src/app/api/proof/broadcast/route.ts` — submits wallet-signed transaction to Helius RPC via `sendRawTransaction`. Parses Solana RPC errors into expected failure reasons.
- `src/app/api/proof/tx-status/route.ts` — polls `getSignatureStatuses` for confirmation ladder. 120s timeout triggers `blockhash_expired`, returns `solscan_url` on confirmed.

**Files modified (URL rewiring):**
- `src/components/proof-modal/useSignFlow.ts` — URLs changed from `/api/mock/proof/*` to `/api/proof/*`
- `src/components/proof-modal/useEligibilityStream.ts` — `MOCK_URL` to `ELIGIBILITY_URL`
- `src/components/proof-modal/useQuoteRefresh.ts` — mock URL to real
- `src/components/proof-modal/ProofModal.tsx` — abandon URL changed from mock to real
- `src/app/api/payments/webhook/route.ts` — fixed treasury wallet env inconsistency (now checks `LASTPROOF_AR_WALLET || TREASURY_WALLET || stub`)

**Files modified (token rates):**
- `src/lib/token-rates.ts` — rewritten with Jupiter Price API v2 support, 60s in-memory cache, graceful fallback to stubs. Activated via `TOKEN_RATE_SOURCE=live` env var.

**Backend endpoints confirmed already built (not touched):**
- `src/app/api/proof/eligibility/route.ts` — full SSE with real Supabase queries
- `src/app/api/proof/abandon/route.ts` — real quote expiry
- `src/app/api/proof/quote/[id]/refresh/route.ts` — repricing with fresh Jupiter rate

**Communication**: Sent sanity-check message to backend, received 4 confirmations (all passed).

---

### #3 — Preview/Publish System (COMPLETE)
Free users can preview what their full profile would look like. Separate "View Public" shows the actual live (stripped) view.

**Files created:**
- `src/components/profile/PreviewBanner.tsx` — client component, sticky orange banner: "PREVIEW MODE" badge, explanation text, "VIEW PUBLIC" link

**Files modified:**
- `src/lib/projector/public-profile.ts` — added `options?: { previewMode?: boolean }` parameter. When preview, forces full variant regardless of tier/paid status.
- `src/app/(marketing)/profile/[handle]/page.tsx` — auth-gated `?preview=true` support. Verifies session wallet matches profile owner. Renders `PreviewBanner` when active.
- `src/app/(marketing)/profile/[handle]/profile-public.css` — preview banner styles (`.pp-preview-banner`, etc.)
- `src/components/dashboard/StatusBar.tsx` — added `PREVIEW` and `VIEW PUBLIC` buttons (new `handle` prop). View Public only shows when published.
- `src/components/dashboard/DashboardContent.tsx` — passes `handle` to StatusBar.
- `src/app/(marketing)/manage/profile/dashboard.css` — `.btn-preview` and `.btn-viewpub` styles.

---

### #4 — Ticker Price in Topbar (COMPLETE)
Replaced hardcoded $LASTSHFT prices across all 3 topbar components with live data.

**Files created:**
- `src/app/api/ticker/route.ts` — GeckoTerminal API v2 (same source as Terminal's `useTokenData.ts`). Fetches token price + 24h change from two parallel Gecko endpoints. Falls back to Jupiter/stub if Gecko is down. Cached 60s at edge.
- `src/hooks/useTickerPrice.ts` — client hook, polls `/api/ticker` every 60s. Returns `{ price, change, direction }`.

**Files modified:**
- `src/components/Topbar.tsx` — uses `useTickerPrice()`, dynamic price + change
- `src/components/profile/ProfileTopBar.tsx` — same
- `src/components/dashboard/DashboardTopbar.tsx` — same

**Alignment with Terminal**: Terminal uses GeckoTerminal directly from client (`useTokenData.ts`). LASTPROOF uses the same Gecko API server-side to keep API keys off the client and reduce CORS issues for unauthenticated visitors.

---

### #5 — StatQuad: Wallet Balance (PARTIAL — views still at 0)

**Files modified:**
- `src/app/api/token/balance/route.ts` — **rewritten** to use raw JSON-RPC `getTokenAccountsByOwner` (same pattern as Terminal's `/api/balance`). No longer depends on broken `getLastshftBalance()` that threw on real Helius. Session-gated.
- `src/components/dashboard/StatQuad.tsx` — fetches balance from `/api/token/balance` on mount. USD value calculated from balance x live ticker price.

**NOT done — Profile Views**:
- No `view_count` column exists on the profiles table
- No increment-on-view logic exists
- Still hardcoded to 0
- **Needs backend**: Add `view_count integer default 0` column to profiles table, then either:
  - (A) Increment via Supabase RPC on profile page load (simple), or
  - (B) Use an analytics service for more accurate deduplication

---

### #6 through #10 — NOT STARTED

| # | Item | Status |
|---|------|--------|
| 6 | SHOW ALL links toggle (decorative, doesn't expand) | Not started |
| 7 | Set `TOKEN_RATE_SOURCE=live` on Vercel | Not started (env var change) |
| 8 | X/Telegram OAuth | Not started (LARGE) |
| 9 | Early adopter number (always null) | Not started |
| 10 | Categories connectivity (needs retest) | Not started |

---

## Env Vars to Set on Vercel

These are required for the new live endpoints to work in production:

| Var | Purpose | Status |
|-----|---------|--------|
| `TOKEN_RATE_SOURCE=live` | Activates Jupiter live rates for payment pricing | NOT SET — #7 on list |
| `HELIUS_RPC_URL` | Used by build-tx, broadcast, tx-status, balance endpoints | Should already exist |
| `LASTPROOF_AR_WALLET` | Treasury wallet for payment transactions | Should already exist |
| `LASTSHFT_MINT` | Token mint address | Already set (fallback hardcoded) |

---

## Communication Log

### To Backend (relayed via user):
1. **Sanity check on payments** — asked 4 questions about eligibility/quote/abandon endpoints. Backend confirmed all 4.
2. **Campaign ownership** — confirmed LASTPROOF owns the 5,000 count, not Terminal.
3. **Profile views** — needs `view_count` column added to profiles table.

### To Terminal Builder (relayed via user):
1. **Campaign independence** — notified that LASTPROOF no longer depends on `firstFiveThousand` flag from Terminal session.
2. **Ticker alignment** — LASTPROOF's `/api/ticker` now uses same GeckoTerminal API v2 as Terminal's `useTokenData.ts`.
3. **Balance endpoint** — LASTPROOF's `/api/token/balance` mirrors Terminal's `/api/balance` (same raw JSON-RPC pattern).

---

## Architecture Decisions Made

1. **GeckoTerminal over Jupiter for ticker** — Jupiter v2 doesn't return 24h change. GeckoTerminal gives both price + change in two calls. Matches Terminal's approach.
2. **Server-side ticker vs client-side** — Terminal fetches Gecko directly from client. LASTPROOF routes through `/api/ticker` server endpoint because public profile pages serve unauthenticated visitors (avoids CORS, keeps API clean).
3. **Raw JSON-RPC for balance** — Terminal's pattern (`getTokenAccountsByOwner` via raw fetch) is simpler and more reliable than `@solana/web3.js` in serverless. Adopted same pattern.
4. **Preview = variant override** — `previewMode` forces the projector to return full variant regardless of tier/paid status. Auth-gated to profile owner only.
5. **Campaign count is LASTPROOF's** — counts `ea_claimed = true` profiles in own Supabase, not Terminal's session flag.

---

## Type Check Status

All changes pass `tsc --noEmit` with zero errors as of session end.

---

## Files Created This Session

```
src/app/api/proof/build-tx/route.ts
src/app/api/proof/broadcast/route.ts
src/app/api/proof/tx-status/route.ts
src/app/api/campaign/claim/route.ts
src/app/api/ticker/route.ts
src/hooks/useTickerPrice.ts
src/components/profile/PreviewBanner.tsx
```

## Files Modified This Session

```
src/components/proof-modal/useSignFlow.ts
src/components/proof-modal/useEligibilityStream.ts
src/components/proof-modal/useQuoteRefresh.ts
src/components/proof-modal/ProofModal.tsx
src/app/api/payments/webhook/route.ts
src/lib/token-rates.ts
src/components/dashboard/DashboardContent.tsx
src/components/dashboard/StatusBar.tsx
src/components/dashboard/DashboardTopbar.tsx
src/components/dashboard/StatQuad.tsx
src/app/api/token/balance/route.ts
src/app/(marketing)/manage/profile/dashboard.css
src/app/(marketing)/profile/[handle]/page.tsx
src/app/(marketing)/profile/[handle]/profile-public.css
src/lib/projector/public-profile.ts
src/components/Topbar.tsx
src/components/profile/ProfileTopBar.tsx
```
