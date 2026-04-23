# Terminal ↔ LASTPROOF S2S Contract (LOCKED)

Source of truth for every cross-tool call between LASTPROOF and the LASTSHIFT Terminal. Shapes below are final — answered by the Terminal builder in `terminal-build/docs/TERMINAL-ANSWERS.md`. If Terminal's answers and this doc ever disagree, Terminal's doc wins and this one gets updated.

**All timestamps are UTC ISO 8601 with `Z` suffix.** Safe to `new Date(x)` directly. JSON keys are camelCase on validate, snake_case on affiliate confirm (historical lock).

---

## Auth headers — every S2S call

```
Authorization: Bearer ${INTER_TOOL_API_SECRET}
X-LastShift-Key-Id: v1
Content-Type: application/json
```

`X-LastShift-Key-Id` is rotation-ready from day one. Env: `INTER_TOOL_KEY_ID=v1`. When Terminal rotates, flip env to `v2`; no code change.

---

## 1. Validate — `POST ${TERMINAL_API_URL}/api/license/validate`

### Request

```json
{
  "walletAddress": "So1...",
  "terminalId": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "toolSlug": "lastproof"
}
```

### Success — HTTP 200

```json
{
  "valid": true,
  "walletAddress": "So1...",
  "terminalId": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "firstFiveThousand": true,
  "freeSubUntil": "2026-06-07T00:00:00Z",
  "subscriptionStatus": "free_ea",
  "verified": { "x": false, "telegram": false },
  "displayName": null,
  "createdAt": "2026-04-08T14:22:10Z"
}
```

- `freeSubUntil` — **always present**; `null` when `firstFiveThousand === false`, ISO string when `true`.
- `subscriptionStatus` — enum: `free_ea | active | past_due | canceled | none`. This is **Terminal's** EA/subscription state, NOT LASTPROOF's 30-day timer. Two different state machines — do not conflate.
- `verified` — object `{ x, telegram }`. Terminal is source of truth. Mirror both into `profiles.x_verified / telegram_verified` as read-only cache on every validate. LASTPROOF does not run its own X/TG OAuth.
- `displayName` / `createdAt` — nullable. Use `displayName` as default profile handle suggestion.
- Unknown keys are forward-compatible — treat as additive.

### Failure — reason codes + status mapping

| HTTP | Reason code(s) | Body shape | Notes |
|---|---|---|---|
| 400 | `malformed_request` | `{ valid: false, reason, message }` | LASTPROOF bug — alarm it |
| 401 | _(none)_ | `{ error: "unauthorized" }` | **Different body shape.** Bearer missing/invalid |
| 403 | `wallet_tid_mismatch`, `tid_regenerated`, `tool_not_entitled` | `{ valid: false, reason, message }` | |
| 404 | `tid_not_found`, `wallet_not_registered` | `{ valid: false, reason, message }` | |
| 429 | `rate_limited` | `{ valid: false, reason, message }` | `Retry-After` header in seconds. LASTPROOF bug if hit — alarm it |

`message` is human-readable, safe to surface as-is, not localized.

### TID regeneration grace window

- Old TID next validate → `tid_regenerated` for **30 days** → after which it falls through to `tid_not_found`.
- User must manually re-enter the new TID inside LASTPROOF (Terminal does not expose it via old wallet).
- On successful re-entry: match existing `operators` row by `terminal_wallet`, update `terminal_id` in place. Do not create a new row.

### Call frequency + caching

- **Call on**: (a) first load of an authenticated LASTPROOF session, (b) any gated action (publish, payment, profile edit), (c) resume from tab sleep > 15 min.
- **Do not** call on every page nav.
- Cache success in memory (per-process) with **5-minute TTL**. Invalidate early on gated actions.
- Rate limits: **30 req/min per wallet**, **600 req/min per IP**. Exceeding them is a LASTPROOF bug — alarm, don't surface.

### EA flag volatility

`firstFiveThousand` can flip `true → false` (fraud revocation). Never cache beyond the 5-min TTL. React immediately on flip.

---

## 2. Affiliate confirm — `POST ${TERMINAL_API_URL}/api/affiliate/confirm`

Called once when an operator publishes their LASTPROOF profile.

### Request (snake_case — historical lock)

```json
{
  "wallet": "So1...",
  "terminal_id": "SHIFT-XXXX-XXXX-XXXX-XXXX",
  "profile_url": "https://lastproof.app/@cryptomark"
}
```

### Success — HTTP 200

First confirm:
```json
{ "ok": true, "credited": true, "affiliate_slug": "cryptomark3r", "recorded_at": "2026-04-08T14:22:10Z" }
```

Idempotent duplicate (same `terminal_id` re-posted):
```json
{ "ok": true, "credited": false, "reason": "already_recorded", "affiliate_slug": "cryptomark3r" }
```

**Both are terminal success.** Stop retrying. `credited:false` is not an error.

### Failure

```json
{ "ok": false, "reason": "wallet_tid_mismatch", "message": "..." }
```

Reasons: `wallet_tid_mismatch | tid_not_found | wallet_not_registered | malformed_request | no_affiliate_on_record`. HTTP 400/403/404 per the validate mapping.

- `no_affiliate_on_record` — wallet wasn't referred by anyone. **Treat as terminal success.** Stop retrying.

### Soft dependency

Publish must **not** block on Terminal availability. Flow:

1. LASTPROOF writes `profiles.published_at = now()` locally, updates Grid visibility.
2. Enqueues the affiliate confirm call.
3. Retries: **6 attempts, exponential backoff, ~24h total**. Dead-letter to our log afterwards.
4. No webhook back from Terminal — strict request/response. Do not build a listener.

---

## 3. AR wallet + Helius — fully isolated

- `LASTPROOF_AR_WALLET` is a dedicated Solana address, not shared with Terminal. Any inbound = LASTPROOF payment.
- LASTPROOF provisions its own Helius project, own webhook URL, own API key, own quota. No overlap with Terminal's Helius usage.
- Webhook HMAC verification — roll our own (~20 lines) against `HELIUS_WEBHOOK_SECRET` using `crypto.timingSafeEqual`. No prebuilt helper from Terminal.

---

## 4. Shared utilities to lift (not rebuild)

- `terminal-build/src/hooks/useTokenData.ts` — Jupiter → GeckoTerminal fallback for `$LASTSHFT` price. Lift verbatim. Cache results on LASTPROOF side with **60s TTL**. Terminal repo is canonical if it drifts.
- `$LASTSHFT` mainnet mint: `5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB` (final, not a placeholder).

---

## 5. CORS allowlist (Terminal-side)

Terminal's validate endpoint allows:

- `https://lastproof.app`
- `https://www.lastproof.app`
- `http://localhost:3001` (LASTPROOF dev — deliberately not `:3000` to avoid colliding with Terminal dev)
- `http://localhost:3000` (Terminal dev — harmless)

Any new preview/staging origins must be sent to Terminal for allowlisting. No wildcards.

---

## 6. Dev environment flow

```
Local mock  →  staging.lastshift.app  →  prod (lastshift.app)
```

- Local mock lives at `app/api/_mock/terminal/*` with `TERMINAL_API_URL=http://localhost:3001/api/_mock/terminal`.
- Staging: Terminal provisions `staging.lastshift.app` and a distinct staging `INTER_TOOL_API_SECRET` when LASTPROOF's S2S client is ready. Ping Terminal at that milestone.
- Prod: swap `TERMINAL_API_URL` env + prod secret at cutover. No code change required.

---

## 7. Divergences from initial LASTPROOF assumptions

These caught us — if anyone re-reads old plan docs, these are the corrections:

1. `verified` is `{ x, telegram }`, not `boolean`.
2. `freeSubUntil` is always present (nullable), not conditional.
3. `subscriptionStatus` has 5 values, and it is **not** LASTPROOF's 30-day timer.
4. Reason codes include `rate_limited` and `malformed_request`.
5. `401` returns a different body shape (`{error:"unauthorized"}`).
6. `X-LastShift-Key-Id` header is mandatory from day one.
7. TID regen has a 30-day grace window.
8. AR wallet and Helius are fully isolated — LASTPROOF owns both.
9. Validate cache TTL: 5 min.
10. Jupiter price cache TTL: 60 s.
