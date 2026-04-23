# LASTPROOF → Terminal Builder: Contract Questions

**From:** LASTPROOF build
**To:** Terminal builder
**Context:** LASTPROOF is scaffolding the skeleton wiring for identity, payments, and reconciliation. Before we build the mock routes and the real S2S client, we need a handful of contract details locked so we don't guess wrong and rewrite.

Questions are grouped by subsystem. **Blockers (B)** we can't skeleton around — we'll have to guess at shapes otherwise. **Clarifiers (C)** we can fake in the local mock and correct later, but would rather know up front.

Please keep answers to contract/shape/semantics only. We're not asking how Terminal implements anything internally, and we're not asking for guidance on how LASTPROOF should be built — only what Terminal returns and expects.

---

## 1. Terminal validate contract (`POST /api/license/validate`)

### B1. Success payload — exact shape, field-by-field
Plan has `{ valid, firstFiveThousand, subscriptionStatus, freeSubUntil, verified }`. Confirming:
- Is `freeSubUntil` always present, or only when `firstFiveThousand === true`? Null vs omitted key?
- Is `verified` the Terminal-side X + Telegram verified flag? Should LASTPROOF mirror it into its own `profiles.x_verified / telegram_verified`, or is LASTPROOF verification independent?
- Any additional fields Terminal already tracks per-wallet that LASTPROOF should consume instead of re-asking the user? (e.g. `displayName`, `createdAt`, anything else.)

### B2. Failure payload — exact shape
Plan lists reason codes: `wallet_tid_mismatch | tid_regenerated | tid_not_found | wallet_not_registered | tool_not_entitled`. Confirming:
- Are these the final strings?
- Are there others we should handle?
- Is the HTTP status always 403, or do some reasons return 404 / 401 / 422?

### B3. Call frequency + rate limits
How often should LASTPROOF call validate? Every page load, once per session, once per day? Is there a rate limit or budget per wallet? This decides whether we cache the result with a TTL or hit it live on every gated action.

### B4. TID regeneration semantics
- When a user regenerates their TID in Terminal, does the old TID's next validate return `tid_regenerated` specifically (vs `tid_not_found`)?
- After regeneration, does Terminal expose the new TID via the old wallet address, or must the user manually re-enter the new TID on LASTPROOF?
- Assuming re-entry: LASTPROOF will match the existing row by `terminal_wallet` and update `terminal_id` in place. Any objection?

### C5. Timestamp format
Is `freeSubUntil` always UTC ISO 8601? Same question for every other timestamp Terminal returns. We want to never touch timezone math on the client.

---

## 2. Affiliate confirm callback (`POST /api/affiliate/confirm`)

### B6. Response shapes
Request payload is locked (`{wallet, terminal_id, profile_url}` snake_case). What does Terminal return on:
- Success (first confirm)?
- Duplicate / idempotent hit (same `terminal_id` twice)?
- Failure — bad wallet, TID mismatch, malformed `profile_url`?

### B7. Hard or soft dependency on publish?
If Terminal is unreachable when a user clicks "publish" on LASTPROOF, should we:
- (a) block publish and surface an error, or
- (b) mark the profile published locally and retry the callback in the background?

Preference on our side is (b) with a retry queue, but this is a product call — what's Terminal's read on whether losing a confirm is acceptable?

### C8. Does Terminal emit anything back to LASTPROOF from the affiliate side (webhook, signed event), or is it strictly request/response?

---

## 3. Inter-tool S2S secret

### B9. Rotation
Is `INTER_TOOL_API_SECRET` a single shared secret forever, or is there a rotation / versioning / key-id scheme LASTPROOF should support from day one?

### B10. Transport
Plan says bearer token in plaintext (`Authorization: Bearer ...`). Confirming Terminal is **not** also validating an HMAC signature over the request body on top of the bearer.

---

## 4. Wallet registration + tool entitlement

### B11. Auto-provision timing
Plan says "tool entitlements auto-provisioned Terminal-side on wallet registration." Confirming: the moment a wallet registers in Terminal, `toolSlug: "lastproof"` is a valid entitlement — so LASTPROOF's *first ever* validate call for that wallet succeeds with no additional provisioning step and no race window.

### C12. Cold-start case
If a user has a Terminal wallet but has never opened LASTPROOF, is their `lastproof` entitlement already live, or does Terminal want a "first touch" event from LASTPROOF to activate it?

---

## 5. $LASTSHFT token data

### C13. `useTokenData.ts` freshness
Can we lift `terminal-build/src/hooks/useTokenData.ts` verbatim, or has it drifted since the handoff doc? Still the canonical Jupiter → GeckoTerminal fallback?

### C14. Shared price cache
Does Terminal run a shared price cache (Redis / KV / Vercel edge cache) LASTPROOF should read from, or should LASTPROOF hit Jupiter independently? We'd rather not double the upstream load.

### C15. Mint address
Confirming `5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB` is the final mainnet `$LASTSHFT` mint, not a devnet placeholder.

---

## 6. Payments / AR wallet / Helius

### B16. AR wallet isolation
Is `LASTPROOF_AR_WALLET` a fresh dedicated wallet, or shared with Terminal's AR wallet? This affects our webhook filter and reconciliation logic.

### B17. Helius webhook ownership
Does Terminal already own a Helius project LASTPROOF plugs into, or does LASTPROOF provision its own Helius project with its own webhook URL and API key? Matters for env config and quota coordination.

### C18. Webhook signature verification
Does Terminal already have a proven HMAC-verification helper for Helius webhooks LASTPROOF can copy, or should we roll our own?

---

## 7. Tier + EA semantics

### C19. First-5,000 counter ownership
Confirming Terminal owns the First 5,000 count and LASTPROOF never computes it — LASTPROOF only trusts `firstFiveThousand` from validate.

### C20. EA flag revocation
Can `firstFiveThousand` ever flip from `true → false` (e.g. fraud revocation)? If yes, LASTPROOF must react on every validate call, not cache the flag.

---

## 8. Operational / dev environment

### B21. Staging environment
Does Terminal have a staging URL (e.g. `staging.lastshift.app`) LASTPROOF can point `TERMINAL_API_URL` at after the local mock and before production cutover? Or is it mock → prod directly?

### C22. Shared observability
Is there a shared error-reporting / logging pipeline (Sentry project, Logtail, etc.) Terminal uses that LASTPROOF should join from day one, or are we free to pick our own?

### C23. CORS / allowed origins
Does Terminal's validate endpoint allow calls from `lastproof.app` and a local dev origin (e.g. `localhost:3001` to avoid Terminal's `:3000`)? If there's an allowlist, we need to be on it before the first real call.

---

## Out of scope for this ask
- UI, component, database, or internal-logic decisions on either side.
- How Terminal implements anything — only what it returns.
- SHIFTBOT (LASTPROOF owns its own instance).
- Revenue split / burn (handled off-platform).

## Priority
If Terminal has limited bandwidth, the **B-prefixed blockers** are what we genuinely cannot skeleton around:
**B1, B2, B6, B9, B10, B11, B16, B17, B21.**
The C's are nice-to-have and can be faked in the local mock for now.
