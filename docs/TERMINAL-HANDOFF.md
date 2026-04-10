# LASTPROOF → Terminal Builder Handoff

**Date:** 2026-04-10
**From:** LASTPROOF build
**To:** Terminal builder
**Status:** LASTPROOF is code-complete for the authentication + First 5,000 campaign integration. This document tells Terminal what it needs to know, what it needs to deploy, and what changed since the original contract.

---

## 1. What LASTPROOF needs from Terminal (the minimum)

Terminal's job in this integration is narrow. Two endpoints, two jobs:

### Endpoint A — License Validate

```
POST /api/license/validate
```

LASTPROOF calls this when a user connects their wallet. It answers one question: **"Does this wallet have a valid Terminal ID with access to LASTPROOF?"**

**Request:**
```json
{
  "walletAddress": "So1...",
  "terminalId": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "toolSlug": "lastproof"
}
```

**Success response — the fields LASTPROOF actually uses:**
```json
{
  "valid": true,
  "walletAddress": "So1...",
  "terminalId": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "firstFiveThousand": true,
  "verified": { "x": false, "telegram": false },
  "displayName": "CryptoMark",
  "createdAt": "2026-04-08T14:22:10Z"
}
```

**Critical field: `firstFiveThousand`** — a boolean. `true` if this wallet claimed one of the first 5,000 spots. This is the ONLY flag LASTPROOF needs from Terminal to activate the free premium upgrade. See Section 3 for what changed here.

**Failure reasons LASTPROOF handles:**
- `wallet_not_registered` / `tid_not_found` → user gets "NO TERMINAL ID" screen with a button to `https://lastshift.app/connect`
- `wallet_tid_mismatch` / `tid_regenerated` / `tool_not_entitled` → error shown, user told to fix in Terminal
- `rate_limited` → LASTPROOF bug, we alarm it
- `401 unauthorized` → S2S secret mismatch

Full failure spec is in `docs/TERMINAL-CONTRACT.md` §1 (already locked).

### Endpoint B — Affiliate Confirm

```
POST /api/affiliate/confirm
```

LASTPROOF calls this once when a user publishes their profile for the first time. It tells Terminal: "This wallet just onboarded — credit the referrer if there is one."

**Request (snake_case — historical lock):**
```json
{
  "wallet": "So1...",
  "terminal_id": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "profile_url": "https://lastproof.app/@cryptomark"
}
```

**LASTPROOF never blocks on this call.** It's fire-and-forget with 6 retries over ~17 hours. If Terminal is down, the user still publishes fine.

Full spec in `docs/TERMINAL-CONTRACT.md` §2 (already locked).

---

## 2. The user flow Terminal needs to support

```
User connects wallet on lastproof.app/manage
        │
        ▼
LASTPROOF checks: does this wallet exist in our operators table?
        │
   ┌────┴────┐
   │ NO      │ YES
   │         │
   ▼         ▼
"NO TERMINAL ID"     LASTPROOF calls Terminal /api/license/validate
screen shows:        with wallet + TID from operators table
"LAUNCH TERMINAL"            │
button → links to    ┌──────┴──────┐
lastshift.app/       │ valid:true  │ valid:false
connect              │             │
                     ▼             ▼
              Session created    Error shown
              User enters        (mismatch, not
              LASTPROOF          entitled, etc.)
```

**What Terminal needs at `lastshift.app/connect`:**
- Let the user connect their Solana wallet
- Issue a Terminal ID (`SHIFT-XXXX-XXXX-XXXX-XXXX`)
- Register the wallet + TID so `/api/license/validate` will return `valid: true` for `toolSlug: "lastproof"`
- User then returns to `lastproof.app/manage` and connects again — this time it works

**LASTPROOF stores the wallet→TID mapping in its own `operators` table.** Terminal doesn't need to push anything to LASTPROOF. LASTPROOF discovers the TID on first successful validate and saves it locally.

---

## 3. WHAT CHANGED: LASTPROOF now owns the EA subscription expiry

This is the most important change since the original contract.

### Before (old assumption):
- Terminal provides `freeSubUntil: "2026-06-07T00:00:00Z"` in the validate response
- LASTPROOF passes that date through to `profiles.subscription_expires_at`
- Terminal is the source of truth for when the free window ends

### Now (current implementation):
- **LASTPROOF computes its own expiry date:** Grid launch (2026-05-08) + 30 days = **2026-06-07**
- LASTPROOF only needs `firstFiveThousand: boolean` from Terminal
- The `freeSubUntil` field in Terminal's validate response is **ignored by LASTPROOF**
- Terminal can keep sending it (backwards-compatible) or drop it — doesn't matter

### Why this changed:
- LASTPROOF runs its own 30-day subscription state machine (active → warning at 3 days → expired)
- The expiry date is tied to LASTPROOF's Grid launch date, not Terminal's timeline
- Having two systems own the same date created a single-point-of-coupling risk
- Terminal's job is identity + access (`firstFiveThousand`), not subscription lifecycle

### What Terminal needs to do:
- **Nothing changes on Terminal's side.** Keep returning `firstFiveThousand: true/false` as before.
- `freeSubUntil` and `subscriptionStatus` can stay in the response — LASTPROOF reads them into the session cookie for logging but does not use them for any business logic.
- If Terminal wants to drop `freeSubUntil` from the response in a future cleanup, that's fine. LASTPROOF won't break.

---

## 4. The First 5,000 campaign — how it works on LASTPROOF's side

Terminal doesn't need to implement any of this. This is context so you understand what `firstFiveThousand` triggers.

1. **User claims a spot** (however Terminal handles this — that's Terminal's domain)
2. **User connects wallet on LASTPROOF** → validate returns `firstFiveThousand: true`
3. **LASTPROOF shows the FOMO experience:**
   - Popup on first visit (theatrical countdown from ~2,100 to 0)
   - FOMO counter strip on the dashboard
   - FOMO footer on their public profile page
4. **User publishes profile** → LASTPROOF grants free premium:
   - `profiles.is_early_adopter = true`
   - `profiles.subscription_expires_at = 2026-06-07` (Grid launch + 30 days)
   - `profiles.is_paid = true`
   - No payment required
5. **Profile gets the "legend" public variant** — enhanced layout with trust tier, proof of work, screenshots, links, verifications
6. **After 2026-06-07** → subscription expires, profile drops to free tier unless they pay

### What happens when campaign sells out:
- LASTPROOF detects sold out via its own `/api/campaign/count` (Supabase query of `ea_claimed` count)
- FOMO strips disappear, normal paid upgrade experience takes over
- Users who already claimed keep their `firstFiveThousand = true` — it doesn't get revoked on sell-out (only fraud revocation flips it)

---

## 5. S2S authentication — already locked

```
Authorization: Bearer ${INTER_TOOL_API_SECRET}
X-LastShift-Key-Id: v1
Content-Type: application/json
```

Both tools share the same secret. LASTPROOF has this configured in its environment. Terminal needs to validate these headers on both endpoints.

**CORS allowlist (Terminal-side):**
- `https://lastproof.app`
- `https://www.lastproof.app`
- `http://localhost:3001` (LASTPROOF dev)

Note: S2S calls are server-to-server (LASTPROOF backend → Terminal backend), so CORS only matters if Terminal also serves these endpoints to browsers. If they're purely backend, no CORS config needed.

---

## 6. What LASTPROOF has already built and tested

| Component | Status |
|-----------|--------|
| S2S client (`terminal-client.ts`) | Done — typed, cached (5min TTL), handles all failure codes |
| Mock Terminal (local dev) | Done — matches real Terminal byte-for-byte, 10/10 smoke test |
| Session system (cookie-based, 12hr) | Done — HMAC-signed, HttpOnly |
| Wallet-gate flow | Done — operators table lookup → validate → session |
| "No Terminal ID" → redirect to Terminal | Done — links to `lastshift.app/connect` |
| Publish flow with EA grant | Done — `firstFiveThousand` triggers free premium |
| Affiliate confirm queue | Done — 6 retries, exponential backoff, ~17hr window |
| First 5,000 FOMO counter (popup, dashboard, profile) | Done — shared hook, 3-phase theatrical → real |
| Subscription state machine (30-day, warning, expired) | Done — 23 unit tests passing |

---

## 7. What Terminal needs to deploy / verify

### Must-have before LASTPROOF can go live:

1. **`/api/license/validate`** — returns `valid: true` with `firstFiveThousand` for registered wallets
2. **`/api/affiliate/confirm`** — accepts the publish callback (can be a no-op that returns `{ ok: true, credited: false, reason: "no_affiliate_on_record" }` if affiliate tracking isn't ready)
3. **`lastshift.app/connect`** — the page where users create Terminal IDs (LASTPROOF links here when wallet has no TID)
4. **S2S auth** — validate `Authorization: Bearer` + `X-LastShift-Key-Id` headers

### Nice-to-have (not blocking):

- `verified.x` / `verified.telegram` — LASTPROOF mirrors these into profiles but they're cosmetic for now
- `displayName` — used as default handle suggestion in onboarding, falls back gracefully if null
- `subscriptionStatus` — logged but not used for business logic
- `freeSubUntil` — logged but not used (LASTPROOF computes its own)

### Staging coordination:

When Terminal has staging ready at `staging.lastshift.app`:
- Provision a staging `INTER_TOOL_API_SECRET`
- LASTPROOF swaps `TERMINAL_API_URL` env var — no code change needed
- Test the full flow: wallet connect → validate → onboard → publish → affiliate confirm

---

## 8. Quick reference — Terminal's validate response

Fields marked **USED** are read by LASTPROOF business logic. Fields marked **LOGGED** are stored in the session but don't drive decisions.

```
{
  "valid": true,                          // USED — gate to session creation
  "walletAddress": "So1...",              // USED — session identity
  "terminalId": "SHIFT-XXXX-...",         // USED — stored in operators table
  "firstFiveThousand": true,              // USED — triggers EA free premium
  "freeSubUntil": "2026-06-07T...",       // LOGGED — not used (LASTPROOF owns expiry)
  "subscriptionStatus": "free_ea",        // LOGGED — not used
  "verified": { "x": false, "tg": false },// USED — mirrored to profile badges
  "displayName": "CryptoMark",            // USED — default handle suggestion
  "createdAt": "2026-04-08T..."           // LOGGED — not used
}
```

---

## 9. File references (LASTPROOF side)

If Terminal builder wants to see exactly how these calls are made:

| What | File |
|------|------|
| S2S client + types | `src/lib/terminal-client.ts` |
| Session encode/decode | `src/lib/session.ts` |
| Wallet-gate endpoint | `src/app/api/auth/wallet-gate/route.ts` |
| Publish + EA grant | `src/app/api/profile/publish/route.ts` |
| Affiliate queue | `src/lib/affiliate-queue.ts` |
| Subscription state machine | `src/lib/subscription.ts` |
| Mock Terminal (validate) | `src/app/api/mock/terminal/api/license/validate/route.ts` |
| Mock Terminal (affiliate) | `src/app/api/mock/terminal/api/affiliate/confirm/route.ts` |
| Full S2S contract | `docs/TERMINAL-CONTRACT.md` |
