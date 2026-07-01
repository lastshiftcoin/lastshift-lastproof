# LASTBURN ↔ LASTPROOF — Integration Notes

> **Purpose:** answers to the 12 reconnaissance questions LASTBURN sent on 2026-05-18, plus context the LASTBURN builder may want while designing their stack.
>
> **Not a build plan.** No endpoints have been committed to. No work has been scheduled on the LASTPROOF side. Items that would require LASTPROOF code changes (a new endpoint, a webhook, etc.) are flagged as **"requires LASTPROOF action"** so LASTBURN can coordinate when ready.
>
> **Source of truth:** LASTPROOF repo on `main`, current as of 2026-05-18.

---

## 1 · Subscription-state API

**Status:** does not exist today. No `/api/internal/lastburn/*` routes are in the repo.

**Data is available.** The shape LASTBURN proposed (`{ active, tier }`) can be assembled with a single Supabase read joining `operators` ⇒ `profiles` on `operator_id`, filtered by `terminal_wallet`. Both tables already have every field needed:
- `operators.terminal_wallet` (base58 Solana pubkey)
- `profiles.is_paid`, `profiles.is_early_adopter`, `profiles.published_at`, `profiles.handle`

**Requires LASTPROOF action** if LASTBURN wants this endpoint built. ~30 min of work plus a code review. Coordinate when LASTBURN is ready.

---

## 2 · Auth model for an inter-tool endpoint

**Pattern already in use between Terminal ↔ LASTPROOF:** shared secret in `Authorization: Bearer <SECRET>` header.

- Env var: `INTER_TOOL_API_SECRET`
- Set on both sides (Terminal and LASTPROOF) to the same string in Vercel env vars
- Caller adds `Authorization: Bearer ${INTER_TOOL_API_SECRET}` to outbound requests
- Server validates by string-comparing the bearer to the env var (constant-time recommended)

**Source:** `src/lib/terminal-client.ts:96` (LASTPROOF reads it when calling Terminal); `src/lib/session.ts:37` (the same env var is the fallback HMAC secret if `SESSION_HMAC_SECRET` isn't set, which is a deliberate dev-fallback only).

**Notes for LASTBURN:**
- Reusing `INTER_TOOL_API_SECRET` means all three tools share one secret. Compromising one leaks all three.
- Splitting per-edge (`LASTBURN_API_SECRET` for the LASTBURN-to-LASTPROOF edge specifically) is cleaner. LASTPROOF would just check both env vars and accept either. Trade-off: one more env var per project.

---

## 3 · Tier-state freshness

| Transition | Latency from real-world event to API would-be reflection |
|---|---|
| `none → active_paid` (paid subscription confirmed on-chain) | Seconds. Helius webhook hits the LASTPROOF webhook handler → cron sweep at `/api/proof/verify-tx/process` (`* * * * *`) confirms tx → DB row updates. |
| `none → first_5000_ea` (EA claim) | Immediate. Direct DB write inside `/api/campaign/claim/route.ts` returns before HTTP 200. |
| `active_paid → expired` (lapse) | Up to 24h. Daily cron at `00:05 UTC` (`/api/subscription/cron`) flips `is_paid: false` on rows where `subscription_expires_at <= now`. Until cron runs, expired rows still report `is_paid: true`. |
| `active_paid → active_paid` (renewal) | Seconds. Same Helius path as initial payment. |

**Note on EA:** `first_5000_ea` rows never transition out via the cron. Per v0.13.6 (2026-04-30), `subscription_expires_at` is `null` for every EA row by design, and the cron has an explicit guard at `src/app/api/subscription/cron/route.ts:51` that skips them. So once `first_5000_ea`, the row stays `is_paid: true` indefinitely.

**Defunct:** not currently a separate enforced state. Wireframes/copy reference a "90 days inactive" rule; no cron implements that transition yet. A profile that has lapsed payment + no recent activity currently reports as `free` in any practical query.

---

## 4 · Tier-state webhooks

**Status:** none exist. LASTPROOF does not currently fire outbound webhooks on tier-state changes.

**Data would come from three places** if LASTPROOF built this:
- `/api/campaign/claim` (Free → First-5,000-EA)
- The Helius webhook confirmation path (Free/Expired → Active Paid)
- `/api/subscription/cron` (Active Paid → expired/free)

**Requires LASTPROOF action** if needed. Polling at LASTBURN-session-login on the §1 endpoint is the simpler path.

---

## 5 · Session TTL

**12 hours.** Source: `src/lib/session.ts:24`

```ts
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
```

Session cookie:
- Name: `lp_session`
- HttpOnly, Secure (in prod), SameSite=Lax, Path=/
- Encoding: `base64url(JSON.stringify(payload)) + "." + HMAC_SHA256(payload, SESSION_HMAC_SECRET)`
- Validated via constant-time signature check + `Date.now() - issuedAt > TTL`

Payload shape (`Session` interface in `src/lib/session.ts`):
```ts
{
  walletAddress: string;
  terminalId: string;
  firstFiveThousand: boolean;
  freeSubUntil: string | null;       // Terminal pass-through; not used by LASTPROOF business logic
  subscriptionStatus: SubscriptionStatus;
  verified: { x: boolean; telegram: boolean };
  displayName: string | null;
  issuedAt: number;
}
```

No bearer tokens or secrets are ever stored in the cookie payload.

---

## 6 · Rate limits

**No rate limit on inter-tool routes** because none exist yet. Other LASTPROOF routes use `createRateLimiter` from `src/lib/rate-limit.ts` (in-memory window-based per-IP, e.g. `claim` is 3 req/60s).

**Notes:**
- If LASTBURN's stated ceiling is 10 req/min and the call only happens at session-login, that's trivial for either Vercel function ceilings or any rate limiter LASTPROOF might add later.
- Any future inter-tool endpoint would be rate-limited per bearer-token, not per IP (Vercel function IPs aren't stable across regions).

---

## 7 · Tier enum

LASTBURN's proposed strings:
| LASTBURN spec | LASTPROOF internal naming |
|---|---|
| `Active Paid` | usually rendered "ACTIVE PAID" in UI; not stored as a string column. Derived from `profiles.is_paid = true` + `is_early_adopter = false` + `published_at IS NOT NULL`. |
| `First 5000 EA` | usually rendered "FIRST 5,000" or "EA". Derived from `profiles.is_early_adopter = true` (which always also has `is_paid = true` and `published_at IS NOT NULL` by virtue of the claim flow). |
| `Free` | derived from `profiles.is_paid = false` and `published_at IS NOT NULL`. |
| `Defunct` | wireframe-only state today. Practically: same as `Free`. |

**LASTPROOF does not have a `tier_state` enum column.** Profile state is derived from `is_paid`, `is_early_adopter`, `published_at`, and `subscription_expires_at`. Any inter-tool endpoint would compute the discriminator server-side and return a single string.

**Note for LASTBURN:** the four-string enum is correct conceptually. If/when LASTPROOF builds the endpoint, the exact case/format of the strings is an API design decision (`snake_case`, `PascalCase`, etc.) — match whatever LASTBURN prefers; LASTPROOF has no internal preference.

**Tier vs State distinction (worth knowing):** "tier" inside LASTPROOF code usually refers to the proof-count tier (Tier 1 NEW / 2 VERIFIED / 3 EXPERIENCED / 4 LEGEND, thresholds 0/10/25/50 proofs). That's separate from the subscription state above. LASTBURN's "tier" field in the proposed API is really a subscription state. Naming it `state` on the wire might avoid confusion later.

---

## 8 · Supabase

| Question | Answer |
|---|---|
| (a) Tier | **Pro** |
| (b) RLS pattern | RLS enabled on every table. **Zero policies** for anon or authenticated roles (effective deny-all). Server-side access is service-role only. Views explicitly use `security_invoker = true` (migration `0028_views_security_invoker.sql` shipped 2026-05-06 to fix two views that had defaulted to definer mode). |
| (c) Extensions | Default Supabase set: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`. **No** `pg_cron` (Vercel Cron used instead — see §10). **No** `vault`, `pg_net`, or third-party extensions. |
| (d) Edge functions vs Next.js | All logic in Next.js App Router route handlers under `src/app/api/`. Zero Supabase Edge Functions. Server actions used sparingly. |
| (e) Migrations workflow | Numbered SQL files committed to `supabase/migrations/` (latest: `0030_ambassador_weekly_program_start.sql`). User runs each migration manually in Supabase Dashboard → SQL Editor. Never via CLI, never programmatically. The file in the repo is the audit trail; SQL Editor is the execution surface. |

---

## 9 · Auth

| Question | Answer |
|---|---|
| (a) Session storage | Custom HMAC-signed HttpOnly cookie (`lp_session`). Not `@supabase/ssr`, not Iron Session, not Auth.js. Single file: `src/lib/session.ts`. 12h TTL. |
| (b) Connect flow | Wallet adapter renders on `/manage` → user clicks CONNECT WALLET → if wallet is recognized, `/api/auth/wallet-gate` runs; if not recognized, `/api/auth/register-tid` collects a Terminal ID and runs the same validation. Both call Terminal's `/api/license/validate` (server-to-server, `INTER_TOOL_API_SECRET` bearer) to verify the wallet+TID pair. On success, server calls `writeSession()` to set the cookie. **No wallet signature is collected during auth** — pairing is wallet-presence + TID-knowledge based. |
| (c) Session payload | See §5. |
| (d) TID revocation / wallet rotation | Lazy re-validation. Every `/api/auth/wallet-gate` call hits Terminal's validate endpoint with `skipCache: true`. If Terminal returns `tid_regenerated`, LASTPROOF's frontend prompts the user to re-enter their new Terminal ID. No revocation list, no proactive cache invalidation, no admin force-logout — Terminal is always the source of truth and LASTPROOF asks every login. |

**Wallet semantics worth knowing for LASTBURN:** LASTPROOF requires the **same wallet** that generated the Terminal ID at lastshift.app to also be the wallet connecting at lastproof.app. This is enforced by Terminal's validate endpoint, not LASTPROOF. If LASTBURN wants to allow operators to use a different wallet at LASTBURN than at LASTPROOF, that's a Terminal-side API change (currently `/api/license/validate` returns `wallet_tid_mismatch` for different wallet + TID pairs). the operator has decided to keep the stricter wallet-bound model for v1.

---

## 10 · Background jobs

**All Vercel Cron** (from `vercel.json`):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/subscription/cron` | `5 0 * * *` (daily 00:05 UTC) | Flip lapsed paid subs to `is_paid: false`, fire notifications. |
| `/api/affiliate/worker` | `*/10 * * * *` (every 10 min) | Drain affiliate-confirm queue with retries + dead-letter. |
| `/api/proof/verify-tx/process` | `* * * * *` (every minute) | Sweep pending proof transactions, finalize state from Helius. |
| `/api/grid/categories-cron` | `10 0 * * *` (daily 00:10 UTC) | Refresh `categories.operator_count` materialized counts. |

Cron auth: every cron route reads `CRON_SECRET` env var and matches against the `Authorization` header that Vercel adds to scheduled invocations.

**Webhook ingestion** is regular Next.js route handlers (Vercel Serverless, Node.js runtime, not Edge). Helius webhook lands at a single route, authenticates via a webhook-specific secret in the request body, and writes to `pending_webhook_sigs` for the per-minute reconciliation cron.

---

## 11 · Helius integration

**Plan:** Developer. Same plan LASTBURN is on per the LASTBURN team's note.

**Features in use:**
- Webhook subscriptions for treasury wallet + ATA addresses (configured in Helius dashboard, webhook ID stored in env)
- Standard RPC: `getAccountInfo`, `getSignaturesForAddress`, `getTransaction`. Used for dev-wallet eligibility checks (mint authority, deployer, first-N holders) and proof tx verification.

**Features NOT in use** (intentionally — not needed for current LASTPROOF use cases):
- `sendBundle`
- Enhanced WebSockets
- LaserStream
- DAS (Digital Asset Standard, priced API)
- Photon (Helius's RPC accelerator)

**Note for LASTBURN:** Helius project IDs and quotas are independent per Vercel-project env vars. LASTBURN can either reuse LASTPROOF's Helius project (shared quota) or create its own (clean separation, recommended at scale).

---

## 12 · Env / secrets pattern

**Vercel env vars only.** No Supabase Vault, no Doppler, no external secret manager. Three Vercel scopes: Production, Preview, Development. Local dev pulls via `vercel env pull` into `.env.local` (gitignored).

Server-side secrets currently in the LASTPROOF prod set (names only, for reference):
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_HMAC_SECRET`
- `INTER_TOOL_API_SECRET`
- `CRON_SECRET`
- `HELIUS_API_KEY`, `HELIUS_WEBHOOK_SECRET`
- Plus per-feature secrets (Telegram bot token, Groq API key for SHIFTBOT, etc.)

Client-exposed values use the `NEXT_PUBLIC_*` prefix:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon role is RLS-denied, so this is safe to ship)
- `NEXT_PUBLIC_TREASURY_WALLET` (public address, not a signing key)

Signing keys for the treasury never live in env vars — those stay in hardware wallets, off-platform.

---

## Items that would require LASTPROOF action

Flagged for visibility; nothing committed:

1. **Subscription-state API endpoint** (§1) — would need to be built before LASTBURN can integrate.
2. **Tier-state webhook** (§4) — only if polling at session-login isn't enough.
3. **`LASTBURN_API_SECRET` provisioning** (§2) — if LASTBURN wants a separate secret instead of reusing `INTER_TOOL_API_SECRET`.

When LASTBURN is ready to integrate, send a follow-up. LASTPROOF can scope and ship in a single short cycle.

---

**Author:** LASTPROOF backend
**Date:** 2026-05-18
**Repo commit at time of writing:** `4a73fa8`
