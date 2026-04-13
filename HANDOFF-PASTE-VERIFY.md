# Handoff: Proof Modal v2 — Paste-to-Verify Flow

## What Was Built (commit `a201574`)

Replaced the wallet-signing pipeline (build-tx → signTransaction → broadcast → poll) with a paste-to-verify flow. User pays manually in their wallet, pastes the Solscan URL, server verifies on-chain, records proof.

## Current State

- Code: committed and pushed to main
- Vercel: deployed to production (Ready)
- Supabase: migration `0011_proof_verifications` applied
- Env vars set on Vercel: `NEXT_PUBLIC_TREASURY_WALLET`, `CRON_SECRET`
- **NOT YET TESTED on Android**

## Architecture

### Frontend: 5 screens after wallet connect

```
Wallet connect (existing Step1WalletSelect + Step2WalletPicker)
  ↓ connected
Screen 1: Path Select     — collab ($1) or dev ($5)
Screen 2: Token + Price   — LASTSHFT (40% off) / SOL / USDT
Screen 3: Pay + Paste     — treasury address (copyable), amount, paste Solscan URL
Screen 4: Verifying        — terminal-style, polls /api/proof/verify-tx/status
Screen 5: Success          — proof confirmed, Solscan link, back to profile
```

Files: `src/components/proof-modal/flows/paste-verify/`

### Backend: Queue architecture

```
POST /api/proof/verify-tx          — submit signature to queue (instant)
GET  /api/proof/verify-tx/status   — poll verification status + queue position
POST /api/proof/verify-tx/process  — cron consumer (every 1m, batch of 10)
```

### Cron Consumer — 6 verification checks

1. Transaction exists on-chain (`getTransaction`)
2. Sender matches connected wallet pubkey
3. Recipient is AR treasury wallet
4. Amount within tolerance of expected price (+/- 5%)
5. Transaction within 10 minutes of submission
6. Signature not already used (unique constraint)

### 3-Tier Failure Recovery

- **Tier 1** (attempt 1): TRY AGAIN → back to Screen 3
- **Tier 2** (attempt 2): DEEP VERIFICATION → re-submit with `maxSupportedTransactionVersion`
- **Tier 3** (attempt 3+): OPEN SUPPORT TICKET → `mailto:reportclaims@lastproof.app`

## Key Files

| File | Purpose |
|------|---------|
| `src/components/proof-modal/flows/paste-verify/PasteVerifyFlow.tsx` | 5-screen orchestrator |
| `src/components/proof-modal/flows/paste-verify/Screen1Path.tsx` | Collab/dev picker |
| `src/components/proof-modal/flows/paste-verify/Screen2Token.tsx` | Token + price picker |
| `src/components/proof-modal/flows/paste-verify/Screen3Pay.tsx` | Treasury address + paste field |
| `src/components/proof-modal/flows/paste-verify/Screen4Verify.tsx` | Verification polling UI |
| `src/components/proof-modal/flows/paste-verify/Screen5Success.tsx` | Success card |
| `src/app/api/proof/verify-tx/route.ts` | Submit endpoint (queue insert) |
| `src/app/api/proof/verify-tx/status/route.ts` | Status polling endpoint |
| `src/app/api/proof/verify-tx/process/route.ts` | Cron consumer (verification engine) |
| `src/components/proof-modal/ProofModal.tsx` | Routes to PasteVerifyFlow after wallet connect |
| `supabase/migrations/0011_proof_verifications.sql` | Queue table |
| `vercel.json` | Cron job: `/api/proof/verify-tx/process` every 1m |

## Routing in ProofModal.tsx

```
step 1: Step1WalletSelect (pick wallet)
step 2: Step2WalletPicker (connect via MWA/extension)
step 3+: → PasteVerifyFlow takes over (own 5-screen state machine)
```

PhantomAndroidFlow still exists for the `phantom + Android` route but the default flow now goes through PasteVerifyFlow for all wallets.

## Environment Variables

| Var | Value | Where |
|-----|-------|-------|
| `NEXT_PUBLIC_TREASURY_WALLET` | `5qCY5siEpGg3eofzGs826vRRCSuQ5UAHAbrpMnhmo6C7` | Vercel (production + development) |
| `CRON_SECRET` | `7a6a270897c4ae486a9c093d3a124a017b642eb57c5215b97a58da544f94ad38` | Vercel (production + development) |
| `LASTPROOF_AR_WALLET` | `5qCY5siEpGg3eofzGs826vRRCSuQ5UAHAbrpMnhmo6C7` | Already set |
| `HELIUS_RPC_URL_PAYMENTS` | (existing) | Used by cron consumer for `getTransaction` |

## Debug Queries

```sql
-- Latest verification attempts
SELECT id, created_at, status, signature, pubkey, path, token,
       failure_check, failure_detail, attempt_number, proof_id
FROM proof_verifications
ORDER BY created_at DESC
LIMIT 10;

-- Failed verifications with reasons
SELECT created_at, signature, failure_check, failure_detail, attempt_number
FROM proof_verifications
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Queue depth
SELECT count(*) as queued FROM proof_verifications WHERE status = 'queued';

-- Stuck in processing (cron may have crashed)
SELECT * FROM proof_verifications
WHERE status = 'processing'
AND created_at < now() - interval '5 minutes';

-- Successful proofs
SELECT pv.created_at, pv.signature, p.id as proof_id, p.payer_wallet
FROM proof_verifications pv
JOIN proofs p ON p.id = pv.proof_id
WHERE pv.status = 'verified'
ORDER BY pv.created_at DESC
LIMIT 10;
```

## What NOT to Touch

- Wallet connect flow (Step1WalletSelect + Step2WalletPicker) — working, don't modify
- `src/lib/proofs-store.ts` / `src/lib/db/proofs-adapter.ts` — proof insertion, shared with other flows
- `src/lib/pricing.ts` — price source of truth
- `src/lib/token-rates.ts` — live rate fetching
- Old signing pipeline files (useSignFlow, build-solana-tx, etc.) — kept but unused, may be needed later

## Known Issues / Things to Watch

1. **Cron fires every 1 minute** (Vercel Pro minimum). At low traffic this means up to 60s wait. If too slow, consider making the submit endpoint do synchronous verification for the first attempt and only queue on retry.

2. **Screen3Pay treasury address** reads from `NEXT_PUBLIC_TREASURY_WALLET`. If this env var is missing, the address shows as empty string. Verify it renders on the deployed site.

3. **Amount tolerance** is 5% or the `toleranceForUsd` from pricing.ts (whichever is larger). For LASTSHFT with volatile price, this may be too tight or too loose — monitor after first real transactions.

4. **blockTime check** uses server clock. If Solana validators have clock drift > 60s, the "transaction too old" check could false-positive. The code has a 60s future tolerance buffer.

5. **Profile ID derivation** — the submit endpoint looks up `profile_id` from `work_item_id` via the work_items table. If the work item doesn't exist, returns 404.

## What the Returning Session Should Do

1. Test on Samsung S25: wallet connect → pick path → pick token → see treasury address → pay in Phantom → copy Solscan URL → paste → submit → verify → success
2. If Screen3Pay shows empty treasury address: check `NEXT_PUBLIC_TREASURY_WALLET` env var on Vercel
3. If verification stays "queued" forever: check cron job is firing (`vercel logs` for `/api/proof/verify-tx/process`), check `CRON_SECRET` matches
4. If verification fails: query `proof_verifications` table for `failure_check` and `failure_detail`
5. Clean up `HANDOFF-BROADCAST-DEBUG.md` — no longer relevant with paste-verify flow
