# BACKEND → GRID session handoff

**From:** backend session
**To:** whoever picks up the Grid session
**Date:** 2026-04-23
**Repo:** `/Volumes/LASTSHIFT/lastproof-build` (external drive, not iCloud; GitHub is authoritative remote)

---

## My role and the lens I'm writing from

I'm the backend session. I own Supabase queries, API routes, env vars,
session/auth cookies, the proof verification pipeline, ambassador
attribution, and server-side observability.

I do **NOT** own: UI, wireframes, ranking UX, search ergonomics,
SHIFTBOT. Treat everything below as *"what the data and infrastructure
look like on launch day"* — not what the screen should do with it.

If you need UI/UX context for the Grid, talk to the frontend or
fullstack session separately. They'll have opinions I explicitly don't.

---

## What the Grid is, per the source of truth

From `CLAUDE.md § Priorities`:

> 6. **Grid** — discovery layer. Launches **2026-05-08** per `GRID_LAUNCH_DATE`.
> 7. **SHIFTBOT** — search over the populated Grid.
>
> Grid is the network effect. The profile + proof loop is the atomic
> unit. Atomic unit ships first.

Launch date is pinned to the `GRID_LAUNCH_DATE` env var, set in
production.

---

## Current state on disk

- **`/grid` route exists** at `src/app/grid/page.tsx` as a **locked
  boot-screen placeholder** — terminal-aesthetic "GRID // LOCKED" page,
  no data. Mirrors `wireframes/scan-grid-locked.html`. I did not write
  this; it's been there for weeks. Frontend owns the unlock visual.
- **`/grid` is in the sitemap** (I added it 2026-04-21, priority 0.6,
  weekly changefreq). When you flip the unlock, Google already knows
  the URL.
- **`robots.txt` permits `/grid`.** No crawl blocker to untangle.

---

## Data the Grid will read from (backend perspective)

All in Supabase. Store architecture from
`CLAUDE.md § Store architecture (Phase 3 — complete)`:

| Store                | Adapter                                      | What's there                                     |
|----------------------|----------------------------------------------|--------------------------------------------------|
| `profiles`           | `src/lib/db/profiles-adapter.ts`             | 14 rows today, all paid + published (2026-04-21) |
| `proofs`             | `src/lib/db/proofs-adapter.ts`               | On-chain verified proofs per profile             |
| `work_items`         | `src/lib/db/work-items-adapter.ts`           | Portfolio entries per profile                    |
| `profile_categories` | `src/lib/db/profile-categories-adapter.ts`   | Category tags per profile                        |
| `profile_links`      | `src/lib/db/profile-links-adapter.ts`        | External links                                   |
| `screenshots`        | `src/lib/db/screenshots-adapter.ts`          | Portfolio images                                 |

**Key derived signals already available:**

- **Tier (1–4)** cached on `profiles.tier`, computed from
  `proofs_confirmed` count per `src/lib/tier.ts` → `computeTier()`.
  `5` is an internal sentinel for unpaid/unpublished ("not on the
  ladder") — never render as a tier.
- **`is_paid`** boolean on `profiles`
- **`published_at`** timestamp — canonical "published" signal (NOT
  `is_published`; that column does not exist, and I got bitten by
  assuming it did during the sitemap fix)
- **`profiles.tier`** is the canonical tier signal — read from the
  column, don't recompute on the Grid path
- **`referred_by`** on `operators` — ambassador attribution
  (first-touch wins policy)
- **View count** via `incrementViewCount(handle)` in `profiles-adapter.ts`

**The `PublicProfileView` projector** at
`src/lib/projector/public-profile.ts` assembles everything the public
profile page renders. Good reference if the Grid needs a per-profile
summary card: same inputs, subset output. Don't duplicate — if you
need a `GridCardView` shape, extend or write alongside rather than
re-implementing the fan-out.

---

## Auth / session posture relevant to you

- `lp_session` cookie, HMAC-signed, 12h TTL (`src/lib/session.ts`)
- `lp_ref` cookie (30d, HttpOnly) for ambassador attribution — set by
  `src/proxy.ts` (Next 16; `middleware.ts` is deprecated → `proxy.ts`,
  function name is `proxy`)
- The Grid is presumably public (no auth required for browsing). If
  you need per-viewer personalization (e.g. *"you're logged in,
  here's a Hire button on each card"*), `readSession()` from
  `src/lib/session.ts` is your entry point. Returns `null` for
  anonymous viewers.

---

## Env vars you may touch

Production secrets are stored with strict access controls — if you
need a value locally, pull it from the upstream provider, not from
the Vercel dashboard. Relevant ones the Grid might read:

- `GRID_LAUNCH_DATE` — the unlock pin
- `SUPABASE_SERVICE_ROLE_KEY` — backend DB access via
  `supabaseService()` client in `src/lib/db/client.ts`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` —
  RLS-gated reads if you go client-side

**Hard rule inherited from prior sessions:** all SQL runs manually via
the Supabase SQL Editor. Never psql from code. If you need a migration,
write the SQL, present the block, wait for Kellen to paste back output.

---

## Observability in place

- `referral_events` table logs every attribution decision. Not
  directly Grid-related, but if the Grid ever shows *"referred by
  @ambassador"* chips or ambassador-segmented views, that's the data
  source. See `src/lib/referral-events.ts`.
- `debug_events` table has `category='x_auth'` and `category='tg_auth'`
  from earlier work. Not Grid-relevant; mentioning so you don't
  duplicate.

---

## Things I do NOT know and will not speculate on

- **How profiles rank on the Grid.** Tier? Proof count? Recency? View
  count? Manual curation? Product + UX call, not mine.
- **What search/filter UX looks like.** SHIFTBOT is priority 7; I have
  zero context on its architecture.
- **Whether the Grid is paginated, infinite-scroll, or paged.**
  Frontend's call.
- **Whether free/unpaid profiles surface at all.** Currently the
  sitemap and JSON-LD only emit for paid+published. Grid policy is
  TBD.
- **Whether you need new tables or existing data is enough.** Start by
  composing from existing stores — that's the pattern that's worked
  for the profile page, sitemap, and admin metrics. Add tables only
  if existing joins can't express what the Grid needs.

---

## Protocol you'll inherit

Read in this order **before you touch anything**:

1. `WORKLOG.md` — top 3 entries (newest first, append-only)
2. `CLAUDE.md § Session protocol` — multi-session rules, rebase-before-
   push, no blind commits, broken-git-state discipline
3. `CLAUDE.md § Updates feed — commit convention` — when and how to
   bump `VERSION` + `data/updates.json`
4. `CLAUDE.md § Priorities` — for the tier system and
   *"profile + proof loop is atomic"* stance

Declare your role as `grid` (task-specific session, not one of the
four persistent roles — frontend/backend/fullstack/coordinator). Stamp
`**Role:** grid` on every WORKLOG entry you write.

---

## Gotchas specifically worth internalizing

1. **Next 16 Server Component cookies silently no-op.** If you set a
   cookie from a `page.tsx`, it doesn't get written. Use Route
   Handlers, Server Actions, or `src/proxy.ts`.
2. **`published_at IS NOT NULL` is the canonical "published" signal.**
   Not `is_published` (doesn't exist). Not `is_public` (doesn't exist
   either).
3. **Don't guess on "is this var sensitive?"** — if you need a
   production value locally, regenerate at the upstream provider
   rather than trying to pull from Vercel.
4. **SQL migrations are user-driven.** Script it, present it, wait.
5. **The drive is the only local source of truth.**
   `/Volumes/LASTSHIFT/lastproof-build`. No iCloud copies. Don't edit
   outside the drive.
6. **Profile variants matter.** `public`, `legend`, `free` — driven
   by tier + paid + published. If the Grid shows all three
   differently (e.g. free profiles de-emphasized), the variant is
   already computed on the `PublicProfileView`. Don't re-derive.

---

## Where to ask

- **Data model questions:** ping me (backend) — I know the schema
- **UI/visual:** ping frontend
- **Full feature architecture:** ping fullstack
- **Cross-cutting product decisions:** coordinator

---

Good luck. The atomic unit is already shipping; the network effect is
yours to build on top of it.

— backend
