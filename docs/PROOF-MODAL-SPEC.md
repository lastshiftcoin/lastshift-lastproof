# LASTPROOF — "VERIFY THIS WORK" Proof Modal Spec

**Status:** Wireframe locked · `wireframes/lastproof-proof-modal.html`
**Audience:** LASTPROOF backend builder — review for feasibility, edge cases, and contract feedback before frontend implementation begins.
**Owner:** Frontend (Claude) — waiting on your capability feedback before writing any TS/CSS.

> **Canon:** Wireframe is `wireframes/lastproof-proof-modal.html`. Tier/trust rules per `CLAUDE.md` and `LASTPROOF-BUILDER-HANDOFF.md`. When any of these disagree, **the wireframe wins** and this doc gets updated. Ignore the stale "Final Plan" in `~/.claude/plans/` — it's superseded.

---

## 0. TL;DR

This modal is how a **random, unauthenticated visitor** on a public profile (`/@cryptomark`) leaves a permanent on-chain proof that an operator actually did the work for a specific project. It is the single highest-stakes UX in the app — a fake dev proof poisons the entire trust system, so the **dev-wallet eligibility gate is non-negotiable**.

Core constraints:
- **No LASTPROOF account required.** Proofer is a stranger with a Solana wallet.
- **One wallet, one proof, per project.** Ever. Immutable.
- **One DEV proof per project.** Ever.
- **Projects are immutable once ≥1 proof exists** (enforced elsewhere, but this modal is the first producer of proofs → it triggers the lock).
- **LASTPROOF never custodies funds.** Payments go directly to the `$LASTSHFT AR WALLET` treasury via Solana Pay.
- **Terminal/boot chrome.** Mirrors `lastproof-onboarding.html` — titlebar with traffic-light dots, scanlines, progress bar with step counter, popIn animation.

---

## 1. Entry point

- **Trigger:** `VERIFY THIS WORK` button on the public profile page, scoped to a specific `work_item` on that profile.
- **Payload the modal is initialized with** (from the profile route):
  - `profile.handle` — e.g. `cryptomark`
  - `profile.id`
  - `work_item.id`
  - `work_item.project_ticker` — e.g. `$LASTSHFT`
  - `work_item.project_token_mint` — Solana mint address
  - `work_item.role` — e.g. `Growth Lead`
  - `work_item.start_date` / `work_item.end_date` (or `CURRENT`)
  - `work_item.is_current` — bool

**Backend questions:**
1. Can `work_item` carry the `project_token_mint` at read time, or does the modal need to resolve it separately via a ticker lookup? Prefer the former — avoids an extra round-trip on open.
2. What's the canonical field for "this project is still active" — a null `end_date`, or an explicit `is_current` bool? Wireframe currently shows a `CURRENT` tag based on this.

---

## 2. Flow overview — 8 steps + side states

```
STEP 1  Path select        ─┐
STEP 2  Connect wallet     ─┤  pre-signing
STEP 3  Comment (optional) ─┤  (no on-chain work yet)
STEP 4  Pick payment token ─┘
STEP 5  Eligibility check  ──┐  on-chain reads + backend preflight
STEP 6  Review              ─┤  final preview with live price
STEP 7  Wallet signature    ─┤  user signs in wallet
STEP 8  Outcome (ok/fail)   ─┘  tx result

Side states reachable from any step:
  DISC      — manual disconnect (from conn-pill click)
  INELIG    — dev wallet failed eligibility (from step 5)
  ERR       — tx rejected / reverted (goes to step 8 fail)
```

Progress bar math: `step / 8 * 100%`. Step counter shown top-right.

---

## 3. Step-by-step contract

### STEP 1 — Path select

**UI:** Project ref card (ticker, role, dates, `CURRENT` tag) + two path cards:
- **COLLABORATOR** — $1 — limit `1 PER WALLET`
- **TOKEN DEV** — $5 — limit `1 DEV PROOF / PROJECT`

**State captured:** `path ∈ {'collab', 'dev'}`

**Backend needs:** Nothing. This is pure frontend state until step 5.

**Pricing source of truth:** These USD numbers ($1 / $5) — are they hardcoded env vars or tunable per-project? Wireframe assumes **hardcoded globals**:
```
PROOF_PRICE_COLLAB_USD = 1.00
PROOF_PRICE_DEV_USD    = 5.00
LASTSHFT_DISCOUNT      = 0.40   // 40% off when paying in $LASTSHFT
```
Please confirm or propose an alternative.

---

### STEP 2 — Connect wallet

**UI:** Subtitle `SELECT WALLET`, four provider buttons:
- **Phantom** · browser extension + mobile
- **Solflare** · browser extension + mobile
- **Jupiter** · browser extension + mobile
- **Binance Wallet** · browser extension + mobile

Logos sourced via Google favicon API in the wireframe; production will use the `@solana/wallet-adapter-*` package's bundled SVGs.

**Flow sub-states inside step 2:**
1. `walletPicker` (default) — 4 provider buttons
2. `walletConnecting` — spinner + "WAITING FOR [WALLET]…" + CANCEL link
3. `walletVerified` — green check, wallet name + truncated address, explicit `> CONTINUE` button

**Critical UX rule:** After the wallet approves, **do not auto-advance**. Show the verified state and require the user to click `CONTINUE`. This is deliberate — the user is a stranger and needs a beat to confirm the right wallet is connected before committing.

**State captured:**
- `connected: boolean`
- `wallet.name: string` (Phantom | Solflare | Jupiter | Binance)
- `wallet.address: string` (base58 pubkey)
- `wallet.adapter` — the wallet-adapter instance for signing

**Persistent connected pill** — once connected, a green pill in the titlebar shows `● CONNECTED · [WALLET] · F7k2…9xMp` on every subsequent step (3–8). Hovering it flips the pill red and reveals `DISCONNECT`. Clicking it force-disconnects and routes to the DISC side state.

**Backend needs:** None at this step. Wallet connect is client-side.

**Backend questions:**
3. Is our canonical supported-wallet set still **Phantom, Solflare, Jupiter, Binance**? This was settled in `docs/research/WALLET-POLICY.md` but please confirm nothing has shifted. No WalletConnect, no Backpack, no Ledger direct.
4. For Jupiter and Binance (previously flagged as "unverified"), do we now have full Solana Pay confidence, or should we still surface a warning if payment stalls? We removed the verified/unverified badges per user direction — all four are presented as equal.

---

### STEP 3 — Comment (optional)

**UI:** Project ref card + single textarea.
- 140 char limit
- Plain text only, no URLs (client-side sanitization + server re-sanitization)
- Placeholder: `e.g. shipped the v1 launch — onboarded 4k holders in 30 days.`
- Completely optional — user can submit empty

**State captured:** `comment: string` (trimmed, max 140)

**Previous state:** Used to show a dev-signal panel here; that was **removed**. Collab and dev paths see identical UX on step 3. Dev verification happens entirely in step 5.

**Backend needs:**
- Server must re-validate: ≤140 chars, strip URLs, strip control chars, NFC normalize.
- Store raw comment on the `proofs` row.

**Backend question:**
5. Is there a profanity/moderation layer we want applied here? The wireframe doesn't show one. These comments are permanent and publicly visible on profiles forever.

---

### STEP 4 — Pick payment token

**UI:** Three token cards (two-column flex layout):
1. **$LASTSHFT** (selected by default) — `40% OFF` pill, strike-through base price, discounted price, shows `BAL: X · ≈ $Y`, and a **`BUY $LASTSHFT ↗`** button linking to `https://lastshiftcoin.com/buy`
2. **SOL** — shows balance and `≈ X SOL` conversion
3. **USDT** (not USDC — we switched on user direction)

**Pricing is path-aware** (computed client-side from the two env globals above):

| Path | Base (SOL/USDT) | $LASTSHFT (−40%) |
|------|-----------------|------------------|
| COLLAB | $1.00 | $0.60 |
| DEV    | $5.00 | $3.00 |

**State captured:** `token ∈ {'lastshft', 'sol', 'usdt'}`

**Balance display** — the sub-line under each token name shows **live wallet balances** fetched after connect:
- `BAL: 1,250.00 $LASTSHFT · ≈ $0.15`
- `BAL: 0.428 SOL · ≈ $78.12`
- `BAL: 42.30 USDT · ≈ $42.30`

**Backend / RPC needs:**
- After step 2 connect, fetch SPL balances for the connected pubkey for: `$LASTSHFT mint`, `USDT mint`, and native SOL.
- Fetch USD prices for the same three via Jupiter Price API (or whatever we're standardizing on).
- Return a single payload so we're not making 3 round trips.

**Endpoint (folded into `/eligibility` per backend contract):**
`/wallet-context` is **gone**. Balances + prices are returned as part of the `/api/proof/eligibility` response so the balance shown on step 4 is the exact same balance enforced on step 5. This kills the race window between "balance displayed" and "balance checked."

FE call timing: fire `/eligibility` on the **step 2→3 transition** (right after wallet connect, while the user is typing a comment). By the time they hit continue on step 4, the response is already cached. If the user lands on step 5 before the call resolves, the step 5 terminal log animates live off the SSE stream.

**Backend questions:**
6. ~~wallet-context endpoint~~ — **RESOLVED**: folded into `/eligibility`.
7. For the `BUY $LASTSHFT` button — is `https://lastshiftcoin.com/buy` the canonical buy page, or should it be a Jupiter swap link? User said `lastshiftcoin.com/buy`.
8. What happens if `BAL < required` when they try to proceed? Right now the wireframe doesn't block — backend needs to block at quote time (step 5/6) and surface a specific error. Is "insufficient balance" a pre-sign check or does it fall through to a signature failure?

---

### STEP 5 — Eligibility check (the critical one)

**UI:** Terminal-style log that reveals line-by-line like a command response, matches onboarding boot feel.

**This step has three variants** selected by `path` + server eligibility result:

#### 5a. COLLAB · eligible
```
> lastproof verify --wallet F7k2…9xMp --project $LASTSHFT --role collaborator
  [✓] UNIQUENESS   wallet has not proofed this project
  [✓] SLOT         collaborator slot open
  [✓] BALANCE      1,250.00 $LASTSHFT · need 1.67 $LASTSHFT
> all checks passed · ready to sign█
```

#### 5b. DEV · eligible
```
> lastproof verify --wallet F7k2…9xMp --project $LASTSHFT --role dev
  [✓] UNIQUENESS      wallet has not proofed this project
  [✓] SLOT            no dev proof yet on this project
  [✓] BALANCE         1,250.00 $LASTSHFT · need 8.33 $LASTSHFT
  [✓] MINT-AUTHORITY  F7k2…9xMp is current mint authority
  [✓] DEPLOYER        F7k2…9xMp signed mint tx · slot 3 of first-5 holders
> dev wallet verified · ready to sign█
```

#### 5c. DEV · INELIGIBLE (the critical trust gate)
```
> lastproof verify --wallet F7k2…9xMp --project $LASTSHFT --role dev
  [✓] UNIQUENESS      wallet has not proofed this project
  [✓] SLOT            no dev proof yet on this project
  [✓] BALANCE         1,250.00 $LASTSHFT · need 8.33 $LASTSHFT
  [✗] MINT-AUTHORITY  not the current mint authority
  [✗] DEPLOYER        did not sign mint tx · not in first-5 holders
  [✗] FOUNDER         not a multisig signer
> ERROR: wallet not eligible for dev proof on this project
```

When ineligible:
1. **Force auto-disconnect** the wallet immediately (client-side: drop adapter state, hide the green conn-pill in the titlebar).
2. Show a red dashed banner: **`● YOU'VE BEEN AUTOMATICALLY DISCONNECTED`**
3. Show the dev-wallet qualification explainer:
   > To file a DEV proof, the connected wallet must match at least one of the on-chain signals for $LASTSHFT:
   > - **DEPLOYER** — signed the token mint transaction
   > - **MINT AUTHORITY** — current mint authority wallet
   > - **FIRST-5 HOLDER** — one of the first 5 holders at mint distribution
   > - **FOUNDER MULTISIG** — verified signer on the project treasury multisig
   >
   > If you're a collaborator (not a dev), go back and pick the COLLABORATOR path instead.
4. Single CTA: **`> TRY A NEW WALLET`** → routes back to step 2 with a fresh picker. Back button is hidden on step 5.

**Backend / on-chain needs — `POST /api/proof/eligibility`**

This is where the **single most important file in the app** lives. Per `CLAUDE.md`:
> Token-dev qualification gate in `lib/token-dev-verify.ts` is the single most important piece of logic in the app.

**Proposed contract:**
```
POST /api/proof/eligibility
body: {
  pubkey:  "F7k2…9xMp",
  project: "$LASTSHFT",          // or mint address
  path:    "collab" | "dev",
  token:   "lastshft" | "sol" | "usdt"
}
→ 200 {
    eligible: true,
    checks: [
      { id: "uniqueness", label: "UNIQUENESS",  ok: true,  detail: "wallet has not proofed this project" },
      { id: "slot",       label: "DEV SLOT",    ok: true,  detail: "no dev proof yet on this project" },
      { id: "deployer",   label: "DEPLOYER",    ok: true,  detail: "F7k2…9xMp matches mint authority" },
      { id: "first5",     label: "FIRST-5",     ok: true,  detail: "slot 3 of mint distribution" },
      { id: "balance",    label: "BALANCE",     ok: true,  detail: "1,250.00 $LASTSHFT · need 8.33 $LASTSHFT" }
    ],
    quote: {
      token: "lastshft",
      amount_ui: 8.33,
      amount_raw: "8330000",
      usd: 3.00,
      usd_rate: 0.00012,            // 1 $LASTSHFT in USD at quote time
      quote_id: "qt_01H...",        // short-lived, server-held
      expires_at: "2026-04-09T18:23:00Z"
    }
  }

→ 200 (ineligible)
  {
    eligible: false,
    reason: "dev_checks_failed",
    checks: [...same shape, with .ok=false for failed ones...],
    failed_checks: ["deployer", "first5", "founder"]
  }

→ 409 already_proofed
→ 409 dev_slot_taken
→ 402 insufficient_balance { needed, have }
→ 423 project_locked   (shouldn't happen — proofs lock further project edits, not further proofs)
```

**Frontend expectations:**
- The `checks[]` order drives the sequential terminal reveal order — the UI walks the array and adds each line as it arrives.
- The `quote.quote_id` must be passed forward to step 6 review and step 7 sign. It's the server's promise that this price is honored for N seconds.
- The `quote` sub-object is only present when `eligible: true`.

**Latency + reveal sequencing (revised — be honest with me here):**

I originally proposed a ≤2.5s hard budget with a 500ms-per-line stagger. Pre-conceding that's optimistic: Helius `getSignaturesForAddress` + `getMintAuthority` + first-N-minters on a cold cache is routinely **3–6s**, and the founder-multisig check (if implemented) adds more. So:

- **If you can deliver the full payload in ≤2.5s (warm cache),** we keep the terminal-stagger reveal as-is.
- **If you can't,** I'll rework step 5 UX to: show a spinner immediately, then **stream each check as it resolves** via SSE or chunked response. The terminal-log feel is preserved — lines land at whatever cadence the backend delivers them — and the spinner hangs on the last pending row until the final check comes back.

What I need from you to decide:
- **Which checks are fast** (single RPC call, cacheable, or backend-precomputed) **vs slow** (cold on-chain scans)? I'll order the reveal fast→slow so the user sees momentum immediately and the spinner only hangs at the end.
- **Can checks be parallelized server-side** so wall-clock = max(check) rather than sum(checks)? E.g. uniqueness + slot + balance are all DB reads that can fan out; deployer + first-5 are on-chain and can fan out separately.
- **Preferred streaming protocol** if we go that route — SSE (`text/event-stream`), chunked JSON, or WebSocket? I'd default to SSE for simplicity unless you have a reason to pick otherwise.

**Backend questions — eligibility logic:**

9. **Deployer detection.** What's the source of truth — are we signing-wallet-of-first-mint, or current `mintAuthority`, or both? `CLAUDE.md` implies a live on-chain check via `lib/token-dev-verify.ts` — what RPC provider (Helius? Triton?) and what's our p95 latency budget? The wireframe reveals each check with a 500ms stagger, so the total endpoint budget is roughly **≤2.5s** or the animation stalls visibly.

10. **First-5 holder check.** How far back do we scan — raw mint ix, or the first 5 holders at a snapshot? What about distributions that happened via a vesting contract or Streamflow — are those "genuine holders"? This is a trust-system decision.

11. **Founder multisig check.** Is this check actually implemented, or aspirational? If aspirational, I'll render it as a "coming soon" line that's always `–` (neutral) instead of `[✗]`. No point failing a check we don't actually enforce.

12. **Balance check conversion.** The `need X $LASTSHFT` line requires converting the USD price ($3) to $LASTSHFT using the same price we'll use at signing. Is that handled inside the eligibility endpoint (returns raw + UI amount), or does the FE compute it from a separate price endpoint? Strongly prefer backend-computed — FE should never do fee math.

13. **Quote TTL.** How long should `quote.expires_at` be? 60 seconds? 120? The user might sit on step 6 reading the review card for a while. If the quote expires while they're on step 6, the live-price ticker in step 6 needs to re-fetch and update the displayed amount (already wired in the wireframe). Propose a refresh contract.

14. **Atomicity.** The eligibility check needs to guarantee that between `eligibility OK` and `tx confirmed`, nobody else claimed the dev slot for the same project. How is this enforced? Pessimistic lock on `{project_id, role='dev'}`? Optimistic with a unique index + retry? This matters because the wireframe tells the user "ready to sign" and can't gracefully handle a 409 at signature time.

---

### STEP 6 — Review

**UI:** 8-row review card + live price indicator:

```
PROJECT       $LASTSHFT
ROLE          GROWTH LEAD
PROOF TYPE    COLLABORATOR | DEV
COMMENT       SHIPPED V1 LAUNCH…
FROM WALLET   F7K2…9XMP
TO            $LASTSHFT AR WALLET
PAY WITH      $LASTSHFT (−40%)
AMOUNT        $0.60 = 5,000.00 $LASTSHFT  [● LIVE]
RATE          1 $LASTSHFT ≈ $0.00012 · UPDATED 3s AGO
```

Fine print: `PRICE REFRESHES EVERY 5S FROM JUPITER AGGREGATOR · LOCKED AT SIGNATURE`

**Button label:** `> VERIFY THIS PROOF`

**Live price ticker behavior:**
- Every 5 seconds, re-fetch the quoted amount from the server (using the `quote_id` from step 5).
- If the server returns a new quote, flash the amount (180ms opacity dip) and update the displayed number.
- Show `UPDATED Ns AGO` counter.

**State captured:** `quote_id` stays the same; `quote.amount_ui` and `quote.usd_rate` update in place.

**Proposed endpoint:**
```
GET /api/proof/quote/{quote_id}/refresh
→ 200 { amount_ui, amount_raw, usd_rate, expires_at }
→ 410 quote_expired (re-issue new quote_id)
→ 404 quote_not_found
```

**Backend questions:**
15. Does refreshing a quote generate a new `quote_id` or extend the existing one? FE prefers the latter so the signing payload doesn't drift between the review screen and the sign screen.
16. **Quote expired sub-state (RESOLVED).** FE polls at T-30s before `expires_at`. If the quote ages out while user is on step 6, the review card is replaced by an inline red dashed banner `QUOTE EXPIRED — REFRESH PRICE` with a single `> REFRESH PRICE` button that re-hits `/refresh`. No bounce back to step 1.

16b. **Refresh re-verifies eligibility at ≥45s stale (RESOLVED).** `/refresh` is a single round-trip: if eligibility age ≥ 45s, the backend re-runs eligibility inside the same PG advisory lock session (reusing warm RPC cache where possible) before repricing. 45s threshold gives a 75s safety margin under the 120s lock ceiling. FE stays dumb — one call, one of three outcomes:

```
POST /api/proof/quote/{id}/refresh
→ 200 { ok: true,  quote: {...}, eligibility: { reVerified: boolean, ageMs: number } }
→ 200 { ok: false, reason: "slot_taken"|"insufficient_balance"|"quote_expired_hard"|"rpc_degraded", ... }
→ 409 { ok: false, reason: "lock_lost" }   // force-disconnect via step 5 failure path
```

On `{ ok: false }` the FE short-circuits to step 5 failure using the same force-disconnect path as the initial ineligible flow. `reVerified: true` may trigger a subtle terminal-log flicker; FE is free to ignore the flag.

---

### STEP 7 — Wallet signature

**UI:**
- Title: `Approve in [Phantom].` (wallet name injected from step 2)
- Body: "Open your wallet and approve the transaction. Your wallet will verify keys and sign the proof — LASTPROOF never sees your private key."
- Phone/device icon with spinning orange ring
- Sign log:
  ```
  ✓ WALLET CONNECTED · F7K2…9XMP
  ✓ TRANSACTION BUILT · PROOF PAYLOAD READY
  … AWAITING SIGNATURE IN WALLET…
  ```
- Fine print: `DO NOT CLOSE THIS WINDOW · TIMES OUT AFTER 60 SECONDS`
- **No bottom CTA bar.** User isn't clicking; the wallet is signing.

**Flow:**
1. On entering step 7, FE calls `POST /api/proof/build-tx` with `quote_id`.
2. Backend constructs the Solana Pay transaction (transfer to `$LASTSHFT AR WALLET` + memo with proof payload hash) and returns a serialized transaction.
3. FE passes the tx to the wallet adapter for signing.
4. FE submits the signed tx to `POST /api/proof/broadcast`.
5. Backend broadcasts, waits for finality, updates the `proofs` row.
6. On success → step 8 (ok). On failure → step 8 (fail).

**Proposed endpoints:**
```
POST /api/proof/build-tx
body: { quote_id }
→ 200 {
    tx_base64: "...",
    expected_signer: "F7k2…9xMp",
    memo: "lp:v1:cryptomark:$LASTSHFT:collab:qt_01H..."
  }
→ 410 quote_expired
→ 422 eligibility_drifted   (balance changed, slot taken, etc)

POST /api/proof/broadcast
body: { quote_id, signed_tx_base64 }
→ 200 {
    proof_id:    "pf_01H...",
    signature:   "5HxV…b3Qm",
    confirmed_at: "2026-04-09T18:22:55Z",
    solscan_url: "https://solscan.io/tx/5HxV...b3Qm"
  }
→ 400 signature_invalid
→ 402 tx_reverted { reason }
→ 408 user_timeout
→ 503 rpc_down
```

**Backend questions:**
17. **Memo format.** What goes in the Solana Pay memo? FE needs this to be stable so the backend can later scrape chain for missed confirmations. Propose `lp:v1:{handle}:{ticker}:{path}:{quote_id}`.
18. **Partial signing?** Is the proof a pure client-signed SPL transfer, or is there a backend co-signer (e.g. for fee sponsorship or relay)? The wireframe assumes pure client-signed.
19. **Timeout handling.** If the wallet adapter hangs past 60s, we abandon the tx on FE. Does the backend need to know? I.e. should we `POST /api/proof/abandon` so the quote isn't holding the dev slot?
20. **Idempotency.** If the user double-clicks sign, or the FE retries a broadcast on network blip, we need idempotency keyed on `quote_id`. Is that built-in?

---

### STEP 8 — Outcome (success OR failure)

#### 8a. SUCCESS
- Green check circle + pulse glow
- `PROOFED ON-CHAIN` eyebrow
- Headline: `@cryptomark thanks you. It's done.`
- Sub: "Your proof is live. The operator's count just ticked up by 1."
- **Proof summary** (6 rows): PROJECT, ROLE, PROOF TYPE, FROM, PAID, SOLSCAN (link)
- Single CTA: `> BACK TO PROFILE`

#### 8b. FAILURE
- Red X circle
- `TRANSACTION FAILED` eyebrow
- Headline: `Proof did not broadcast.`
- Sub: "Nothing was charged. The transaction either reverted on-chain or was rejected by your wallet. You can retry below."
- **Failure summary** (6 rows): PROJECT, FROM, ATTEMPTED, ERROR, `CHARGED: $0.00 · NOTHING SENT`, SOLSCAN (failed link)
- Two CTAs: `> RETRY PROOF` (jumps back to step 6 to re-confirm the quote) and `> BACK TO PROFILE`

**Backend questions:**
21. **Fail states to enumerate.** Wireframe shows a generic "INSUFFICIENT COMPUTE · BLOCKHASH EXPIRED" error. Real failure modes to handle distinctly:
    - user rejected signature in wallet
    - insufficient balance at signing time (race with eligibility)
    - blockhash expired (need rebuild)
    - tx reverted (on-chain error)
    - RPC/network error (transient, retry-safe) → `rpc_degraded` → copy: **"network busy — retry in a few seconds"**
    - quote expired after sign but before broadcast
    Each needs a specific user-facing copy. I'd like you to confirm which of these you can distinguish and propose error codes.
22. **Retry from failure.** Clicking `RETRY PROOF` should either re-use the existing quote if still valid, or silently re-issue eligibility + new quote. Which?
23. **Proof count update.** When a proof confirms, the operator's `proof_count` and potentially their tier need to tick up. Is this a synchronous DB update in the same transaction that writes the proof row, or an async event? The success screen says "the operator's count just ticked up by 1" — that's a lie if the update is eventually-consistent by more than ~1s.

---

## 4. Side states

### DISC — manual disconnect

Reachable from clicking the green conn-pill in the titlebar on any step 3–8.

**Flow:**
1. Click immediately flips `connected=false` (hard disconnect, no confirmation).
2. Routes to a dedicated screen:
   - Red disconnect icon
   - `SESSION ENDED` eyebrow
   - Headline: `Wallet disconnected.`
   - Sub: "Your wallet is no longer connected to LASTPROOF. This session has been terminated — no proof was created."
   - Summary rows: LAST WALLET, STATUS (`◉ DISCONNECTED` in red)
   - Two CTAs: `> BACK TO PROFILE` and `> RECONNECT & START OVER`
3. Bottom CTA row is hidden on this screen.

**Backend needs:**
- If the user disconnected **after** a quote was issued but **before** broadcast, the quote should be released immediately so the dev slot isn't frozen. See Q19 re: `/abandon`.

### INELIG — auto-disconnect (dev wallet failed)

Reachable only from step 5 when `path='dev'` and eligibility returns `eligible: false`.

Already specified in §5c above. Key point: **the disconnect is automatic and forced** — the user didn't ask for it, but we don't want an ineligible dev wallet sitting in a connected state because they'll just hit continue again. Break the session, make them pick a different wallet.

---

## 5. State machine summary

```
  ┌─────┐   continue   ┌─────┐   connect   ┌─────┐   continue   ┌─────┐
  │  1  │ ───────────▶ │  2  │ ──────────▶ │  3  │ ───────────▶ │  4  │
  └─────┘              └──┬──┘             └─────┘              └──┬──┘
                          │ ▲                                      │
                          │ │ try new wallet                       ▼
                          │ │                                   ┌─────┐
                          │ └──────────────────────────────────┤  5  │
                          │                                    └──┬──┘
                          │            ┌─ineligible (dev only)────┘
                          │            ▼                       │eligible
                          │        INELIG                      ▼
                          │      (auto-disc)                ┌─────┐
                          │                                 │  6  │
                          │                                 └──┬──┘
                          │                                    │verify this proof
                          │                                    ▼
                          │                                 ┌─────┐
                          │                                 │  7  │  (user signs)
                          │                                 └──┬──┘
                          │                              ┌─────┴─────┐
                          │                              ▼           ▼
                          │                           ┌─────┐     ┌─────┐
                          │                           │ 8ok │     │8fail│
                          │                           └─────┘     └──┬──┘
                          │                                          │ retry
                          │                                          └─▶ back to 6
                          │
                          │  any step (3-8) conn-pill click
                          └─▶ DISC
```

**FE call timing (locked with backend):**
- `/api/proof/eligibility` fires on the **step 2→3 transition** (right after wallet connect, while the user types a comment). Response is SSE-streamed so step 5's terminal log can animate off live events.
- If the ineligible response arrives while the user is still on step 3 or 4, FE short-circuits forward to step 5 in its failure state on continue (no wasted comment/token selection).
- `/eligibility` is the single source of wallet balances + prices — `/wallet-context` is folded in. No race window between displayed and enforced balance.

**Scaffold context:** public profile route shipped as Step A in commit range `73a9a29..8ff5008` on `main`. The `VERIFY THIS WORK` button in `src/components/profile/WorkItemCard.tsx` is a dead stub marked with `// TODO(proof-modal)` — grep trail for wire-up.

---

## 6. Consolidated backend questions (master list)

**Project + wire contract**
1. `work_item.project_token_mint` available at read time?
2. Canonical "currently at this project" field?
3. Supported wallet set unchanged (Phantom, Solflare, Jupiter, Binance)?
4. Are all four wallets now considered equal-tier for Solana Pay, or should we keep the unverified warning?

**Comment sanitization**
5. Server-side moderation/profanity layer?

**Wallet context + pricing**
6. ~~Existing wallet-context endpoint, or new one?~~ RESOLVED — folded into `/eligibility`.
7. Buy $LASTSHFT URL canonical (`lastshiftcoin.com/buy`)?
8. Insufficient-balance handling — pre-sign or post-sign?

**Eligibility (the critical path)**
9. Deployer detection source of truth + RPC provider + latency budget?
10. First-5 holder check definition?
11. Founder multisig check — real or aspirational?
12. Balance-to-token conversion done backend-side?
13. Quote TTL and refresh semantics?
14. Atomicity of dev-slot locking?

**Quote refresh**
15. Same `quote_id` on refresh or new one?
16. Quote expiration on review screen — re-run eligibility? RESOLVED — inline refresh.
16b. `/refresh` re-verifies eligibility at ≥45s stale. RESOLVED.

**Signing + broadcast**
17. Memo format?
18. Pure client-signed or backend co-signer?
19. Abandon endpoint for timeout/disconnect?
20. Idempotency on broadcast?

**Outcomes**
21. Enumerable failure codes with distinguishable copy?
22. Retry-from-failure quote reuse?
23. Proof count update — sync or async?

---

## 7. Non-negotiable rules (for the builder's reference)

- **One wallet, one proof, per project.** Ever.
- **One DEV proof per project.** Ever.
- **Proofs are permanent.** No edit, no delete, no refund.
- **LASTPROOF never custodies funds.** All payments go directly to the treasury wallet (env: `LASTSHFT_AR_WALLET`).
- **40% discount** when paying in `$LASTSHFT` — hardcoded, not tunable.
- **Dev-eligibility must be live on-chain** — no cached "dev wallet" lists, no off-chain claims, no trust-on-first-use. Every dev proof is re-verified against current mint state at proof time.
- **A failed dev-eligibility force-disconnects the wallet** so the user can't retry with a stale connected session.
- **The wireframe wins.** Any disagreement between this doc and `wireframes/lastproof-proof-modal.html` → wireframe is canon, this doc is wrong and needs updating.

---

## 8. What I need from you

A written response (or inline replies in this doc) to the 23 backend questions in §6, plus:
- **Capability gaps** — anything in this spec that's unbuildable or would require architectural changes on your side
- **Endpoint counter-proposals** — if my proposed request/response shapes don't fit the existing API style, rewrite them
- **Latency realities + check ordering** — especially for the eligibility check (§5). The ≤2.5s budget is almost certainly optimistic; I'd rather know which checks are fast vs slow so I can order the reveal sequence and decide whether to keep the single-shot response or switch to streaming (SSE/chunked). See the reworked latency sub-section in §5 for the specific questions.
- **Anything I've missed** — error states, race conditions, edge cases

Once I have your response, I'll update this doc, then implement the frontend against the finalized contract.

— Frontend
