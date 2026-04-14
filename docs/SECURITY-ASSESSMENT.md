# LASTPROOF Security Assessment & Action Plan

**Date:** 2026-04-13
**Context:** Terminal completed security hardening. LASTPROOF going live on lastproof.app. Audit against Terminal's security patterns.

---

## Current Security Posture: GOOD with gaps

### What's solid (no action needed)

| Area | Status | Details |
|------|--------|---------|
| **API keys** | SECURE | Helius RPC, Groq, Supabase service key — all server-only. Zero API keys in NEXT_PUBLIC_ vars. |
| **Webhook auth** | SECURE | Helius webhooks verified with timing-safe HMAC comparison. 32-byte minimum enforced. Always returns 200 (prevents Helius retry floods). |
| **Session cookies** | SECURE | HMAC-SHA256 signed, HttpOnly, Secure in prod, SameSite=lax, 12h TTL. |
| **S2S auth** | SECURE | `INTER_TOOL_API_SECRET` as Bearer token for Terminal calls. Timing-safe comparison. Server-only — never in client bundle. |
| **SQL injection** | SAFE | All queries use Supabase parameterized client. Zero raw SQL in app code. |
| **XSS** | SAFE | No `dangerouslySetInnerHTML` with user content. All user text rendered as text nodes, not HTML. |
| **API route auth** | CORRECT | All state-changing routes (POST/PATCH/DELETE) require `readSession()`. Public GETs are intentional (profile pages, campaign counter). |
| **Input validation** | GOOD | Handle regex, field whitelists, enum checks on kind/token/path. |
| **Webhook idempotency** | GOOD | UNIQUE constraint on `tx_signature` prevents double-processing. |
| **RLS** | CORRECT | Enabled on all tables, no policies = deny-all for anon key. All access via service role through API routes. |

---

## Gaps — action required before launch

### GAP 1: Security headers missing (MEDIUM)

**Problem:** `next.config.ts` has no security response headers. Missing clickjacking protection, MIME sniffing protection, and HSTS.

**Action:** Add headers to `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    },
  ];
},
```

**Risk if not done:** Clickjacking attacks (X-Frame-Options), MIME sniffing (X-Content-Type-Options). These are standard headers every production site should have.

**Effort:** 5 minutes. Zero risk to existing functionality.

---

### GAP 2: No rate limiting (HIGH)

**Problem:** Zero rate limiting on any route. A bot can:
- Flood `/api/proof/verify-tx` with thousands of fake signatures (each burns a cron RPC call = Helius credits)
- Spam `/api/onboarding/check-handle` to enumerate available handles
- Flood `/api/campaign/claim` to test for race conditions
- Hammer `/api/proof/session-start` creating millions of session rows

**Action:** Add IP-based rate limiting. The simplest approach for Vercel:

Option A: In-memory rate limiter (like Terminal did) — simple Map-based counter per IP. Resets on cold start but good enough for launch.

Option B: Upstash Redis rate limiter (`@upstash/ratelimit`) — persistent across function invocations. $0 for 10K requests/day.

**Priority routes:**

| Route | Limit | Why |
|-------|-------|-----|
| `POST /api/proof/verify-tx` | 5/min per IP | Each submission triggers RPC call |
| `POST /api/payment/paste-verify` | 5/min per IP | Same — RPC cost |
| `POST /api/proof/session-start` | 10/min per IP | Creates DB rows |
| `GET /api/onboarding/check-handle` | 15/min per IP | Handle enumeration |
| `POST /api/campaign/claim` | 3/min per IP | State-changing |
| `POST /api/proof/webhook` | No limit (Helius needs it) | Auth-gated already |

**Risk if not done:** Helius credit drain, DB row flooding, handle enumeration. Manageable at low traffic but a problem if someone targets the site.

**Effort:** 30-60 minutes. Low risk — rate limiting is additive, doesn't change existing behavior.

---

### GAP 3: No error boundaries in React (LOW)

**Problem:** If a React component crashes, the user sees a white screen or browser default error.

**Action:** Add a root error boundary in the app layout. Catches unhandled React errors, shows a branded error page, and (when Sentry is added later) reports the error.

**Risk if not done:** Bad UX on crash, but crashes are rare in the current codebase. This is polish, not security.

**Effort:** 10 minutes.

---

## Terminal parity checklist

What Terminal did and whether LASTPROOF needs to match:

| Terminal Action | LASTPROOF Status | Action Needed? |
|---|---|---|
| API keys out of NEXT_PUBLIC_ | Already done | No |
| XSS sanitization (DOMPurify) | No user HTML rendered | No — add if rich text features come |
| API route auth | Already done | No |
| CORS exact origin matching | Not configured | YES — add for launch |
| Security headers | Missing | YES — add for launch |
| Rate limiting | Missing | YES — add for launch |
| Sentry | Removed (zero-risk launch) | Later — add post-launch |
| Error boundaries | Missing | Later — low priority |
| Health endpoint | Exists at /api/health | No |
| Structured logger | Uses console.log/error | Later — sufficient for launch |

---

## Action plan — ordered by priority

### Before domain cutover (do now):

1. **Security headers** — add to `next.config.ts` (5 min, zero risk)
2. **Rate limiting** — add in-memory rate limiter to top 5 routes (30-60 min, low risk)

### After launch (first week):

3. Error boundaries in React layouts
4. Sentry integration (when proven stable)
5. CORS configuration if needed
6. Session secret rotation (decouple from INTER_TOOL_API_SECRET)

---

## Env var security review

| Env Var | Exposure | Correct? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Yes — URL only, no secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Yes — anon key, RLS blocks everything |
| `NEXT_PUBLIC_TG_BOT_USERNAME` | Client | Yes — public bot name |
| `NEXT_PUBLIC_TREASURY_WALLET` | Client | Yes — public Solana address |
| `NEXT_PUBLIC_SITE_URL` | Client | Yes — public domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | CORRECT |
| `HELIUS_RPC_URL` | Server only | CORRECT |
| `HELIUS_WEBHOOK_SECRET` | Server only | CORRECT |
| `INTER_TOOL_API_SECRET` | Server only | CORRECT |
| `INTER_TOOL_KEY_ID` | Server only | CORRECT |
| `LASTPROOF_GROQ_API_KEY` | Server only | CORRECT |
| `LASTPROOF_AR_WALLET` | Server only | CORRECT |
| `X_CLIENT_ID` | Server only | CORRECT |
| `X_CLIENT_SECRET` | Server only | CORRECT |
| `X_REDIRECT_URI` | Server only | CORRECT |
| `CRON_SECRET` | Server only | CORRECT |
