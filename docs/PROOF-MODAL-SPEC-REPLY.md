# LASTPROOF — Proof Modal Spec · Backend Reply

**Status:** Contract answers + capability gaps, replying to `docs/PROOF-MODAL-SPEC.md` (commit `ee7b3e1`).
**Audience:** Frontend — use this to lock the spec and start implementation.
**Owner:** Backend.

> **Canon:** Wireframe is `wireframes/lastproof-proof-modal.html`. Tier/trust rules per `CLAUDE.md` and `LASTPROOF-BUILDER-HANDOFF.md`. When any of these disagree, the wireframe wins and both docs get updated.

---

## 0. TL;DR

All 23 questions answered. No capability gaps that block implementation. Two refinements to the contract (fold `/build-tx` into `/broadcast` handoff, add explicit `/abandon`) but nothing the FE has to re-architect around. Eligibility gate architecture matches the preview I gave earlier — Helius primary, Solscan fallback, parallel fanout, SSE streaming, PG session-scoped advisory lock on `(work_item_id, 'dev')`.

---

## 1. Project + wire contract (Q1–Q4)

**Q1 — `work_item.project_token_mint` available at read time?**
Yes. The `work_items` store (being built next, see todo list) carries `project_token_mint` as a `text` column on the row. Public profile projector hydrates it into `PublicProfileView.workItems[i].projectTokenMint`. No extra round-trip on modal open.

**Q2 — Canonical "currently at this project" field?**
Use `endDate === null` as the truth. `is_current` on the view type is a derived convenience — computed in the projector as `endDate == null`. FE should not persist it separately. The `CURRENT` tag on the wireframe renders off the null check.

**Q3 — Supported wallet set unchanged?**
Yes. Phantom, Solflare, Jupiter, Binance. `lib/wallet-policy.ts` is the gate and it hasn't moved. No WalletConnect, no Backpack, no Ledger direct. If a fifth wallet shows up in the adapter list, `classifyWallet()` returns `{ tier: 'blocked' }` and the pay flow refuses to issue a quote (this is live in `/api/quote/route.ts` today — see `walletAdapter` check).

**Q4 — All four wallets equal-tier?**
Yes, present them equal in the picker. The earlier `verified/unverified` split is gone. If Jupiter or Binance ever stalls in production, we surface it as a runtime error (`rpc_degraded`-style), not as a pre-sign warning badge. Equal-tier in UI, equal-tier in policy.

---

## 2. Comment sanitization (Q5)

**Q5 — Moderation layer?**
v1: **no third-party moderation**. Sanitization only:
- ≤140 chars, server re-counts after NFC normalize
- strip control chars (0x00–0x1F except newline, which is also stripped)
- strip URLs via a conservative regex (`/\b(?:https?:\/\/|www\.)\S+/gi`)
- reject comments that are >80% non-alphanumeric (emoji spam guard)
- reject empty after sanitization only if the user typed something — pure empty is allowed

Server is the final word. FE sanitization is UX-only (prevents the user typing past 140), backend re-runs all of the above and rejects with `400 comment_invalid` + `reason` enum (`too_long`, `contains_url`, `emoji_spam`, `control_chars`).

No profanity filter. These comments are permanent and publicly attached to the operator's profile — the operator has a reputational incentive to report abuse, and we'll add a "flag this proof" button in v1.1 with manual moderator review. Auto-moderation in v1 would produce false positives on crypto slang (`degen`, `aped`, `rekt`, etc) and we're not willing to eat that drift.

---

## 3. Pricing + BUY link (Q6–Q8)

**Q6 — `/wallet-context`.** Resolved, folded into `/eligibility`.

**Q7 — Buy $LASTSHFT URL.**
Canonical is `https://lastshiftcoin.com/buy`. User-confirmed. Do not swap to a Jupiter deep-link — the buy page does its own routing (Jupiter, Raydium, direct) and tracks the referral. Hardcode `https://lastshiftcoin.com/buy` in the modal; no env var needed.

**Q8 — Insufficient balance handling.**
**Pre-sign**, always. Balance is checked inside the `/eligibility` response as the `balance` row of `checks[]`. If `BAL < required`, the `checks[].balance.ok = false` and the whole response is `eligible: false` with `reason: "insufficient_balance"`. The FE must never advance to step 6 on insufficient balance — the terminal log on step 5 shows the red `[✗] BALANCE` row and routes to the try-new-wallet CTA.

We never fall through to a signature failure for balance. The only way balance can drift between eligibility and signing is if the user moves funds mid-flow, and that's caught by the re-verify inside `/refresh` at the 45s stale threshold (see Q16b).

---

## 4. Eligibility (Q9–Q14) — the critical path

### Q9 — Deployer detection

**Source of truth: live on-chain, Helius primary, Solscan fallback.**

`lib/token-dev-verify.ts` will implement three check functions, each parallelizable:

```ts
async function checkMintAuthority(mint, pubkey): Promise<CheckResult>
async function checkDeployer(mint, pubkey): Promise<CheckResult>      // signed mint tx
async function checkFirstNMinters(mint, pubkey, n=5): Promise<CheckResult>
```

- **`checkMintAuthority`** — single `getAccountInfo(mint)` call, parses the SPL mint account, compares `mintAuthority` pubkey to the connected wallet. ~150ms warm, ~400ms cold. Fast.
- **`checkDeployer`** — `getSignaturesForAddress(mint, { limit: 1000 })` → walk back to the earliest signature → fetch that tx → check if the connected wallet is in the signer list. ~500ms warm, **2–4s cold**. Slow.
- **`checkFirstNMinters`** — derived from the same tx history scan as `checkDeployer` (we reuse the signature list and check the first 5 mint-to-recipient instructions). Shares the slow fetch with deployer, adds ~50ms of parse time. Essentially free once deployer runs.

**Provider:** Helius primary (`HELIUS_RPC_URL`). On 429 or >2s timeout for any individual call, fall back to Solscan Pro API. Provider choice is per-call, not per-request — if Helius is slow on the tx history but fast on mint authority, we mix.

**p95 latency budget (full eligibility payload, cold):**
- Fast checks (uniqueness, slot, balance, mint-authority) — parallel — ~400ms wall-clock
- Slow checks (deployer, first-5) — shared RPC call — ~2.5–4s wall-clock
- **Total p95: ~4.5s cold, ~800ms warm**

This exceeds the original 2.5s budget, which is why we're going SSE streaming. See §5 below.

### Q10 — First-5 holder check

**Definition: the first 5 unique recipient wallets in the mint's initial token distribution.**

Algorithm:
1. Walk mint tx history oldest-to-newest.
2. For each tx that contains a `MintTo` instruction, collect the recipient token account.
3. Resolve token accounts to owner pubkeys (cached).
4. Take the first 5 unique owners.
5. Check membership of the connected wallet.

**Vesting/Streamflow edge case:** if the recipient is a program-derived address (e.g. Streamflow vault), we resolve it one hop further by reading the vault's beneficiary field. If the beneficiary matches, it counts. If it doesn't (generic custodial vault, unknown program), it **doesn't count** — the user must hit deployer or mint-authority instead. This is deliberately strict: a vesting contract beneficiary is a "holder," but a DAO treasury multisig that happens to be a first recipient is not.

This is a trust-system decision and it can tighten in v2 if we see abuse. It cannot loosen without a `lib/token-dev-verify.ts` version bump and a migration audit.

### Q11 — Founder multisig check

**Aspirational in v1.** Not implemented. Render the row as a neutral `[–] FOUNDER  not checked in v1` line, not a `[✗]`. Do not fail eligibility on founder-multisig in v1.

Why: the only reliable way to detect "founder multisig" on Solana is via Squads Protocol v3 signer introspection, and Squads is one ecosystem among several (Goki, Mean Multisig, custom 2-of-3s). Supporting all of them is a rabbit hole that's not worth blocking the modal ship on. We'll add it in v1.1 with a Squads-only first pass and widen from there.

**FE action:** treat `checks.founder.ok` as `null` (render as neutral `[–]`), not `false` (which would render as `[✗]` and feel like a failure). I'll return `{ id: "founder", ok: null, label: "FOUNDER", detail: "not checked in v1" }` in the eligibility payload. Handle `ok: null` as "neutral — don't style as success or failure."

### Q12 — Balance-to-token conversion

**Backend-computed. FE never does fee math.**

The eligibility response returns `quote.amount_ui` (human-readable, e.g. `8.33`) and `quote.amount_raw` (smallest-unit integer as string, e.g. `"8330000"` for 6-decimal $LASTSHFT). FE displays `amount_ui`, passes `amount_raw` into the tx builder if it needs it (it shouldn't — `build-tx` reads the quote server-side).

Conversion math lives in `lib/pricing.ts` which already handles the 40% discount and the Jupiter → GeckoTerminal fallback. No FE duplication.

### Q13 — Quote TTL + refresh semantics

**TTL: 90 seconds** from `/eligibility` response. Short enough that price drift stays bounded, long enough that a user reading the review card doesn't time out during a legitimate reading.

**Refresh contract (locked with Q16b above):**
- FE polls `POST /api/proof/quote/{id}/refresh` at T-30s before `expires_at` (i.e. at 60s elapsed).
- Response is one round-trip with three outcomes (`ok: true`, `ok: false` with reason, `409 lock_lost`).
- If eligibility age ≥ 45s when refresh is called, backend re-runs eligibility inside the same PG advisory lock session. Warm RPC cache reused where possible. Re-verified response carries `eligibility.reVerified: true`.
- The refresh **extends** the quote's `expires_at` by another 90s if it succeeds. Same `quote_id` throughout. See Q15.

**Hard expiration** (user ignored the poll, sat on the review card past `expires_at` without clicking refresh): the review card is replaced by the inline `QUOTE EXPIRED — REFRESH PRICE` banner. Single button hits the same `/refresh` endpoint. No bounce to step 1.

### Q14 — Atomicity

**PG session-scoped advisory lock on `hashtext('lastproof:dev-slot:' || work_item_id)`**, acquired inside a long-lived pooled connection.

Lock lifecycle:
1. **Acquire** on `/eligibility` entry, after wallet uniqueness check passes but before the on-chain fanout runs. `pg_try_advisory_lock` (non-blocking) — if another connection holds it, return `409 dev_slot_contested` immediately (FE surfaces this in the terminal log as `[✗] SLOT  another wallet is mid-verify, try again`).
2. **Hold** through step 6 review and step 7 signing. Same connection, same session. No xact-scoped locks because we don't want a transaction open for 90s.
3. **Release** on one of:
   - `/broadcast` success → lock released + proof row committed
   - `/broadcast` failure → lock released + quote marked abandoned
   - `/abandon` endpoint called by FE (disconnect, timeout, back button)
   - **Connection death** (tab close, network drop) → PG reaps the session → lock auto-releases. Free and bulletproof, exactly as you requested.
   - **120s idle timeout** on the review screen without any FE heartbeat → connection deliberately closed server-side → lock drops → FE's next action hits `409 lock_lost` and force-disconnects.

**Uniqueness enforcement layer 2:** a unique partial index on `proofs(work_item_id) WHERE path = 'dev'`. Even if two sessions somehow raced past the advisory lock (they won't, but belt-and-braces), the `INSERT` into `proofs` on the second one fails and the backend returns `409 dev_slot_taken`. FE handles this the same as the lock-lost path.

**Heartbeat:** FE does not need to send a heartbeat. The refresh poll at T-30s is the de facto heartbeat — if the backend sees a refresh call, it knows the FE is alive and extends. If it doesn't, the lock times out at 120s and the slot frees.

---

## 5. Latency + SSE streaming

**Confirmed: we go SSE.** Protocol is `text/event-stream`. Vercel Edge runtime handles it natively, no buffering quirks on our Node-runtime path either.

**Endpoint:** `POST /api/proof/eligibility` returns `Content-Type: text/event-stream` always. Even on fully cached responses, the FE reads the stream — treats SSE as the single transport. One code path.

**Event schedule (p95 cold):**

```
event: start
data: { "quote_id": "qt_01H...", "path": "dev", "mint": "F7k2...9xMp" }

event: check
data: { "id": "uniqueness", "label": "UNIQUENESS", "ok": true, "detail": "..." }
// ~100ms

event: check
data: { "id": "slot", "label": "SLOT", "ok": true, "detail": "..." }
// ~150ms

event: check
data: { "id": "balance", "label": "BALANCE", "ok": true, "detail": "1,250.00 $LASTSHFT · need 8.33" }
// ~300ms

event: check
data: { "id": "mint_authority", "label": "MINT-AUTHORITY", "ok": true, "detail": "..." }
// ~400ms

event: check
data: { "id": "deployer", "label": "DEPLOYER", "ok": true, "detail": "slot 3 of first-5 holders" }
// ~2500ms — the long pole, fused with first-5

event: done
data: {
  "eligible": true,
  "quote": { "token": "lastshft", "amount_ui": 8.33, "amount_raw": "8330000", "usd": 3.00, "usd_rate": 0.00012, "quote_id": "qt_01H...", "expires_at": "2026-04-09T18:23:30Z" }
}
```

On ineligible paths the same sequence emits, with the failing check's `ok: false`, and the final event is:

```
event: done
data: { "eligible": false, "reason": "dev_checks_failed", "failed_checks": ["mint_authority", "deployer"] }
```

**FE behavior:**
- Treat `event: check` as "append this line to the terminal log." Do nothing else.
- Treat `event: done` as "unlock the continue button" (eligible) OR "force-disconnect and show the try-new-wallet screen" (ineligible).
- Treat the SSE connection closing without a `done` event as `rpc_degraded` — show the generic `"network busy — retry in a few seconds"` copy and put a retry button on screen.

**Check ordering (locked):**

```
uniqueness → slot → balance → mint_authority → deployer (+ first-5 fused)
```

Fast→slow, with balance in the middle where it gates the rest. First-5 is fused with deployer because they share the slow `getSignaturesForAddress` call — rendering them as two separate lines would be visually honest but wall-clock identical, so I'm fusing them in the event payload with a combined `detail` string:

```
detail: "signed mint tx · slot 3 of first-5 holders"
```

If FE wants to render two separate lines for visual pacing, split the detail on ` · ` and fake a 150ms stagger between them on the client. Backend sends one event.

**COLLAB flow:** same shape, 3 check events (`uniqueness → slot → balance`) + `done`. ~400ms wall-clock p95. No streaming drama.

---

## 6. Quote refresh (Q15–Q16b)

**Q15 — Same `quote_id` on refresh?**
Yes. Same `quote_id`, extended `expires_at`, updated `amount_ui` / `amount_raw` / `usd_rate`. The signing payload (memo, tx build) is keyed on `quote_id`, so keeping it stable means the FE never has to re-wire state between the review card and the sign screen.

**Q16 — Quote expired inline pattern.** Resolved in spec.

**Q16b — Refresh re-verifies at ≥45s stale.** Resolved in spec. `reVerified: true` flag returns on the response.

One addendum: when the refresh triggers a re-verification, it runs the SSE stream **inside the refresh endpoint too** (not just `/eligibility`). FE can choose to re-animate the terminal log for the ~2.5s re-check, or just silently wait with a spinner. I lean toward the re-animation since it reinforces the "we're checking on-chain right now" story and matches the subtle-flicker you mentioned in the ee7b3e1 commit message.

If FE goes with the re-animation: treat `POST /api/proof/quote/{id}/refresh` with `Accept: text/event-stream` as the SSE variant, and `Accept: application/json` as a single-shot response that blocks until the re-check completes. Server supports both. FE picks per call.

---

## 7. Signing + broadcast (Q17–Q20)

**Q17 — Memo format.**
Locked as: `lp:v1:{handle}:{ticker}:{path}:{quote_id}`

Example: `lp:v1:cryptomark:$LASTSHFT:dev:qt_01HXYZ...`

Version prefix `lp:v1:` is mandatory so we can evolve. Parser is in `lib/memo.ts`. If the chain scanner ever sees a memo that doesn't start with `lp:v1:`, it's ignored.

Total memo length stays under 120 bytes (Solana memo program limit is 566 bytes but we stay conservative). `quote_id` is ULID (26 chars), handle max 30, ticker max 12. Well under.

**Q18 — Partial signing?**
**Pure client-signed.** No backend co-signer, no fee sponsorship. The tx is a single SPL transfer from the connected wallet to `LASTPROOF_AR_WALLET` with a memo instruction appended. Wallet pays its own network fee (~0.000005 SOL). No partial signing state.

Why not sponsor fees: (a) adds a treasury leak for a non-user-visible UX improvement, (b) forces a backend keypair into the hot path which is a compliance headache, (c) wallet fees are fractions of a cent. Not worth it.

**Q19 — Abandon endpoint.**
**Yes, adding it.** `POST /api/proof/abandon { quote_id }` → `200 { released: true }`. Called by FE on:
- Wallet timeout (step 7 60s hang) → abandon + route to failure
- Manual disconnect (conn-pill click) → abandon + route to DISC
- Back navigation from step 6/7 to step 1 → abandon + return to step 1
- Browser tab close → **not needed**, PG session death releases the lock automatically. `/abandon` is for graceful FE cancellations where we still have a session open.

Idempotent — calling abandon on an already-consumed quote returns `200 { released: false, reason: "already_consumed" }`. Not an error.

**Q20 — Idempotency on broadcast.**
**Yes, keyed on `quote_id`.** The broadcast endpoint:
1. Looks up the quote.
2. If `status = 'consumed'` with a `signature` already set → return `200` with the existing proof + signature. Double-clicks and network retries are safe.
3. If `status = 'consumed'` without a signature (shouldn't happen, guard rail) → `500 consistency_error` + alert.
4. If `status = 'issued'` → run the broadcast, mark consumed, return.
5. If `status = 'expired'` → `410 quote_expired`.

The FE can retry `/broadcast` as many times as it wants on the same `quote_id` and only the first one does work. All subsequent calls return the same success envelope.

---

## 8. Outcomes (Q21–Q23)

**Q21 — Enumerable failure codes.**

Full enum with copy:

| Code | Source | User-facing copy |
|---|---|---|
| `user_rejected` | Wallet adapter returns cancel/reject | `"Signature cancelled in wallet."` |
| `insufficient_balance` | Re-check at build time (rare, race condition) | `"Wallet balance dropped since verification. Top up and retry."` |
| `blockhash_expired` | RPC returned `BlockhashNotFound` | `"Transaction timed out. Retry to get a fresh blockhash."` |
| `tx_reverted` | Broadcast succeeded but tx failed on-chain | `"Transaction reverted on-chain. No funds moved."` |
| `rpc_degraded` | RPC timeout/rate-limit/5xx | `"network busy — retry in a few seconds"` |
| `quote_expired_hard` | Quote aged out between sign and broadcast | `"Price quote expired. Refresh to get a new price."` |
| `lock_lost` | Advisory lock dropped mid-flow | `"Verification session expired. Please reconnect and try again."` |
| `dev_slot_taken` | Another wallet grabbed the slot | `"Another wallet just claimed the dev proof slot for this project."` |
| `signature_invalid` | Signed tx failed server-side validation | `"Signature rejected. Please try again."` |
| `unknown` | Genuine unclassified failure | `"Something went wrong. Please try again."` |

FE should branch the step 8 fail copy on these codes. The wireframe has one generic error state — please add a `reason` field to the failure card and conditionally render the headline + sub based on the enum above. I'll document this in the next spec update.

**Q22 — Retry from failure.**

On clicking `RETRY PROOF` from step 8 fail:
- If quote is still valid (`expires_at` in future) AND eligibility age < 45s → jump back to step 6 with the same quote, no re-check needed.
- If quote is valid but eligibility age ≥ 45s → hit `/refresh` first, then jump to step 6.
- If quote is expired or `lock_lost` was the failure → **restart at step 2** (reconnect wallet). Don't try to reuse anything. Explain this in the retry transition with a one-line toast: `"Session expired — please reconnect."`

FE logic tree:
```ts
if (failure.reason === 'lock_lost' || failure.reason === 'quote_expired_hard') {
  goToStep(2); showToast('Session expired — please reconnect.');
} else if (quoteIsValid(quote) && eligibilityAgeMs < 45_000) {
  goToStep(6);
} else if (quoteIsValid(quote)) {
  await refresh(quote.id); goToStep(6);
} else {
  goToStep(2);
}
```

**Q23 — Proof count update.**

**Synchronous, in the same transaction that writes the proof row.**

Flow:
1. `/broadcast` verifies signature on-chain (wait for finality, ~400ms after broadcast).
2. Opens a DB transaction.
3. Inserts the `proofs` row.
4. `UPDATE profiles SET proof_count = proof_count + 1 WHERE id = :profile_id`.
5. Calls `recalcTier(profile_id)` inline — reads the new count, writes `profiles.tier` if it changed.
6. Commits.
7. Returns `200` with `proof_id`, `signature`, `solscan_url`.

Total p95 ~600ms from broadcast → response. The success screen's "the operator's count just ticked up by 1" is true at the moment the FE renders it — the DB is already consistent.

**No async events for this.** Tier recalc is fast enough to do inline and the atomicity guarantee is more valuable than the ~100ms we'd save by pushing it to a queue.

---

## 9. Capability gaps

None that block implementation. Three things worth flagging:

1. **Helius rate limits** — under load we'll hit 429s and fall back to Solscan. Solscan's tx history API is slower (3–6s p95 cold) and has its own rate limit (5 req/s on the free tier, 50 req/s on pro). We're on pro. If we exceed that, the fallback to "retry in a few seconds" kicks in. Watch, not block.

2. **Squads v3 signer introspection (Q11)** — deferred to v1.1 as aspirational. Founder-multisig check renders as neutral `[–]` in v1. FE needs to handle `ok: null` as a third state in the check row renderer.

3. **Memo program instruction appending** — the Solana memo program is permissive but some wallets (historically: very old Phantom versions) strip unknown instructions before signing. We've tested Phantom current, Solflare current, Jupiter current, Binance current — all preserve memo. If this breaks in production on a wallet version drift, the fallback is a base64 memo encoded as a self-transfer of 0 lamports. Watch, not block.

---

## 10. Endpoint counter-proposals

Most of your proposed shapes are fine. Three refinements:

### a. `/eligibility` is always SSE

Not two endpoints (JSON + SSE), one endpoint with content negotiation. Default: `text/event-stream`. Client passes `Accept: application/json` to force a single-shot response (useful for server-side tests, not the modal path).

### b. Fold `/build-tx` into `/broadcast`? **No — keep them separate.**

I initially considered folding them, but the wallet adapter flow needs the serialized tx before it can prompt the user for a signature. If we folded them, the FE would have to: call `/broadcast` → backend returns serialized tx → FE signs → FE calls `/broadcast` **again** with the signature. Two endpoints is cleaner.

Keep your proposed shape:
- `POST /api/proof/build-tx { quote_id } → { tx_base64, expected_signer, memo }`
- `POST /api/proof/broadcast { quote_id, signed_tx_base64 } → { proof_id, signature, confirmed_at, solscan_url }`

### c. Add `/abandon` (new)

```
POST /api/proof/abandon
body: { quote_id }
→ 200 { released: true }                         // lock dropped, quote marked abandoned
→ 200 { released: false, reason: "already_consumed" }   // idempotent no-op
→ 404 quote_not_found
```

---

## 11. Locked contract summary

**Endpoints (final):**

```
POST /api/proof/eligibility           SSE (default) | JSON (Accept override)
POST /api/proof/quote/:id/refresh     SSE (default) | JSON (Accept override)
POST /api/proof/build-tx              JSON
POST /api/proof/broadcast             JSON
POST /api/proof/abandon               JSON
```

**Locks:**
- PG session-scoped advisory lock on `hashtext('lastproof:dev-slot:' || work_item_id)`, held through the full flow
- 120s idle timeout, auto-releases on connection death
- `pg_try_advisory_lock` (non-blocking) → `409 dev_slot_contested` on contention

**Quotes:**
- 90s TTL
- Refresh at T-30s (60s elapsed) from FE
- Refresh re-verifies eligibility at ≥45s stale, inside the same session
- Same `quote_id` throughout
- Hard expiry → inline refresh banner on step 6

**Check ordering (fused):**
```
uniqueness → slot → balance → mint_authority → deployer(+first-5 fused) → [founder: v1.1, rendered as neutral]
```

**Latency (p95):**
- Warm: ~800ms full payload
- Cold: ~4.5s full payload (SSE streams mean user sees first line at ~100ms)

**Failure enum:** 10 codes, each with distinct user-facing copy (see Q21).

**Proof count update:** synchronous, same DB transaction as the proof insert.

---

## 12. Open items for frontend

None that block. Two FYIs for when you start the TS/CSS:

1. **Neutral check rendering.** The wireframe's `[✓]` / `[✗]` binary needs a third state `[–]` for `ok: null` (the v1 founder row). CSS class suggestion: `.pp-check-neutral` styled grey, no pulse.

2. **SSE parser.** The FE will need a simple SSE reader. Recommend `eventsource-parser` (tiny, no deps) over hand-rolling. Or the native `EventSource` API if Vercel doesn't give you CORS grief on the same-origin path — which it shouldn't.

---

## 13. What changes in the spec

I'll leave the actual spec edit to you since you're the owner of `docs/PROOF-MODAL-SPEC.md`. The deltas to apply:

- §3 step 5: replace the JSON endpoint shape with the SSE event schedule from §5 above
- §3 step 5: add `ok: null` neutral state to the `checks[]` type
- §3 step 5 Q9–Q14: mark all resolved, link to this doc
- §3 step 8 Q21: replace the generic failure state with the 10-code branched copy
- §3 step 8 Q22: insert the FE logic tree
- §3 step 8 Q23: mark sync resolved
- §6 master list: strike through all 23 questions, link to this doc
- Add `/abandon` to the endpoint list in §3 step 7 or a new §3.5
- Footer: add "Backend reply locked in `docs/PROOF-MODAL-SPEC-REPLY.md` commit `<commit>`"

Once you apply those, the spec is implementation-ready.

— Backend
