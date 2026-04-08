# LASTPROOF — architectural source of truth

This file is the top-level architectural anchor for the LASTPROOF codebase.
It exists to stop drift between the plan, the wireframes, and the code.

**Visual + functional canon lives in the wireframes** (`wireframes/*.html`).
They were designed with the builder down to the last detail. When the plan,
this doc, or any code disagrees with the wireframes, **the wireframes win**.

For the full per-screen mapping (which wireframe → which route, with all
the design-token and tier details spelled out) see:

  → `LASTPROOF-BUILDER-HANDOFF.md`

That doc is the companion to this one. Read both.

---

## Tier system (locked to wireframes)

**Four tiers, pure proof count, no gates.** The old T5/T1–T4 split from
the original plan file is **dead** — replaced by the wireframe-canonical
system below.

| Tier   | Name        | Proof threshold | Color  |
|--------|-------------|-----------------|--------|
| TIER 1 | NEW         | 0+              | silver `#9ca3af` |
| TIER 2 | VERIFIED    | 10+             | bronze `#cd7f32` |
| TIER 3 | EXPERIENCED | 25+             | gold `#ffd700`   |
| TIER 4 | LEGEND      | 50+             | purple `#a78bfa` |

Rules:
- Thresholds are **on-chain minted proofs**, nothing else. No age gates,
  no dispute gates, no activity gates.
- Tier is recomputed live on each confirmed proof and cached on
  `profiles.tier`. Source of truth: `src/lib/tier.ts` → `computeTier()`.
- **Tier number is never shown alone.** Always paired with its word name
  via `·`: `TIER 1 · NEW`, `TIER 2 · VERIFIED`, `TIER 3 · EXPERIENCED`,
  `TIER 4 · LEGEND`.
- Never use green for a tier label (reserved for DEV badge, verified
  state, and money). Never use orange (brand accent only).
- **Free profiles have no tier section at all.** They render the
  `lastproof-profile-free.html` variant, which strips the tier bar, the
  hire button, and the verified section. Free = not paid AND/OR not
  published. Handled by route-level variant selection, not by giving
  them a fifth tier value.

### Internal T5 sentinel
`computeTier()` still returns `5` for unpaid/unpublished profiles so
callers can cheaply check "on the ladder or not." `5` is never rendered
as a word — the free-variant wireframe branches on it before any tier
UI is generated. Treat it as `null` conceptually; the numeric value is
only for backwards compatibility with the existing `profiles.tier`
column.

---

## Store architecture (Phase 3 — complete)

All six stores run on Supabase (as of 2026-04-08):

| Store             | Mode     | Adapter                              |
|-------------------|----------|--------------------------------------|
| profiles          | supabase | `src/lib/db/profiles-adapter.ts`     |
| payments          | supabase | `src/lib/db/payments-adapter.ts`     |
| quotes            | supabase | `src/lib/db/quotes-adapter.ts`       |
| proofs            | supabase | `src/lib/db/proofs-adapter.ts`       |
| notifications     | supabase | `src/lib/db/notifications-adapter.ts`|
| handle_history    | supabase | `src/lib/db/handle-history-adapter.ts`|

Each store has three modes (`memory` | `dual` | `supabase`) selected by
`LASTPROOF_DB_<STORE>` env. The dispatch lives in `src/lib/db/mode.ts`.
Memory is now just a passive local cache on sync insert paths; reads
all go through the adapter.

Stores that do **not** yet exist (needed for the public profile page):

- `work_items` — schema exists, no store/adapter
- `screenshots` — schema exists, no store/adapter
- `profile_links` — schema exists, no store/adapter
- `profile_categories` (+ `categories` lookup) — schema exists, no
  store/adapter

These need to be built using the same memory|dual|supabase pattern
before the public profile route can read real data.

---

## Terminal bridge

- Real Terminal: `https://lastshift.app` (prod), `https://staging.lastshift.app`
  (staging), `http://localhost:3000` (dev).
- Local mock: `src/app/api/mock/terminal/*` — rewritten 2026-04-08 to
  match the real Terminal byte-for-byte. Proven by
  `scripts/terminal-bridge-smoke.ts` (10/10 green against both).
- S2S auth: `Authorization: Bearer ${INTER_TOOL_API_SECRET}` +
  `X-LastShift-Key-Id: v1`.
- Seed row for testing: wallet `TEST1111111111111111111111111111111111111111`,
  TID `SHIFT-TEST-0001-0001-0001`.

---

## Priorities

Wireframes drive implementation order. Current priority (set by user,
2026-04-08):

1. **Public profile** (`lastproof-profile-public.html`) — the artifact
   operators paste into 100 DMs a day. Shareable cold link, no auth.
2. **Proof flow** — the "VERIFY THIS WORK" modal on public profiles.
   **Higher stakes than payments**: a fake dev verification poisons
   the trust system. Token-dev qualification gate in
   `lib/token-dev-verify.ts` is the single most important piece of
   logic in the app.
3. **Onboarding + MVP dashboard** — claim handle, add 1–3 work items,
   publish.
4. **Subscription payments** — rollover, countdown, stripe-down.
5. **Full dashboard polish** — screenshots, links, categories.
6. **Grid** — discovery layer. Launches 2026-05-08 per `GRID_LAUNCH_DATE`.
7. **SHIFTBOT** — search over the populated Grid.

Grid is the network effect. The profile + proof loop is the atomic
unit. Atomic unit ships first.

---

## Stale docs to ignore
- The top-level "Final Plan" markdown in `~/.claude/plans/` — superseded
  by the wireframes for anything UI-related, and superseded by this
  doc + `LASTPROOF-BUILDER-HANDOFF.md` for tier definitions.
