# PROOF FLOW V3 — Fullstack Builder's Architecture Plan

**Author:** Fullstack Builder session
**Date:** 2026-04-12
**Context:** Read PROOF-MODAL-V3-PLAN.md (Dispatch session), audited codebase, assessed good/bad, now writing my own execution plan.

---

## 1. What Already Works

The paste-verify system is 90% built. The codebase has:

- 5-screen PasteVerifyFlow (path → token → pay+paste → verify → success)
- Queue submission API (POST /api/proof/verify-tx)
- Polling API (GET /api/proof/verify-tx/status)
- Cron consumer (POST /api/proof/verify-tx/process) — 6 on-chain checks
- proof_verifications table with UNIQUE(signature), indexes, status machine
- 3-tier failure recovery (try again → deep verify → support ticket)
- parseSolscanInput for Solscan URLs + raw base58 signatures

What's broken is the wallet-connect dependency layered on top.

---

## 2. What V3 Actually Changes

Strip wallet connect. The user is anonymous until they submit a TX. Everything we need comes from the on-chain transaction itself.

**Removed:** wallet picker, wallet connect, balance checks, eligibility SSE, MWA, deep links, self-proof pre-check, PhantomAndroidFlow.

**Added:** post-payment sender extraction, post-payment self-proof check, post-payment dev verification, comment field, silent duplicate handling, wider signature parsing, session timestamp anti-scam, Helius webhook as primary verification path.

**Modified:** pubkey becomes nullable (extracted from TX, not from frontend), Screen3 splits into copy-address + paste-submit, terminal cascade UX on Screen5. No time duration exposed to user — internal session timestamp is the guard.

---

## 3. The 6-Screen Flow

```
Screen 1: PATH SELECT
  Pick collab ($1) or dev ($5). Show project name + handle. No price on buttons.

Screen 2: TOKEN + PRICE
  Pick LASTSHFT (40% off) / SOL / USDT. Show price per token. No balances.

Screen 3: SEND PAYMENT
  Show treasury address with prominent copy button. Show exact amount in selected token.
  Encourage the user to go handle the transaction. No timer. No duration callouts.
  Three lines: send the exact amount, save your Solscan link, come back when you're done.
  "SUBMIT TRANSACTION RECEIPT" button when they're ready.
  No validation gate — if they haven't paid, verification catches it.
  Internal: session timestamp recorded when modal opened. TX must be AFTER this timestamp.

Screen 4: PASTE + COMMENT + SUBMIT
  Paste field: Solscan URL, Explorer URL, solana.fm, raw base58.
  Optional comment (140 chars). SUBMIT button.
  After submit: no back button — in the pipeline.

Screen 5: TERMINAL VERIFICATION
  Two-phase cascade: verification checks → deployment.
  Preloaded denial messages on failure (no detail leakage).
  Three outcomes: success → Screen 6, try again → Screen 4, support.

Screen 6: RECEIPT
  Screenshot-friendly proof card. Extracted sender, comment, Solscan link.
  BACK TO PROFILE button.
```

---

## 4. Backend Changes

### 4.1 What changes in POST /api/proof/verify-tx (queue submission)

- Remove `pubkey` from required fields. Make it optional (nullable INSERT).
- Add `comment` to accepted fields (optional, string, max 500 chars server-side).
- Add `parseSolscanInput` patterns: `solana.fm/tx/`, `explorer.solana.com/tx/`, `xray.helius.xyz/tx/`.
- Silent duplicate: if signature already in `proofs` table, return existing proof data with `status: "verified"`. No error. Scammer sees success.

### 4.2 What changes in POST /api/proof/verify-tx/process (cron consumer)

- **Remove check #3** (wrong_sender — sender must match connected pubkey). User is anonymous.
- **Add sender extraction**: after fetching TX, extract `accountKeys[0]` (fee payer). Write back to `proof_verifications.pubkey`.
- **Add self-proof check** (new, post-extraction): compare extracted sender against profile owner's `terminal_wallet`. Fail with `self_proof` if match.
- **Add dev-path check** (moved from pre-payment): if `path === "dev"`, run `token-dev-verify.ts` against extracted sender. Fail with `dev_not_qualified` if sender doesn't qualify.
- **Pass comment** through to `insertProof()` call.
- **Change time window**: 10 minutes stays (not 5 — the app-switching UX is slower without wallet connect).
- **Recompute tier** after proof insert.

### 4.3 What changes in GET /api/proof/verify-tx/status (polling)

- Add `sender_pubkey` to response (from `proof_verifications.pubkey` after extraction).
- Add `comment` to response (for receipt display).
- Per-check progress is a UX trick — the status endpoint returns a single status field. The terminal cascade animates pre-written lines staggered by timing. This is correct — don't over-engineer real-time per-check progress.

### 4.4 Helius webhook — PRIMARY verification path

**Helius webhook is the primary path. Cron is the safety net.**

Helius fires within 1-5 seconds of a TX hitting the treasury wallet. The user sees near-instant verification. The cron runs every 60 seconds as a fallback for any webhook delivery failures.

**New endpoint:** `POST /api/proof/webhook` — separate from the existing payment webhook at `/api/payments/webhook`. No coupling. Clean separation.

**Webhook flow:**
1. User submits TX signature → row inserted in `proof_verifications` (status: "queued")
2. Helius webhook fires on treasury TX → `POST /api/proof/webhook`
3. Webhook matches incoming TX signature against queued `proof_verifications` rows
4. Runs all verification checks (same as cron: recipient, amount, timestamp, duplicate, self-proof, dev-path)
5. Updates row status to "verified" or "failed"
6. Frontend poll picks up the result in 2-3 seconds

**Cron fallback:** Same check logic. Catches anything the webhook missed. Runs every 60 seconds.

**Helius webhook config:**
- Separate webhook from the payment webhook
- Watches treasury wallet for TRANSFER events
- Auth: `HELIUS_PROOF_WEBHOOK_SECRET` (separate from payment webhook secret)
- Enhanced transaction type for full account/balance data

### 4.5 Session timestamp anti-scam

When the proof modal opens, record the timestamp. This is the "session start." When verifying, check: is the TX's `blockTime` BEFORE the session start? If yes → reject.

This kills scammers who find old TXs to the treasury and try to submit them. The duplicate signature check catches reused proofs, but the session timestamp catches old TXs that were never used as proofs.

**Implementation:**
- Screen 1 load → check localStorage for existing session keyed by `workItemId`
  - If exists: restore `session_id` + `opened_at` (user closed and came back)
  - If not: `POST /api/proof/session-start` → returns `{ session_id, opened_at }` → save to localStorage + state
- On submit → include `session_id` in POST body
- Queue row stores `session_opened_at` timestamp (server validates session_id against proof_sessions table)
- Verification check: `tx.blockTime >= session_opened_at` — if TX is older than session, reject
- On successful verification → clear localStorage key for this workItemId
- On failure → keep localStorage so user can retry with same session

**Why localStorage per workItemId:**
User opens modal → goes to pay → closes modal → comes back → re-opens modal → submits TX.
Without persistence, the re-opened modal creates a new session with a later timestamp, rejecting the valid TX.
With localStorage persistence, the original session timestamp is restored — the TX is still valid.

A scammer can't exploit this: they'd need a valid session_id that the server recognizes (stored in proof_sessions table), AND a TX that happened after that session started, AND the TX must hit the treasury for the correct amount. All three conditions are independent.

**Server-side session table:**
```sql
CREATE TABLE proof_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ps_id ON proof_sessions(id);
```

**Preloaded denial message for `tx_before_session`:**
`> Nice try. Scamming will die in web3. Support your friend and purchase a proof for them.`

This is not a generic error. It's a direct message to someone attempting fraud. On-brand for LASTPROOF.

---

## 5. Database Migration

```sql
-- 0012_proof_flow_v3.sql

-- pubkey nullable — extracted from TX post-submission, not from frontend
ALTER TABLE proof_verifications ALTER COLUMN pubkey DROP NOT NULL;

-- comment field on verification queue
ALTER TABLE proof_verifications ADD COLUMN IF NOT EXISTS comment TEXT;

-- comment field on proofs table (reuse existing 'note' column or add new)
-- The 'note' column exists from 0001 but is unused. Reuse it.
-- No migration needed for proofs.note — it already exists and is nullable.
```

One migration. The `proofs.note` column already exists — reuse it for comments instead of adding a duplicate `comment` column.

---

## 6. Frontend Changes

### 6.1 ProofModal.tsx — strip to thin shell

Remove:
- `selectedWallet` state
- `useConnected()` hook
- `isSelfProof` guard
- Eligibility prefetch useEffect
- `streamedToken`, `forceIneligible`, `mockConnected`
- Abandon-on-close plumbing
- Step machine (PasteVerifyFlow owns all screens)
- PhantomAndroidFlow import and routing

Keep:
- Modal backdrop, title bar, close button
- `workItemId`, `ticker`, `handle`, `ownerWallet` props
- Delegates entirely to PasteVerifyFlow

### 6.2 PasteVerifyFlow.tsx — 6 screens, no pubkey

Remove:
- `pubkey` from state and props
- Connected wallet display
- All references to `connected`

Add:
- `extractedSender: string | null` state (filled from status response)
- `comment: string` state
- Screen 3 (copy address) and Screen 4 (paste+submit) as separate screens (currently Screen3Pay combines both)
- Screen 6 (receipt) as new final screen

Modify:
- POST to `/api/proof/verify-tx` without `pubkey`
- Include `comment` in POST body
- Screen5 terminal cascade with preloaded denial messages

### 6.3 Screen changes

**Screen1Path** — remove price from buttons. Just "COLLABORATOR" and "DEV".

**Screen2Token** — remove balance display. Keep prices and discount badge. Add "Need $LASTSHFT?" link.

**Screen3Pay → split into Screen3SendPayment + Screen4PasteSubmit:**
- Screen3SendPayment: treasury address with prominent copy button, exact token amount + USD. Encourage user to go handle the transaction. No timer. No duration callouts. Three lines: send exact amount, save your Solscan link, come back when done. "SUBMIT TRANSACTION RECEIPT" button when ready.
- Screen4PasteSubmit: paste field (all explorer URL formats + raw sig), comment field (140 chars), SUBMIT button.
- Remove: connected wallet display, "SEND FROM YOUR CONNECTED WALLET" warning.

**Screen4Verify → Screen5Terminal:**
- Two-phase cascade (verification → deployment).
- Preloaded denial messages per failure code (factual, no detail leakage).
- Countdown timer (estimate based on queue position).
- Three outcomes: success → Screen 6, try again → Screen 4, support.

**Screen5Success → Screen6Receipt:**
- Receipt layout: project, proof type, extracted sender, token, amount, comment, status, proof ID, date.
- Solscan link.
- BACK TO PROFILE button.
- Screenshot-friendly design.

### 6.4 Signature parsing expansion

Add to `parseSolscanInput`:
```
https://explorer.solana.com/tx/{sig}
https://solana.fm/tx/{sig}
https://xray.helius.xyz/tx/{sig}
```

Auto-trim whitespace. `inputMode="url"` on mobile for paste field.

---

## 7. Silent Duplicate Handling

When someone submits a TX signature already in `proofs`:
- Do NOT show an error
- Return the existing proof data with `status: "verified"`
- Frontend renders success flow with existing proof data
- Proof count doesn't increment
- Scammer thinks it worked, moves on

Implementation: in POST /api/proof/verify-tx, check `proofs.tx_signature` first. If found, return `{ ok: true, status: "verified", proof_id: existing.id }`.

---

## 8. Self-Proof Prevention (Post-Payment)

After TX passes all 5 on-chain checks, extract sender from `accountKeys[0]`. Look up the profile owner's `terminal_wallet` via `work_items → profiles` join. If match → fail with `self_proof`.

The operator loses their payment. Stronger deterrent than a pre-check.

---

## 9. Dev Path Verification (Post-Payment)

If `path === "dev"`, run `verifyDevWallet(mint, extractedSender)` from `token-dev-verify.ts`. This checks:
1. Is sender the current mint authority?
2. Did sender sign the original mint TX?
3. Is sender one of the first 5 holders?

If all fail → reject with `dev_not_qualified`. Operator loses $5.

`token-dev-verify.ts` takes `(mint, pubkey)` as input — no connected wallet needed. The extracted sender provides the pubkey.

---

## 10. Preloaded Denial Messages

Factual. No detail leakage. Don't reveal thresholds or mechanics.

| Code | Terminal Output |
|------|----------------|
| `tx_not_found` | `> TRANSACTION NOT FOUND ON SOLANA` |
| `tx_failed_onchain` | `> TRANSACTION FAILED ON-CHAIN` |
| `wrong_recipient` | `> PAYMENT NOT SENT TO LASTPROOF TREASURY` |
| `amount_too_low` | `> AMOUNT DOES NOT MATCH REQUIRED PAYMENT` |
| `amount_too_high` | `> AMOUNT DOES NOT MATCH REQUIRED PAYMENT` |
| `tx_before_session` | `> Nice try. Scamming will die in web3. Support your friend and purchase a proof for them.` |
| `duplicate_signature` | **SILENT SUCCESS** (§7) |
| `self_proof` | `> PROFILE OWNER CANNOT VERIFY THEIR OWN WORK` |
| `dev_not_qualified` | `> WALLET NOT QUALIFIED FOR DEV VERIFICATION` |
| `rpc_error` | `> VERIFICATION INTERRUPTED — TRY AGAIN` |

---

## 11. Implementation Order

Strict sequence. Test each phase before proceeding. One commit per phase.

### Phase 1: Migration
- Write + run `0012_proof_flow_v3.sql`:
  - `proof_verifications.pubkey` DROP NOT NULL
  - `proof_verifications.comment` TEXT
  - `proof_verifications.session_id` UUID
  - `proof_verifications.session_opened_at` TIMESTAMPTZ
  - `proof_sessions` table (id, work_item_id, opened_at)
- Verify nullable pubkey INSERT works

### Phase 2: Session start endpoint
- Create `POST /api/proof/session-start` → inserts row in `proof_sessions`, returns `{ session_id, opened_at }`
- No auth needed — sessions are anonymous (tied to work_item_id, not user)

### Phase 3: Helius proof webhook (PRIMARY path)
- Create `POST /api/proof/webhook` — separate from payment webhook
- Matches incoming TX signature against queued `proof_verifications` rows
- Runs all verification checks: recipient, amount, session timestamp, duplicate, self-proof, dev-path
- Extracts sender from `accountKeys[0]`, writes back to `proof_verifications.pubkey`
- Updates row status to "verified" or "failed"
- Inserts proof row on success, recomputes tier
- Auth: `HELIUS_PROOF_WEBHOOK_SECRET` header
- Test with manual webhook payload

### Phase 4: Cron consumer changes (FALLBACK)
- Remove sender-match check (#3)
- Add sender extraction + write-back
- Add session timestamp check (`tx.blockTime >= session_opened_at`)
- Add self-proof check
- Add dev-path check
- Pass comment → insertProof (use `note` field)
- Same verification logic as webhook — shared function
- Test with manual curl

### Phase 5: Queue submission changes
- Remove pubkey from required fields
- Add `session_id` to required fields (validated against proof_sessions table)
- Add comment field
- Implement silent duplicate handling
- Expand parseSolscanInput (solana.fm, explorer.solana.com, xray.helius.xyz)
- Store `session_opened_at` on the queue row (looked up from proof_sessions)
- Test: submit with no pubkey, confirm nullable INSERT

### Phase 6: Status endpoint changes
- Add sender_pubkey to response
- Add comment to response
- Test: poll after webhook fires → sender appears in 2-3 seconds

### Phase 7: Frontend — 6 screens
- Rewrite PasteVerifyFlow as 6-screen orchestrator
- Session start on Screen 1 (localStorage persistence per workItemId)
- Screen 3: encourage action, no timer, "SUBMIT TRANSACTION RECEIPT" button
- Screen 4: paste field + comment + submit
- Screen 5: terminal cascade with preloaded denial messages
- Screen 6: receipt with extracted sender
- Remove all wallet/pubkey state
- Wire comment, extractedSender, sessionId

### Phase 8: ProofModal cleanup
- Strip to thin modal shell
- Remove all wallet state + imports

### Phase 9: Dead code removal
- Delete PhantomAndroidFlow (grep callers first)
- Delete unused wallet/eligibility files (grep callers first)
- Delete unused API routes

### Phase 10: QA
- Full flow tests (collab + dev, all 3 tokens)
- Mobile test (Android + iOS)
- Failure path tests (wrong amount, wrong recipient, old TX)
- Session timestamp test (TX before modal open → rejected with scam message)
- Duplicate test → silent success
- Self-proof test → rejected
- Dev path test → qualified + unqualified
- Webhook speed test (should verify in 1-5 seconds)
- Cron fallback test (disable webhook → cron picks up in 60 seconds)
- TypeScript clean

---

## 12. Resolved Positions (Corrected After Founder Review)

| Topic | Original Position | Corrected Position | Why |
|-------|-------------------|-------------------|-----|
| **Helius webhook** | "Cron stays primary" | **Webhook is primary, cron is fallback** | Speed matters. 1-5 seconds vs 60 seconds. Founder is paying for Helius Pro. Build both. |
| **Time window** | 10 minutes hardcoded | **No user-facing timer. Internal session timestamp.** | Don't reveal verification mechanics. Don't pressure users. Session timestamp catches old TXs without exposing rules. |
| **Screen3 UX** | "Copy address + 3 instruction lines + CONTINUE" | **Encourage action, no timer callouts, "SUBMIT TRANSACTION RECEIPT" button** | Web3 natives know how to send tokens. The screen should guide, not gate. |
| **Comment column** | Reuse existing `note` column | Reuse existing `note` column (unchanged) | Already exists from migration 0001 |
| **Anti-scam** | 5-check verification only | **6-check: added session timestamp check** | TX must happen AFTER modal opened. Kills old-TX-reuse scam. Preloaded scam message. |

---

## 13. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| No rate limiting on queue submission | HIGH | Add IP-based rate limit before launch (max 5/hour/IP) |
| Treasury env var mismatch (NEXT_PUBLIC vs LASTPROOF_AR) | MEDIUM | Validate both point to same address at startup |
| Cron dies mid-batch → stuck "processing" rows | LOW | Manual reset in Supabase (`status = 'queued'`). Add auto-reset for rows stuck >5 min |
| Token price volatility between pay + verify | LOW | 5% tolerance handles this. User retries if price swings too far |
| Helius webhook delivery failure | LOW | Cron fallback catches everything within 60 seconds |
| Session timestamp in localStorage cleared by user | LOW | Server validates session_id against proof_sessions table. Without valid session_id, submission is rejected |
| Self-proof bypass (user sends from different wallet) | ACCEPTED | Can't prevent — only check is sender vs owner wallet. Social reputation handles the rest |

---

## 14. Files Created

```
supabase/migrations/0012_proof_flow_v3.sql
src/app/api/proof/session-start/route.ts       — creates proof session, returns session_id + opened_at
src/app/api/proof/webhook/route.ts             — Helius proof webhook (PRIMARY verification path)
src/components/proof-modal/flows/paste-verify/Screen4PasteSubmit.tsx
src/components/proof-modal/flows/paste-verify/Screen5Terminal.tsx   — cascade verification UX
src/components/proof-modal/flows/paste-verify/Screen6Receipt.tsx
```

## 15. Files Modified

```
src/app/api/proof/verify-tx/route.ts          — remove pubkey required, add session_id + comment, silent duplicate
src/app/api/proof/verify-tx/process/route.ts   — remove sender check, add extraction + session timestamp + self-proof + dev check
src/app/api/proof/verify-tx/status/route.ts    — add sender_pubkey + comment to response
src/components/proof-modal/ProofModal.tsx       — strip to thin shell
src/components/proof-modal/flows/paste-verify/PasteVerifyFlow.tsx  — 6-screen rewrite with session persistence
src/components/proof-modal/flows/paste-verify/Screen1Path.tsx      — remove price
src/components/proof-modal/flows/paste-verify/Screen2Token.tsx     — remove balances
src/components/proof-modal/flows/paste-verify/Screen3Pay.tsx       — becomes Screen3SendPayment (no timer, encourage action)
```

## 16. Files Deleted (after grep confirms zero callers)

```
src/components/proof-modal/flows/phantom/android/   — 10 files
src/app/api/proof/eligibility/                      — SSE eligibility (if no other callers)
```

---

*This plan is ready for review. Each phase is one commit. Backend first, frontend second, cleanup last.*
