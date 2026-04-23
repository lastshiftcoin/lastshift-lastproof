# PROOF MODAL V3 — WALLET-FREE IMPLEMENTATION PLAN

**Date:** 2026-04-12
**Updated:** 2026-04-12 (post-review session with founder)
**Status:** PLANNING — Do not implement until founder confirms
**Replaces:** HANDOFF-PASTE-VERIFY.md (V2 paste-verify with wallet connect)

---

## 0. Context & Goal

V2 (commit a201574) replaced the old sign-in-wallet pipeline with a paste-verify flow. It was a major improvement, but still required wallet connect — users had to connect Phantom/Solflare before they could proceed. This created critical friction:

- **Phantom in-app browser trap**: User opens profile link → Phantom intercepts → opens in Phantom's in-app browser → proof modal runs inside Phantom → user reaches paste step → **dead end** (can't leave to pay and come back)
- Debug logs confirmed: every session was `phantom_android_flow_init` — zero users ever reached PasteVerifyFlow on Android
- Wallet detection was broken: `detectWalletEnvironment()` ran in `useMemo` (synchronous) before Phantom injected its provider (async), misidentifying Phantom IAB as "mobile-browser"
- Balance checks, eligibility SSE, and MWA signing are all dead weight in a paste-verify flow

**V3 goal:** Remove wallet connect entirely. The user is **anonymous until they submit a transaction**. The backend extracts everything it needs from the on-chain TX.

```
Click Verify → Pick path → Pick token → Copy address + pay
→ Come back → Paste TX URL → Backend verifies → Proof deployed
```

No wallet adapter. No signature request. No balance checks. No eligibility pre-check. Works in any browser, on any device.

---

## 1. Current State (What Exists)

### 1.1 Component Architecture

| File | Role | V3 Action |
|------|------|-----------|
| `src/components/proof-modal/ProofModal.tsx` | 8-step orchestrator with wallet state | REWRITE — thin modal shell |
| `src/components/proof-modal/flows/paste-verify/PasteVerifyFlow.tsx` | 5-screen paste-verify orchestrator | REWRITE — 6-screen flow, no pubkey |
| `src/components/proof-modal/flows/paste-verify/Screen1Path.tsx` | Path picker (collab/dev) | MODIFY — remove price display |
| `src/components/proof-modal/flows/paste-verify/Screen2Token.tsx` | Token picker with live balances | MODIFY — remove balance display |
| `src/components/proof-modal/flows/paste-verify/Screen3Pay.tsx` | Pay + paste combined | REWRITE — split into Screen3 (copy address) and Screen4 (paste) |
| `src/components/proof-modal/flows/paste-verify/Screen4Verify.tsx` | Terminal polling UI | REWRITE — terminal cascade experience (§2.5) |
| `src/components/proof-modal/flows/paste-verify/Screen5Success.tsx` | Success screen | REWRITE — receipt format (§2.6) |
| `src/components/proof-modal/flows/phantom/android/` | PhantomAndroidFlow (9-step legacy) | DELETE |
| `src/lib/wallet/use-connected.ts` | Connected wallet hook | DELETE (check callers first) |
| `src/lib/wallet/wallet-policy.ts` | KnownWallet allowlist | DELETE (check callers first) |
| `src/lib/wallet/deep-link.ts` | Wallet environment detection | DELETE (check callers first) |
| `src/lib/eligibility/` | SSE eligibility stream | DELETE — Phase 1 pre-checks are dead in V3 |

### 1.2 API Routes

| Route | Role | V3 Action |
|-------|------|-----------|
| `POST /api/proof/verify-tx` | Submit signature to queue | MODIFY — remove pubkey requirement |
| `GET /api/proof/verify-tx/status` | Poll verification status | MODIFY — add sender_pubkey, check-by-check progress |
| `POST /api/proof/verify-tx/process` | Cron consumer, 6 checks | MODIFY — becomes fallback; remove sender-match; add self-proof + dev checks |
| `POST /api/proof/webhook` | Helius webhook receiver | EXISTS — becomes PRIMARY verification path |
| `GET /api/proof/eligibility` | SSE eligibility (pre-payment) | DELETE — user is anonymous until TX submitted |
| `GET /api/proof/quote/[id]/refresh` | Live price ticker | LEAVE — unused in V3, safe to ignore |
| `POST /api/proof/build-tx` | TX builder for wallet signing | DELETE (check callers first) |
| `POST /api/proof/broadcast` | TX broadcast for wallet signing | DELETE (check callers first) |

### 1.3 Database

| Table | V3 Action |
|-------|-----------|
| `proof_verifications` | KEEP — `pubkey` becomes nullable (extracted post-TX) |
| `proofs` | KEEP — `payer_wallet` filled from TX extraction |
| `debug_events` | KEEP — critical for diagnosing failures |

### 1.4 What's Broken in V2

- Phantom IAB trap — dead end on mobile (confirmed via debug logs)
- Wallet detection timing race (`useMemo` vs async provider injection)
- PhantomAndroidFlow routed 100% of Android Phantom users into old 9-step dead code
- Balance check fails if user pays from a different wallet than connected
- `pubkey` required at submission but user hasn't proven wallet ownership
- Self-proof guard only worked via wallet match — easily bypassed
- Eligibility SSE is meaningless without wallet connect — user is anonymous
- Dual step counters (7-step outer + 5-step inner) caused confusing "STEP 3/9" display

---

## 2. New Flow — 6 Screens

### 2.1 Screen 1: PATH SELECT

```
┌──────────────────────────────────────────┐
│  PROJECT: $LASTSHFT X Growth Lead       │
│  HANDLE:  @lastshiftfounder             │
│  ─────────────────────────────          │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ COLLABORATOR │  │     DEV     │      │
│  │  [Select]    │  │  [Select]   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  [← Back]                               │
└──────────────────────────────────────────┘
```

- Project name and handle displayed at top — user sees what they're proofing
- **No price shown** — path choice should be based on role, not cost
- Two buttons: COLLABORATOR and DEV
- Back button closes the modal

### 2.2 Screen 2: PRICING TABLE + TOKEN SELECT

```
┌──────────────────────────────────────────┐
│  COLLABORATOR PROOF                     │
│  ─────────────────────────────          │
│                                         │
│  LASTSHFT        SOL          USDT     │
│  $0.60           $1.00        $1.00    │
│  40% OFF                               │
│  [Select]        [Select]     [Select] │
│                                         │
│  Need $LASTSHFT? → lastshiftcoin.com   │
│                                         │
│  [← Back]                               │
└──────────────────────────────────────────┘
```

- Shows price per token option
- LASTSHFT discount highlighted
- No balance display (no wallet connected)
- "Need $LASTSHFT?" link to lastshiftcoin.com
- Back button → Screen 1

### 2.3 Screen 3: COPY ADDRESS + HOW-TO

```
┌──────────────────────────────────────────┐
│  SEND PAYMENT                           │
│  ─────────────────────────────          │
│                                         │
│  SEND TO:                               │
│  ┌────────────────────────────┐         │
│  │ 5qCY5...mo6C7        [📋] │         │
│  └────────────────────────────┘         │
│                                         │
│  AMOUNT: 4,973.42 LASTSHFT  ≈ $0.60   │
│  ─────────────────────────────          │
│                                         │
│  • Send exact amount, one TX            │
│  • Come back within 5 min               │
│  • Your wallet = your proof             │
│                                         │
│  [← Back]          [CONTINUE →]         │
└──────────────────────────────────────────┘
```

- Treasury address with prominent copy button
- Exact token amount + USD equivalent
- **Three lines of instructions only** — these are web3 people, they know how to send tokens
- Continue button = "I've paid, take me to the proof step"
- No validation gate on Continue — if they haven't paid, Screen 4 submission will fail at verification
- Back button → Screen 2

### 2.4 Screen 4: PASTE + COMMENT + SUBMIT

```
┌──────────────────────────────────────────┐
│  VERIFY YOUR PAYMENT                    │
│  ─────────────────────────────          │
│                                         │
│  ┌────────────────────────────┐         │
│  │ Paste Solscan URL or TX ID │         │
│  └────────────────────────────┘         │
│                                         │
│  ┌────────────────────────────┐         │
│  │ Add a note... (optional)   │         │
│  └────────────────────────────┘  0/140  │
│                                         │
│  [← Back]          [SUBMIT →]           │
└──────────────────────────────────────────┘
```

- Paste field accepts: Solscan URL, Solana Explorer URL, solana.fm URL, xray.helius.xyz URL, raw base58 signature
- Optional comment field (140 chars) — what did you do on this project
- Submit triggers queue insertion + starts polling
- Back button → Screen 3
- **After submit, no back button** — you're in the verification pipeline

### 2.5 Screen 5: TERMINAL VERIFICATION

Two-phase terminal cascade experience. Monospace font, dark background, orange/green text. Lines appear sequentially with cursor blink effect.

**Phase 1 — Verification (on-chain checks):**

```
┌──────────────────────────────────────────┐
│  > INITIATING PROOF VERIFICATION...     │
│  > ESTIMATED COMPLETION: ~12 SEC        │
│  > SCANNING SOLANA MAINNET FOR TX...    │
│  > TX LOCATED — BLOCK 287,441,092       │
│  > CHECKING RECIPIENT... ✓ CONFIRMED    │
│  > CHECKING AMOUNT... ✓ 4,973.42 LASTSHFT│
│  > CHECKING TIME WINDOW... ✓ WITHIN 5 MIN│
│  > CHECKING SIGNATURE... ✓ UNIQUE       │
│  > ALL CHECKS PASSED                    │
└──────────────────────────────────────────┘
```

**Phase 2 — Deployment (proof goes live):**

```
│  > DEPLOYING PROOF TO @lastshiftfounder...│
│  > WRITING TO PROOF LEDGER...           │
│  > ASSIGNING PROOF ID: LP-0047          │
│  > UPDATING OPERATOR PROFILE...         │
│  > PROOF COUNT: 46 → 47                 │
│  > TIER STATUS: TIER 3 · EXPERIENCED    │
│  > PROOF DEPLOYED — LIVE ON PROFILE     │
│                                         │
│              [CONFIRM →]                │
└──────────────────────────────────────────┘
```

**Countdown timer** runs across both phases. Starts with estimate based on queue position (~15 sec per position). Ticks down in real time. Lines cascade as checks resolve. If verification finishes early, checks cascade fast. If it takes longer, timer adjusts.

**Three outcomes:**

1. **SUCCESS** → Confirm button → Screen 6
2. **FAILURE (attempt 1)** → Preloaded denial message (see §2.5.1) → [TRY AGAIN] → back to Screen 4
3. **FAILURE (attempt 2+)** → Preloaded denial message → [TRY AGAIN] + [CONTACT SUPPORT] → support screen

#### 2.5.1 Preloaded Denial Messages

Denial messages are factual, give no extra detail about what we check. Do not reveal thresholds or mechanics to scammers.

| Failure Code | Terminal Output | Notes |
|---|---|---|
| `tx_not_found` | `> ✕ TRANSACTION NOT FOUND ON SOLANA` | May still be propagating |
| `tx_failed_onchain` | `> ✕ TRANSACTION FAILED ON-CHAIN` | TX was reverted |
| `wrong_recipient` | `> ✕ PAYMENT NOT SENT TO LASTPROOF TREASURY` | Wrong address |
| `amount_too_low` | `> ✕ AMOUNT DOES NOT MATCH REQUIRED PAYMENT` | Don't say how much was expected |
| `amount_too_high` | `> ✕ AMOUNT DOES NOT MATCH REQUIRED PAYMENT` | Same message as too_low |
| `tx_too_old` | `> ✕ TRANSACTION OUTSIDE VERIFICATION WINDOW` | Don't say "5 minutes" |
| `duplicate_signature` | **SILENT SUCCESS** — see §3.4 | Scammer sees success, proof already counted |
| `self_proof` | `> ✕ PROFILE OWNER CANNOT VERIFY THEIR OWN WORK` | Extracted sender = owner wallet |
| `dev_not_qualified` | `> ✕ WALLET NOT QUALIFIED FOR DEV VERIFICATION` | Failed token-dev-verify checks |
| `rpc_error` | `> ✕ VERIFICATION INTERRUPTED — TRY AGAIN` | Transient RPC failure |

### 2.6 Screen 6: RECEIPT

```
┌──────────────────────────────────────────┐
│            ✓ PROOFED ON-CHAIN           │
│  ─────────────────────────────          │
│                                         │
│  PROJECT     $LASTSHFT X Growth Lead    │
│  PROOF TYPE  COLLABORATOR               │
│  FROM        FFdU6G...9bU7              │
│  TOKEN       LASTSHFT                   │
│  AMOUNT      4,973.42                   │
│  COMMENT     "Ran 3 raid threads..."    │
│  STATUS      VERIFIED                   │
│  PROOF ID    LP-0047                    │
│  DATE        2026-04-12                 │
│                                         │
│  [View on Solscan ↗]                   │
│                                         │
│          [BACK TO PROFILE]              │
└──────────────────────────────────────────┘
```

- Receipt-style layout showing everything that happened
- Extracted sender wallet (from on-chain TX, not user-provided)
- Comment if entered
- Solscan link to the TX
- Back to profile button
- **Designed to be screenshot-friendly** — operators may share this as social proof

### 2.7 Navigation

| Screen | Back goes to | Forward goes to |
|--------|-------------|-----------------|
| 1 (Path) | Close modal | Screen 2 |
| 2 (Token) | Screen 1 | Screen 3 |
| 3 (Copy Address) | Screen 2 | Screen 4 |
| 4 (Paste + Submit) | Screen 3 | Screen 5 (after submit) |
| 5 (Verification) | **No back** — in pipeline | Screen 6 (on success) or Screen 4 (on failure) |
| 6 (Receipt) | **No back** | Close modal / back to profile |

---

## 3. Backend Architecture — V3

### 3.1 Verification Path: Helius Webhook (Primary) + Cron (Fallback)

**Helius webhook is the primary verification path.** The existing webhook endpoint at `/api/proof/webhook` fires within 1-5 seconds of a TX hitting the treasury wallet. The cron runs every 60 seconds as a safety net for webhook delivery failures.

```
User submits TX on Screen 4
  → Row inserted in proof_verifications (status: "queued")
  → Frontend starts polling GET /api/proof/verify-tx/status every 2-3 sec

Meanwhile:
  Helius webhook fires on treasury TX
    → POST /api/proof/webhook receives TX data
    → Matches signature against queued proof_verifications rows
    → Runs 5 verification checks
    → Updates row status to "verified" or "failed"
    → Frontend poll picks up result → cascades terminal checks on Screen 5

Fallback:
  Cron (every 60 sec) sweeps proof_verifications WHERE status = 'queued'
    → Runs same 5 checks
    → Catches anything webhook missed
```

**User wait time: 3-8 seconds** (webhook path) vs 15-60 seconds (cron-only). The terminal animation (Screen 5) masks the wait with cascading check lines.

Helius plan: 10M credits/month ($49). Webhook events are low-cost. Already in use.

### 3.2 Verification Checks (5 checks, strict order)

The user is **anonymous until the TX is submitted**. Phase 1 eligibility (pre-payment) is dead. All checks happen post-payment.

| # | Check | What it does | On failure |
|---|-------|-------------|------------|
| 1 | TX exists on-chain | `getTransaction(signature)` via Helius RPC. Check `tx.meta.err` for on-chain failure. On attempt ≥2: `maxSupportedTransactionVersion: 0` | `tx_not_found` or `tx_failed_onchain` |
| 2 | Recipient is treasury | SOL: treasury in accountKeys. SPL: check postTokenBalances for treasury's ATA | `wrong_recipient` |
| 3 | Amount within tolerance | Expected = `priceFor(kind, token) / getTokenUsdRate(token)`. Tolerance = `max(expectedUsd * 0.05, $0.05)` | `amount_too_low` or `amount_too_high` |
| 4 | TX within 5 minutes | `blockTime` vs submission timestamp. 60s future tolerance for clock skew | `tx_too_old` or `tx_too_new` |
| 5 | Signature not already used | Query `proofs.tx_signature` for duplicate | **SILENT SUCCESS** (see §3.4) |

**After checks pass:**
- Extract sender: `accountKeys[0]` (fee payer) from the TX
- Write extracted sender to `proof_verifications.pubkey`
- Run self-proof check: extracted sender vs profile owner's `terminal_wallet` → reject with `self_proof` if match
- If dev path: run token-dev-verify checks against extracted sender (mint authority, deployer, first-5 holders) → reject with `dev_not_qualified` if fails
- Insert proof row via `insertProof()`
- Update proof count on profile
- Recompute tier

### 3.3 Self-Proof Prevention (Post-Payment)

V2 checked this pre-payment via connected wallet. V3 checks it post-payment via extracted sender.

```
After TX passes all 5 checks:
  extractedSender = accountKeys[0]
  ownerWallet = profiles.terminal_wallet (via work_items → profiles join)
  if (extractedSender === ownerWallet) → fail with "self_proof"
```

The operator loses their payment. This is a **stronger deterrent** than V2's pre-check — they wasted money.

### 3.4 Silent Duplicate Handling (Anti-Scam)

**Critical design decision:** When someone submits a TX signature that's already been used for a proof, **do not show an error.** Show the success flow instead.

Why: If a scammer grabs someone else's Solscan link and tries to use it, rejecting with "duplicate signature" tells them to try a different TX. Instead, let them think it worked. The DB already has the real proof from the real person. The duplicate insert is a no-op (23505 unique violation handled gracefully). The scammer sees Screen 5 success → Screen 6 receipt (showing the existing proof data). Proof count doesn't go up twice.

Implementation:
- Queue submission route: if signature exists in `proofs`, return the existing proof data with status "verified"
- If signature exists in `proof_verifications` with status "verified", return existing proof data
- Frontend renders success flow with existing proof data
- No indication that this was a duplicate

### 3.5 Dev Path Eligibility (Post-Payment)

V2 ran dev-specific checks (mint authority, deployer, first-5 holders) pre-payment via connected wallet. V3 runs the same checks post-payment via extracted sender.

The existing `token-dev-verify.ts` checks:
1. Is the extracted sender the current mint authority for the token?
2. Did the extracted sender sign the original mint transaction?
3. Is the extracted sender one of the first 5 holders?

These query Solana RPC against the token's mint address — they need a wallet address, not a connected wallet. The extracted sender from the TX provides this.

If the sender's wallet doesn't qualify as a dev, the proof is rejected with `dev_not_qualified` and they wasted $5. Stronger deterrent than pre-check.

### 3.6 Time Window: 5 Minutes

```ts
const TX_TIME_WINDOW_MS = 5 * 60 * 1000;
```

V2 was 10 minutes. V3 tightens to **5 minutes**. Web3 users are fast — a send + paste takes under 2 minutes. 5 minutes is generous while still preventing old TX reuse.

The DB constraints (unique signature, unique wallet+work_item) are the real security. The time window is an additional operational tightener.

### 3.7 Conflict Detection Architecture

Three layers of protection:

**Layer 1 — At submission (Phase 2):**
User is anonymous. Only check possible: is this TX signature already in `proofs` or `proof_verifications`?
- `proofs.tx_signature` UNIQUE constraint
- `proof_verifications.signature` UNIQUE constraint
- If duplicate: **silent success** (§3.4)

**Layer 2 — At verification (Phase 3 — webhook/cron):**
TX is on-chain. We now have the sender wallet. Run all checks:
- 5 on-chain verification checks
- Self-proof check (sender vs owner wallet)
- Dev eligibility check (if dev path)
- Wallet+work_item uniqueness: partial unique index `proofs (work_item_id, payer_wallet) WHERE both NOT NULL`

**Layer 3 — At proof insert:**
- `insertProofRow` handles `23505` (unique violation) as no-op — idempotent
- Double-checks `proofs.tx_signature` before insert (race condition guard between concurrent batches)

**Note:** There is NO cross-work-item dedup at the profile level. Wallet A can proof work_item_1 AND work_item_2 on the same profile. Uniqueness is per work item, not per profile.

---

## 4. What to Remove

### 4.1 Frontend — Delete Entirely

```
src/components/proof-modal/flows/phantom/android/     ← PhantomAndroidFlow (dead)
src/components/proof-modal/steps/Step2WalletPicker.tsx ← wallet picker
src/components/proof-modal/steps/Step3Comment.tsx      ← comment moves to Screen 4
src/components/proof-modal/steps/Step5Eligibility.tsx  ← eligibility SSE
src/components/proof-modal/steps/Step6Review.tsx       ← review + quote ticker
src/components/proof-modal/steps/Step7Sign.tsx         ← wallet signature
```

### 4.2 Frontend — Strip From ProofModal.tsx

- `selectedWallet` state + all wallet setter logic
- `useConnected()` hook + all `connected` references
- `isSelfProof` guard (moves to backend)
- Abandon-on-close plumbing (`/abandon` calls, `hasSubmittedRef`)
- Eligibility prefetch `useEffect`
- `streamedToken`, `forceIneligible`, `mockConnected` states
- `useQuote` / quote refresh logic
- All step branches except thin shell launching PasteVerifyFlow

### 4.3 API — Delete / Deactivate

- `/api/proof/eligibility` — SSE eligibility (dead in V3)
- `/api/proof/build-tx` — TX builder (check callers first)
- `/api/proof/broadcast` — TX broadcast (check callers first)

### 4.4 Lib — Check Callers Before Deleting

```
src/lib/wallet/use-connected.ts
src/lib/wallet/wallet-policy.ts
src/lib/wallet/deep-link.ts
src/lib/wallet/use-wallet-balance.ts
src/lib/eligibility/
```

Run `grep -r` for each across `src/` before deleting. If callers exist outside proof modal (subscription payment, handle change), keep the files.

---

## 5. What to Keep (Unchanged)

| Component / File | Why Keep |
|-----------------|----------|
| `Screen1Path.tsx` (modify) | No wallet dependency — just remove price display |
| `POST /api/proof/verify-tx` | Queue submission — minor modify |
| `GET /api/proof/verify-tx/status` | Polling endpoint — minor modify |
| `POST /api/proof/webhook` | Helius webhook — becomes primary path |
| `proof_verifications` table | Schema stays; pubkey becomes nullable |
| `proofs` table | Schema stays; payer_wallet filled from TX |
| `debug_events` table | Critical for debugging |
| `vercel.json` cron config | Keep as fallback |
| `CRON_SECRET` auth | Prevents public triggering |
| `src/lib/proof-tokens.ts` | Pricing table |
| `src/lib/pricing.ts` | Global pricing |
| `src/lib/token-dev-verify.ts` | Dev path checks — now runs post-payment |
| Debug logging in cron/webhook | Critical for diagnosing failures |

---

## 6. Database Migration

Create migration `0012_proof_modal_v3.sql`:

```sql
-- Make pubkey nullable since V3 doesn't collect it upfront
ALTER TABLE proof_verifications ALTER COLUMN pubkey DROP NOT NULL;

-- Add comment column to carry through to proof insert
ALTER TABLE proof_verifications ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add comment to proofs table if missing
ALTER TABLE proofs ADD COLUMN IF NOT EXISTS comment TEXT;
```

Pass `comment` through in `insertProof` call inside the cron consumer and webhook handler.

---

## 7. Signature Parsing

`parseSolscanInput` must accept all common explorer URLs:

```
https://solscan.io/tx/{sig}
https://explorer.solana.com/tx/{sig}
https://solana.fm/tx/{sig}
https://xray.helius.xyz/tx/{sig}
https://orbmarkets.io/tx/{sig}
Raw base58 signature (44-88 chars)
```

Auto-trim whitespace on paste. `inputMode="url"` on mobile.

---

## 8. Mobile UX

V3 removes all mobile friction. No wallet adapter, no deeplink, no MWA, no Phantom IAB trap.

Mobile flow:
1. Open profile in any browser
2. Tap "Verify This Work"
3. Pick path + token
4. Copy treasury address → switch to wallet app → send payment
5. Switch back to browser → paste TX URL
6. Watch terminal verification → see receipt

Copy button uses clipboard API with fallback for mobile Safari (requires user gesture — copy button click counts).

---

## 9. Error Handling

### 9.1 Missing Treasury Address

If `NEXT_PUBLIC_TREASURY_WALLET` is not set, Screen 3 shows config error in dev, disables continue button. In production this env var is always set.

### 9.2 Queue Saturation

Stuck "processing" rows (cron died mid-run) can be unstuck by resetting `status = 'queued'` in Supabase. New submissions still enter the queue regardless.

### 9.3 Concurrent Submit Race

Double-tap on submit: second request hits UNIQUE(signature) → returns existing row. Idempotent.

### 9.4 Comment Field

Frontend: 140-char limit via `maxLength` + counter.
Backend: Truncate to 500 chars server-side (defense in depth). Do not reject — just truncate.

---

## 10. Implementation Order

Execute strictly in this sequence. Test each phase before proceeding.

### Phase 1 — Database Migration

```
[ ] Write migration 0012_proof_modal_v3.sql
[ ] Run migration against Supabase (local + production)
[ ] Verify: INSERT with pubkey=NULL works
```

### Phase 2 — Backend: Webhook Handler (Primary Path)

```
[ ] Read POST /api/proof/webhook in full
[ ] Wire up verification checks (same 5 checks as cron)
[ ] Add sender extraction from accountKeys[0]
[ ] Add self-proof check (sender vs owner terminal_wallet)
[ ] Add dev-path eligibility check (token-dev-verify.ts against extracted sender)
[ ] Write extracted sender to proof_verifications.pubkey
[ ] Pass comment through to insertProof
[ ] Add check-by-check status updates for frontend polling
[ ] Test with manual webhook payload
```

### Phase 3 — Backend: Cron Consumer (Fallback)

```
[ ] Read process/route.ts in full
[ ] Remove check #2 (sender = pubkey)
[ ] Add sender extraction from accountKeys[0]
[ ] Add self-proof check
[ ] Add dev-path eligibility check
[ ] Write extracted sender to proof_verifications.pubkey
[ ] Pass comment through to insertProof
[ ] Update TX_TIME_WINDOW_MS: 10 * 60 → 5 * 60
[ ] Test with manual curl
```

### Phase 4 — Backend: Queue Submission Route

```
[ ] Read POST /api/proof/verify-tx/route.ts in full
[ ] Remove pubkey from required fields
[ ] Add comment to accepted fields (optional, max 500 chars)
[ ] Implement silent duplicate handling (§3.4): if signature exists in proofs, return existing proof data as "verified"
[ ] Add parseSolscanInput patterns: solana.fm, xray.helius.xyz, orbmarkets.io
[ ] Test: submit with no pubkey, confirm row inserts with pubkey=NULL
```

### Phase 5 — Backend: Status Route

```
[ ] Read GET /api/proof/verify-tx/status/route.ts in full
[ ] Add sender_pubkey to response (from proof_verifications.pubkey after extraction)
[ ] Add per-check progress fields for terminal cascade animation
[ ] Test: poll status after webhook fires → check-by-check data in response
```

### Phase 6 — Frontend: 6-Screen Flow

```
[ ] Rewrite PasteVerifyFlow.tsx as 6-screen orchestrator
[ ] Remove all pubkey/wallet state
[ ] Add extractedSender state (filled from status response)
[ ] Add back-button navigation (Screens 1-4)
[ ] Disable back after submit on Screen 4

Screen 1 (Path Select):
[ ] Show project name + handle
[ ] Remove price display
[ ] COLLABORATOR and DEV buttons only

Screen 2 (Pricing Table):
[ ] Token options with prices
[ ] LASTSHFT discount badge
[ ] Remove balance display
[ ] Add "Need $LASTSHFT?" link

Screen 3 (Copy Address):
[ ] Treasury address with copy button
[ ] Exact token amount + USD equivalent
[ ] Three-line instructions only
[ ] Continue button

Screen 4 (Paste + Submit):
[ ] Paste field (accepts all explorer URL formats + raw sig)
[ ] Auto-trim on paste
[ ] inputMode="url" for mobile
[ ] Optional comment (140 chars, counter)
[ ] Submit button

Screen 5 (Terminal Verification):
[ ] Two-phase terminal cascade (verification + deployment)
[ ] Countdown timer based on queue position
[ ] Monospace font, dark background, orange/green text
[ ] Staggered line reveals (200-400ms between checks)
[ ] Preloaded denial messages (§2.5.1) — factual, no detail leakage
[ ] Three outcomes: success → Screen 6, try again → Screen 4, support
[ ] Confirm button on success

Screen 6 (Receipt):
[ ] Receipt layout: project, proof type, sender wallet, token, amount, comment, status, proof ID, date
[ ] View on Solscan link
[ ] Back to profile button
[ ] Screenshot-friendly design
```

### Phase 7 — Frontend: ProofModal.tsx Cleanup

```
[ ] Strip to thin modal shell
[ ] Remove all wallet state, eligibility, quote, abandon logic
[ ] Keep: workItemId, ownerHandle, onClose
```

### Phase 8 — Dead Code Removal

```
[ ] Grep all wallet/eligibility imports before deleting
[ ] Delete PhantomAndroidFlow directory
[ ] Delete unused step components
[ ] Delete unused API routes (eligibility, build-tx, broadcast)
[ ] Delete unused lib files (only if zero callers outside proof modal)
```

### Phase 9 — QA

```
[ ] Local dev: full collab + SOL path with real TX
[ ] Local dev: full collab + LASTSHFT path with real TX
[ ] Local dev: full dev + LASTSHFT path with real TX
[ ] Local dev: failure path (wrong amount) → TRY AGAIN
[ ] Local dev: failure path (attempt 2) → SUPPORT
[ ] Local dev: duplicate submission → silent success (§3.4)
[ ] Local dev: self-proof attempt → rejection
[ ] Local dev: dev path with non-qualifying wallet → rejection
[ ] Mobile (Android Chrome): full flow, copy address, switch to Phantom, pay, switch back, paste, verify
[ ] Mobile (iOS Safari): same flow
[ ] Screen 6 receipt shows correct extracted sender
[ ] Comment persists to proofs table
[ ] Terminal cascade animation timing feels natural
[ ] Countdown timer tracks actual verification time
[ ] Vercel preview deploy: webhook + cron both process correctly
[ ] TypeScript clean: pnpm tsc --noEmit passes
```

---

## 11. Files NOT to Touch

```
src/app/api/subscription/cron/     — subscription billing
src/app/api/affiliate/             — affiliate tracking
src/components/terminal/           — terminal chrome (LOCKED per project spec)
src/lib/store-modes.ts            — store architecture (LOCKED)
vercel.json crons section          — only add, never remove
```

---

## 12. Resolved Decisions

These were open questions, now resolved per founder review session (2026-04-12):

| Question | Decision |
|----------|----------|
| Comment field placement | Screen 4, with paste field. Not a separate screen. |
| Token balance display | Remove entirely. Just show prices. |
| Self-proof prevention | Check during verification: extracted sender vs owner terminal_wallet. Reject with `self_proof`. |
| Dev path eligibility | Stays intact. token-dev-verify.ts runs against extracted sender post-payment. Moves from pre-check to post-check. |
| Time window | 5 minutes (down from 10 in V2, not 15 as initially proposed) |
| Duplicate handling | Silent success — scammer sees success, proof already counted |
| Backend architecture | Helius webhook primary, cron fallback |
| Eligibility SSE | Dead. User is anonymous until TX submitted. |

---

## 13. Success Criteria

V3 is complete when:

- [ ] User with no wallet adapter can complete a proof on any desktop browser
- [ ] User on Android Chrome can complete a proof (pay in Phantom app, paste back)
- [ ] User on iOS Safari can complete a proof (pay in Phantom app, paste back)
- [ ] No wallet-related UI anywhere in the modal
- [ ] `proofs.payer_wallet` is correctly extracted from TX (not frontend-provided)
- [ ] Self-proof attempt is rejected post-payment
- [ ] Dev path non-qualifying wallet is rejected post-payment
- [ ] Duplicate TX shows silent success (no error message)
- [ ] Comment persists from Screen 4 to proofs table
- [ ] Terminal cascade on Screen 5 shows check-by-check progress with countdown
- [ ] Receipt on Screen 6 shows all proof details
- [ ] Back button works on Screens 1-4, disabled after submit
- [ ] Verification completes in 3-8 seconds via webhook (not 60+ via cron)
- [ ] All PhantomAndroidFlow and wallet picker code is removed
- [ ] TypeScript clean: `pnpm tsc --noEmit` passes

---

*End of plan. Do not begin implementation until founder confirms.*
