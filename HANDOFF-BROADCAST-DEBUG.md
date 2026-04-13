# Handoff: Proof Flow Broadcast 503 Debug

## Your Mission

The Phantom Android proof flow reaches the broadcast step and fails with `503 rpc_degraded`. Everything before broadcast works: MWA connect, eligibility, build-tx, wallet signing (Phantom approval screen shows, user approves). The signed transaction gets serialized and sent to `/api/proof/broadcast`, which calls `connection.sendRawTransaction()` — that call throws, and the error gets mapped to `rpc_degraded`.

**Your job: find the actual RPC error message, diagnose the root cause, and fix it.**

---

## What Was Just Deployed (commit `05fae76`)

The broadcast route now returns the actual RPC error message in the response:

```typescript
// src/app/api/proof/broadcast/route.ts line 85
return json({ ok: false, reason: "rpc_degraded", rpc_error: msg.slice(0, 500) }, 503);
```

And `useSignFlow.ts` now captures `rpc_error` in debug events:

```typescript
// src/components/proof-modal/useSignFlow.ts line 229
d("broadcast_response", { status: res.status, ok: body.ok, reason: body.reason, rpc_error: body.rpc_error, signature: body.signature });
```

**After the user tests again, query the `debug_events` table** for the latest `broadcast_response` event. The `payload.rpc_error` field will contain the actual Helius/Solana RPC error message.

```sql
SELECT payload
FROM debug_events
WHERE event = 'broadcast_response'
ORDER BY created_at DESC
LIMIT 5;
```

---

## The Full Data Flow (sign → broadcast)

### Client Side (PhantomAndroidFlow.tsx lines 235-275)

1. Server builds a **legacy `Transaction`** in `buildSolanaTx()` and serializes it unsigned:
   ```typescript
   // src/lib/build-solana-tx.ts line 190-194
   const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
   const tx_base64 = serialized.toString("base64");
   ```

2. Client receives `tx_base64`, decodes it, converts to `VersionedTransaction` for MWA compatibility:
   ```typescript
   // PhantomAndroidFlow.tsx lines 248-254
   const rawBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
   const legacyTx = Transaction.from(rawBytes);
   const vtx = new VersionedTransaction(legacyTx.compileMessage());
   ```

3. Wallet signs via `useWallet().signTransaction(vtx)` — MWA fires Android intent, Phantom shows approval, user approves.

4. Signed tx is serialized back to base64:
   ```typescript
   // PhantomAndroidFlow.tsx lines 261-267
   const signed = await signTransaction(vtx);
   const bytes = signed.serialize();
   let bin = "";
   bytes.forEach((b: number) => (bin += String.fromCharCode(b)));
   return btoa(bin);
   ```

### Server Side (broadcast/route.ts)

5. Receives `signed_tx_base64`, decodes to Buffer:
   ```typescript
   rawTx = Buffer.from(body.signed_tx_base64, "base64");
   ```

6. Submits to Solana RPC:
   ```typescript
   signature = await connection.sendRawTransaction(rawTx, {
     skipPreflight: false,
     preflightCommitment: "confirmed",
     maxRetries: 3,
   });
   ```

7. If `sendRawTransaction` throws, the error message is checked against known patterns (signature_invalid, blockhash_expired, insufficient_balance). **Anything else falls through to `rpc_degraded`** — this is where it's failing.

---

## Most Likely Root Causes (investigate in order)

### 1. VersionedTransaction serialization mismatch
The server builds a legacy `Transaction`, client converts to `VersionedTransaction` via `legacyTx.compileMessage()`, Phantom MWA signs it, then `signed.serialize()` produces VersionedTransaction wire format. The server's `sendRawTransaction` receives this as a raw `Buffer` — `@solana/web3.js`'s `sendRawTransaction` accepts both formats, so this *should* work. But verify: does `compileMessage()` produce a valid `MessageV0`? Or does it produce a legacy `Message` wrapped in a VersionedTransaction? Check if the RPC error says "failed to deserialize" or "invalid transaction".

### 2. Preflight simulation failure
`skipPreflight: false` means the RPC simulates before broadcasting. If simulation fails (wrong program, bad accounts, instruction error), it throws. The error message would contain simulation details. **Try setting `skipPreflight: true` temporarily** to see if the transaction actually lands on-chain without preflight.

### 3. Blockhash already expired by signing time
The blockhash is fetched during `build-tx`. The user then reviews the transaction and goes through MWA approval in Phantom. If this takes too long (>60-90 seconds), the blockhash may expire before broadcast. The error message would say "blockhash not found" — but this should be caught by the existing check. Unless Helius returns a different error format.

### 4. Helius API key not propagated
The env var `HELIUS_RPC_URL_PAYMENTS` was set via `vercel env add` (commit `a70f8da`). Verify the deployment actually picked it up. If the key is wrong or not set, and it falls through to `https://api.mainnet-beta.solana.com` (the free public RPC), `sendRawTransaction` often rate-limits or fails. Check if the error message is a rate limit or 429.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/proof/broadcast/route.ts` | Server: receives signed tx, submits to RPC |
| `src/app/api/proof/build-tx/route.ts` | Server: builds unsigned legacy tx |
| `src/lib/build-solana-tx.ts` | Server: shared tx builder (SOL/SPL transfer + memo + reference) |
| `src/components/proof-modal/flows/phantom/android/PhantomAndroidFlow.tsx` | Client: MWA signing orchestrator, legacy→VersionedTx conversion |
| `src/components/proof-modal/useSignFlow.ts` | Client: build-tx → sign → broadcast → poll state machine |
| `src/lib/debug/useDebugLog.ts` | Client: batched event logger |
| `src/app/api/debug/log/route.ts` | Server: inserts debug events into Supabase |
| `supabase/migrations/0010_debug_events.sql` | Table schema: debug_events |

---

## RPC Configuration

```
HELIUS_RPC_URL           = https://mainnet.helius-rpc.com/?api-key=ede6a836-daa3-4d73-941e-250bee068fb7  (reads/price checks)
HELIUS_RPC_URL_PAYMENTS  = https://mainnet.helius-rpc.com/?api-key=5253902d-a5a3-40e7-8936-d16d645276a2  (writes: build-tx, broadcast, tx-status)
```

All 6 write endpoints (proof + payment: build-tx, broadcast, tx-status) use:
```typescript
const RPC_URL = process.env.HELIUS_RPC_URL_PAYMENTS || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
```

---

## Debug Events Table

```sql
-- Schema (from 0010_debug_events.sql)
CREATE TABLE debug_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  session_id TEXT NOT NULL,
  category TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  user_agent TEXT,
  wallet_env TEXT,
  is_android BOOLEAN DEFAULT false
);
```

### Useful queries

```sql
-- Latest broadcast errors with actual RPC error message (after 05fae76 deploys)
SELECT created_at, payload->>'rpc_error' as rpc_error, payload
FROM debug_events
WHERE event = 'broadcast_response'
ORDER BY created_at DESC
LIMIT 10;

-- Full session trace (get session_id from above, then):
SELECT created_at, category, event, payload
FROM debug_events
WHERE session_id = '<SESSION_ID>'
ORDER BY created_at ASC;

-- All failures
SELECT created_at, event, payload
FROM debug_events
WHERE event LIKE '%failed%' OR event LIKE '%error%' OR event LIKE '%rejected%'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Commit History (relevant)

```
05fae76 Expose actual RPC error message in broadcast 503 response      ← LATEST
a70f8da Split Helius RPC keys: HELIUS_RPC_URL_PAYMENTS for write endpoints
f55740f Fix MWA signing: convert legacy Transaction to VersionedTransaction
7da2c6e Hide dev-only eligibility toggle in production
31437d6 Fix proof flow auth: remove session requirement from build-tx and broadcast
c5b11f7 Add debug event logger for proof flow observability
b371f23 Fix Phantom Android signing: use useWallet().signTransaction instead of raw adapter
1c0a379 Fix Phantom Android: use MWA adapter instead of PhantomWalletAdapter
```

---

## What NOT to Touch

- The proof flow is **public** — provers don't have LASTPROOF sessions. Don't add `readSession()` back to proof routes.
- The payer pubkey comes from `quote.metadata.pubkey`, set during eligibility check. Don't change this.
- The `buildSolanaTx()` function is shared between proof and payment routes. Changes there affect both flows.
- The debug event system works — don't modify it unless adding new event types.

---

## Action Plan

1. **Wait for user to test** on Android after Vercel deploys commit `05fae76`
2. **Query `debug_events`** for the `broadcast_response` event — read `payload.rpc_error`
3. **Diagnose** based on the actual error message:
   - If "failed to deserialize" → the VersionedTransaction conversion is wrong. Fix the serialization.
   - If simulation error (instruction error, account issues) → check the transaction instructions. May need `skipPreflight: true` to see if it's a preflight-only issue.
   - If "blockhash not found" → timing issue. Consider fetching blockhash closer to broadcast time.
   - If rate limit / 429 → Helius key not propagated. Check env vars.
   - If signature verification → the MWA signing produced an invalid signature somehow.
4. **Fix the root cause** — don't just catch more error strings. Fix why `sendRawTransaction` is rejecting the transaction.
5. **Test again** and verify via debug events.

---

## Warning Signs / Known Risk Areas

These are things that went wrong or almost went wrong during this debugging arc. The next session should be aware of all of them:

### 1. Legacy Transaction vs VersionedTransaction confusion
The server (`buildSolanaTx`) builds a **legacy `Transaction`** using `@solana/web3.js`. The client converts it to a `VersionedTransaction` because MWA on Android requires it. This conversion uses `legacyTx.compileMessage()` which returns a legacy `Message` (not `MessageV0`). The `VersionedTransaction` constructor wraps this legacy message. After MWA signing, `signed.serialize()` produces wire-format bytes. The question is: does `sendRawTransaction` on the server correctly handle these bytes? The `@solana/web3.js` library's `sendRawTransaction` accepts raw bytes and passes them to the RPC — it doesn't try to deserialize them. But the **Solana validator** needs to deserialize them. If the wire format is wrong, the validator rejects it. **This is the #1 suspect.**

### 2. Previous session made assumption-based decisions
The legacy-to-VersionedTransaction conversion was done without verifying against `@solana/web3.js` documentation. The user explicitly flagged this: *"why did you go with legacy transaction in the first place? documentation? assumption?"* The answer was assumption. The conversion path (`Transaction.from() → compileMessage() → new VersionedTransaction()`) was also written without doc verification. **Verify this conversion is correct against the actual @solana/web3.js source or docs before assuming it's fine.**

### 3. The "rpc_degraded" catch-all masked the real error for 3+ test cycles
Before commit `05fae76`, the broadcast route returned `{ reason: "rpc_degraded" }` for ANY unrecognized `sendRawTransaction` error. The actual error message was only logged to `console.error` (Vercel function logs), not returned to the client or captured in debug events. This meant 3 test cycles were wasted — the user tested, saw "rpc_degraded", and we couldn't determine the root cause. The fix now returns `rpc_error` in the response body. **Always include actual error details in responses during debugging — don't hide them behind generic codes.**

### 4. Free public Solana RPC was being used instead of Helius
The code had `https://api.mainnet-beta.solana.com` as the fallback RPC. Before the Helius key split (commit `a70f8da`), some endpoints were hitting the free public RPC which rate-limits aggressively. The env var `HELIUS_RPC_URL_PAYMENTS` was added but **has not been verified to be working in production** — the broadcast still failed with 503 after the key was set. Either the Vercel deployment didn't pick up the env var, the key is invalid, or the error is not RPC-related at all (it's a transaction format issue being caught as a generic RPC error).

### 5. Env vars set via `vercel env add` require redeployment
Setting env vars via `vercel env add` does NOT automatically redeploy. A new push or manual redeploy is needed. Commit `a70f8da` was pushed after the env vars were set, which should have triggered a redeploy, but it hasn't been verified that the function actually reads the correct value. **Consider adding a temporary log line that prints `RPC_URL.slice(0, 40)` to confirm which RPC is being used.**

### 6. The signing flow has multiple points where byte corruption can occur
The base64 round-trip has several conversion steps:
- Server: `tx.serialize()` → `Buffer` → `.toString("base64")` → JSON response
- Client: `atob()` → `Uint8Array.from()` → `Transaction.from()` → `.compileMessage()` → `new VersionedTransaction()` → MWA signs → `.serialize()` → manual byte-to-string loop → `btoa()` → JSON body
- Server: `Buffer.from(base64, "base64")` → `sendRawTransaction()`

That manual byte-to-string conversion on the client (lines 262-263) is suspicious:
```typescript
let bin = "";
bytes.forEach((b: number) => (bin += String.fromCharCode(b)));
return btoa(bin);
```
This is a valid pattern for binary-to-base64 in the browser, but if any byte > 255 somehow appears (shouldn't from `Uint8Array`), it would silently corrupt. More importantly, if `signed.serialize()` returns a different type than expected, the `forEach` could produce wrong output.

### 7. Phantom domain trust warnings
When the user tested, Phantom showed "This dApp could be malicious" warnings for the lastproof.app domain. This is cosmetic — Phantom shows this for any domain not in their verified list. It does NOT prevent signing. The user was able to approve despite the warning. To resolve permanently, email review@phantom.com to request domain verification.

### 8. User is the sole tester — one device, one test at a time
The user tests on a single Android device with Phantom. Each test cycle requires: opening the site → connecting wallet via MWA → going through eligibility → approving in Phantom → waiting for broadcast result. This takes 2-3 minutes per cycle. Don't waste test cycles on speculative fixes — diagnose from debug events first, then deploy a targeted fix.

---

## Memory File Rules (CRITICAL)

Read `/Users/tallada2023/.claude/projects/-Users-tallada2023-Documents-Claude-Projects-LASTSHIFT/memory/MEMORY.md` and all linked memory files at session start. Key rules:
- **Never assume** — verify against docs at every transform boundary
- **No quick fixes** — trace full data flow, fix all instances of a pattern
- **Do work before replying** — execute backend work first, then report
- **Check before asking** — search memory, env, code before asking user for ANY information
