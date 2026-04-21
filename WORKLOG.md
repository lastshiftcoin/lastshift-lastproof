# LASTPROOF — Work Log

Perpetual, append-only session log. **Newest entry at the top.** Every Claude
session touching this repo reads the top of this file before work, and writes a
new entry at the top when a work block ships. See `CLAUDE.md § Session protocol`
for the rules.

When this file exceeds ~500 lines, roll the oldest half into
`WORKLOG-ARCHIVE.md` and keep only the recent entries here.

---

## 2026-04-20 19:19 MST — Ambassador referral attribution: fix, observability, mobile fix

**Device:** Tallada's MacBook Air (`Talladas-MacBook-Air.local`, macOS 26.4.1 arm64)
**Platform:** Claude Desktop / Claude Code (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`)
**Model:** claude-opus-4-6
**Commits:** `67fc011`, `adca9f1`, `d04e9e9`
**Migrations run in prod Supabase:** 0017, 0018, 0019, 0020
**Status:** ✅ shipped, verified in prod, street team can drive traffic

### Did

- Diagnosed zero-attribution bug. All 12 `ea_claimed` profiles had
  `referred_by = NULL`. Root causes:
  1. `cookies().set()` from a Next 16 Server Component page render is a
     silent no-op (only legal in Server Actions, Route Handlers, Middleware),
     so `lp_ref` cookie was never actually written at `/manage`.
  2. `?ref=` URL param only survived in the client URL — any refresh or
     navigation dropped it before `/api/campaign/claim` was called.
- Moved attribution write **server-side** to the first authenticated call.
  New column `operators.referred_by` stamped on insert in
  `/api/auth/register-tid` and on first-touch update in `/api/auth/wallet-gate`.
  `/api/campaign/claim` now reads from `operators.referred_by` as primary,
  falls back to the legacy body/cookie paths for in-flight pre-fix sessions.
- Added `referral_events` table + `referral_funnel_daily` view for
  end-to-end observability. Event types: `landing_visit`, `wallet_gate`,
  `register_tid`, `campaign_claim`, `attribution_drop`. Source + outcome
  captured on each row.
- Observability paid off same day — caught @coreops mobile regression within
  hours: Phantom mobile wallet deep-link return strips `?ref=` on its way
  back to `/manage`, so the second auth POST went out with `incomingRef=null`.
- Fixed mobile roundtrip with `localStorage.lp_ref_slug` stash in
  `ManageTerminal.tsx`. Not a cookie: never auto-sent to the server,
  origin-scoped, read inline before each auth POST. Survives wallet-app
  deep-link returns on iOS + Android.
- Backfilled @parallell and @coreops → `free-early-access` (@TheLeadOps)
  via migrations 0018 and 0020.
- Deleted `jessicakol` test account (wallet `7jEE978Q…`) completely —
  cascade delete via `operators` row. Wallet is free to re-register.

### Current state

- @TheLeadOps: **2** attributed (parallell ea#12, coreops ea#13)
- Other 5 ambassadors: 0 attributed — street team hasn't driven traffic yet
- 4 pre-fix paid profiles (`vibecoderchris`, `bossvito`, `cozy`, `cipherwave`)
  confirmed by user to **not** be street team referrals — staying `NULL` is
  correct behavior
- Observability live and firing

### Open / next

- Watch next 48h of real street-team traffic. First fresh mobile signup via
  an ambassador URL should attribute cleanly end-to-end (no manual backfill).
- Decide on **Level 2 observability** (server-issued visit tokens that link
  a `landing_visit` event to a specific wallet when it later authenticates).
  Defer until Level 1 event data shows whether it's needed.
- Admin dashboard page `/admin/referrals` (Level 3). Nice to have, defer.

### Gotchas for next session

- **Supabase project:** `ufcpctzjmlhkboxofeml` (production). Service role
  key lives in `.env.local` for local queries.
- **Vercel project:** `lastshift/lastshift-lastproof`. Auto-deploys on
  push to `main`. Build time ~31s.
- **GitHub:** `lastshiftcoin/lastshift-lastproof`.
- **SQL policy:** user runs all SQL manually via the Supabase SQL Editor.
  Never psql from code. Script the SQL, present the block, wait for the
  user to paste back output.
- **Migration numbering:** last applied is `0020`. Check
  `supabase/migrations/` before picking the next number — the directory
  is dense.
- **Mobile wallet return strips query params** — any future work that
  relies on `?ref=` or any query state surviving a Phantom/Solflare
  deep-link return will hit the same bug we just fixed. Use
  `localStorage` or a server-side token, not the URL.
- **Next 16 Server Component cookies:** `cookies().set()` silently
  no-ops in a page render. Only mutate cookies from a Route Handler,
  Server Action, or Middleware.

---

## Template — copy this block when adding a new entry

How to fill each line at session-end:

| Field | How to get it |
|---|---|
| Date + time | `date "+%Y-%m-%d %H:%M %Z"` |
| Device | `scutil --get ComputerName` (plus hostname, macOS version if you like) |
| Platform | `echo $CLAUDE_CODE_ENTRYPOINT` (values seen so far: `claude-desktop` = Claude Desktop app, `claude-cli` = terminal CLI, `cowork` = Claude Cowork). Also note parent app via `__CFBundleIdentifier` if the entrypoint is ambiguous. |
| Model | `echo $DEFAULT_LLM_MODEL` |
| Commits | `git log --oneline <last-entry-sha>..HEAD` |
| Migrations | any `.sql` under `supabase/migrations/` that the user ran in Supabase SQL Editor during this session |
| Status | ✅ shipped, 🟡 in-flight, ❌ blocked |

```
## YYYY-MM-DD HH:MM TZ — <short title>

**Device:** <ComputerName> (`<hostname>`, <os + arch>)
**Platform:** <Claude Desktop / Claude Code / Claude Cowork> (`CLAUDE_CODE_ENTRYPOINT=<value>`)
**Model:** <model name>
**Commits:** `<sha>` [, `<sha>` …]
**Migrations run in prod Supabase:** <list or "none">
**Status:** ✅ | 🟡 | ❌

### Did
- …

### Current state
- …

### Open / next
- …

### Gotchas for next session
- …
```
