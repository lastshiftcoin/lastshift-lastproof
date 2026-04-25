# Chad Function — Deployment Plan

**From:** Chad Builder (architecture pass)
**Date:** 2026-04-24
**Pairs with:** `COWORK-BRIEF.md`, `BUILDER-HANDOFF.md`, `FRONTEND-NOTES.md`

---

## The risk

LASTPROOF has ~5000 active profiles in production. The Chad Function
adds a new social graph layer touching every profile's public page,
dashboard, and onboarding flow. A bad deploy could:

- **Break the public profile page** — high traffic surface; operators
  paste cold links in DMs daily
- **Break the dashboard** — paid users land here every visit
- **Lock requests in flight** — API endpoints must land before any
  UI surface that calls them
- **Cache stampedes** — invalidating 5000 profile pages at once is a
  bad time

Strategy: **additive everywhere, gated by a feature flag, no
existing surface modified without a flag check.** Ship in three
deploys, not one.

---

## System architecture — before vs. after

### BEFORE (current production)

```
                         lastproof.app
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   /@<handle>            /manage              /dashboard
   (public)              (auth)               (auth, paid)
        │                     │                     │
        ├ ProfileHero         ├ Onboarding          ├ StatusBar
        ├ ShareIconButton     ├ Wallet auth         ├ IdentityCard
        ├ TrustTierBar        ├ TID flow            ├ Stat strips
        ├ ProfileTabs         └ Profile editor      ├ ProofsTable
        ├ ProofsTable                               └ Settings
        └ ...

       Database (Supabase):
       profiles · payments · proofs · quotes ·
       notifications · handle_history · work_items ·
       screenshots · profile_links · profile_categories
       (10 tables, all migrated to supabase mode)
```

### AFTER (chad function shipped)

```
                         lastproof.app
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   /@<handle>            /manage              /dashboard
   (public)              (auth)               (auth, paid)
        │                     │                     │
        ├ ProfileHero         ├ Onboarding          ├ StatusBar
        │  ├ ShareIconButton  ├ Wallet auth         ├ ChadManagementStrip ◄ NEW
        │  └ AddChadButton ◄ NEW                    ├ IdentityCard
        ├ TrustTierBar        └ Profile editor      ├ Stat strips
        ├ ChadArmyStrip   ◄ NEW                     ├ ProofsTable
        ├ ProfileTabs                               └ Settings
        ├ ProofsTable                                       │
        └ ...                                       /dashboard/chads ◄ NEW
                                                    (full mgmt page)
   /@<handle>/chads ◄ NEW
   (full public list)

       + AddChadModal (overlay, 10 phases, opens from AddChadButton)

       Database (Supabase):
       profiles · payments · proofs · quotes ·
       notifications · handle_history · work_items ·
       screenshots · profile_links · profile_categories ·
       chads ◄ NEW (wallet-pair primary key, additive)

       New API:
       /api/chads/eligibility · /request · /respond · /list · /remove
```

**Key property: every NEW component reads `CHADS_ENABLED`** before
rendering anything. When the flag is off, every chad surface returns
`null` — same DOM as today.

---

## The feature flag

One env var: **`CHADS_ENABLED`** (`true` | `false`, default `false`).

Gates EVERYTHING:

```
COMPONENT                          GATED BEHAVIOR
───────────────────────────────────────────────────────────
<AddChadButton />                  returns null
<ChadArmyStrip />                  returns null
<ChadManagementStrip />            returns null
<AddChadModal />                   returns null

API ROUTE                          GATED BEHAVIOR
───────────────────────────────────────────────────────────
/api/chads/eligibility             404
/api/chads/request                 404
/api/chads/respond                 404
/api/chads/list                    404
/api/chads/remove                  404

PAGE ROUTE                         GATED BEHAVIOR
───────────────────────────────────────────────────────────
/@<handle>/chads                   404 (notFound())
/dashboard/chads                   404 (notFound())
```

When `CHADS_ENABLED=false`, production renders **byte-identical** to
the pre-chad world. No DOM diff, no API surface, no orphan routes.

---

## Three-stage deploy timeline

```
Day 0                Day 1                Day 2                 Day 3
  │                    │                    │                     │
  ▼                    ▼                    ▼                     ▼
─── DEPLOY 1 ─────── DEPLOY 2 ─────── DEPLOY 3 (LAUNCH) ─── STEADY STATE
   schema only         all code,           flag flips on,        ↓
   (invisible)         flag OFF            VERSION bump,         monitor
                       (dark)              [update: added]       24h before
                                                                 declaring done
```

### Deploy 1 — schema (Day 0)

Lands a single Supabase migration. **No code change. No UI change.
Zero risk to existing surfaces.**

The shipped migration is `supabase/migrations/0021_chads.sql`:

```sql
create table if not exists chads (
  id                 bigserial primary key,
  requester_wallet   text not null,
  target_wallet      text not null,
  status             text not null check (status in ('pending', 'accepted')),
  created_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  unique (requester_wallet, target_wallet),
  check (requester_wallet <> target_wallet)
);

create index if not exists chads_target_status_idx
  on chads (target_wallet, status);

create index if not exists chads_requester_status_idx
  on chads (requester_wallet, status);

alter table chads enable row level security;
```

(Wallet columns follow the project's existing `<role>_wallet`
convention from operators / proofs / quotes. RLS deny-all for anon
is the default once enabled — no policies declared because all
writes go through service-role API routes.)

**Migrations are NOT auto-applied by Vercel deploys.** Per
`supabase/README.md`, apply via one of:
- `supabase db push` (CLI; recommended)
- Paste the SQL into the Supabase dashboard SQL Editor
- Raw psql against the prod URL

Apply between landing the file in the repo (this commit) and
landing Deploy 2 (the first code that reads from the table).

Commit subject: `chads: schema migration — chads table + indexes`
(no `[update:]` prefix — schema-only, no user-visible surface).

**Why first:** schema lands without risk. Adapter can be tested
against it before any UI calls it. Rollback = `drop table chads`.

### Deploy 2 — all code, flag OFF (Day 1)

Lands every line of code: adapter, API routes, components, page
routes, modal, dashboard wiring. **`CHADS_ENABLED=false` in
production.** Every gated surface returns null/404.

```
src/lib/db/chads-adapter.ts                       NEW
src/lib/chads/resolve-phase.ts                    NEW
src/lib/chads/feature-flag.ts                     NEW (reads env)
src/app/api/chads/eligibility/route.ts            NEW
src/app/api/chads/request/route.ts                NEW
src/app/api/chads/respond/route.ts                NEW
src/app/api/chads/list/route.ts                   NEW
src/app/api/chads/remove/route.ts                 NEW
src/app/(marketing)/profile/[handle]/chads/page.tsx  NEW
src/app/(marketing)/manage/chads/page.tsx         NEW
src/components/chad/ChadAvatar.tsx                NEW
src/components/chad/ChadCard.tsx                  NEW
src/components/chad/ChadArmyStrip.tsx             NEW
src/components/chad/ChadManagementStrip.tsx       NEW
src/components/chad/AddChadButton.tsx             NEW
src/components/chad/AddChadModal.tsx              NEW
src/components/chad/InfiniteChadList.tsx          NEW
src/components/chad/ChadEmptyState.tsx            NEW
src/app/globals.css                               EDIT (token additions only)
src/components/profile/ProfileHero.tsx            EDIT (mounts <AddChadButton />, gated)
src/app/(marketing)/profile/[handle]/page.tsx     EDIT (mounts <ChadArmyStrip />, gated)
src/components/dashboard/DashboardContent.tsx     EDIT (mounts <ChadManagementStrip />, gated)
next.config.ts                                    EDIT (rewrite for /@:handle/chads)
```

Commit subject: `chads: code + UI behind CHADS_ENABLED flag`
(no `[update:]` prefix — flag is OFF, no user-visible behavior yet).

**Verification with flag still OFF:**
- Hit `/@<my-test-handle>` — page renders identically to today
- Hit `/api/chads/eligibility?target=<anything>` — returns 404
- Hit `/dashboard` — strip absent, dashboard pixel-identical
- Lighthouse, Core Web Vitals — should be unchanged

**Verification with flag flipped ON for one wallet (testing path):**
The feature-flag helper supports per-wallet override via env:
`CHADS_ENABLED_WALLETS=<comma,sep,list>`. Lets you test the live
feature against your own wallet on production without exposing it
to anyone else. Same pattern as the existing TEST wallet seed in
CLAUDE.md.

### Deploy 3 — flag ON, launch (Day 2)

Two-line commit: flips `CHADS_ENABLED=true` in Vercel env, bumps
VERSION + adds `data/updates.json` entry per § Updates feed.

```
VERSION                 0.11.3 → 0.12.0  (minor bump for "added")
data/updates.json       new entry, latest_version updated
```

Commit subject: `[update: added] chads — connect with other operators`

That's the user-visible ship. The actual code that delivers the
feature was already in production in Deploy 2.

**Why this sequence:**
- The flag flip is the smallest, lowest-risk commit possible
- All real risk (broken queries, slow renders, cache stampedes) was
  surfaced during Deploy 2 verification with the flag still OFF
- Rollback if something breaks at launch = flip the env var to
  `false`, no redeploy needed (Vercel reads env at request time for
  edge functions; for SSG pages you'd need a redeploy — see below)

---

## Cache invalidation map

The public profile page (`/@<handle>`) is server-rendered with ISR.
Adding a chad to someone's army needs to invalidate their cached
profile so the new avatar appears.

```
ACTION                     INVALIDATES                              MECHANISM
──────────────────────────────────────────────────────────────────────────────
chad request sent     ──►  (none — pending requests aren't public)

chad accepted         ──►  profile:<requester_handle>               revalidateTag()
                           profile:<target_handle>                  revalidateTag()

chad denied           ──►  (none — no public surface change)

chad removed          ──►  profile:<a_handle>                       revalidateTag()
                           profile:<b_handle>                       revalidateTag()

profile goes free     ──►  profile:<handle>                         revalidateTag()
                           profile:<each_chad_handle>               revalidateTag() loop
                                                                    (≤ army size)

profile reactivates   ──►  profile:<handle>                         revalidateTag()
                           profile:<each_chad_handle>               revalidateTag() loop
```

**The 5000-profile concern:** the only loop above is "each chad of
the operator" — typically tens of handles, not thousands. No
all-profiles invalidation in any path.

**Random ordering caveat:** `chads` query for the public army strip
is shuffled per-request. Two options:

- **(A) Bypass cache for the strip** — render the profile body from
  ISR but fetch the army strip client-side. Lose initial-paint
  avatars but stay fully cached on body.
- **(B) Cache the unshuffled list, shuffle in the component** —
  ISR-cache the avatar identities, shuffle their render order in
  the React render. Cheap, no cache pressure.

Going with **(B)**. Order changes per render but the underlying
list is cache-friendly.

---

## Rollback playbook

```
SYMPTOM                              ROLLBACK ACTION
───────────────────────────────────────────────────────────────────────
"Chad button breaks the public      Set CHADS_ENABLED=false in
profile page"                       Vercel env. Triggers redeploy
                                    (~30s). All chad UI vanishes.
                                    Existing chad relationships
                                    remain in DB unharmed.

"Chad requests are persisting       Set CHADS_ENABLED=false (above).
but failing on accept"              On next deploy attempt, reproduce
                                    locally with prod schema dump.

"Schema migration causes lock"      drop table chads cascade;
(extremely unlikely — additive       Lock would only happen if Postgres
table on a fresh table)              were already locked when migration
                                    ran. Mitigated by Deploy 1 being
                                    schema-only (low traffic window).
```

**Schema rollback safety:** the `chads` table is leaf-only —
nothing in `profiles` references it, no dependents elsewhere.
Drop is safe.

---

## Testing protocol on production

Per CLAUDE.md § Terminal bridge, the seed test wallet is
`TEST1111111111111111111111111111111111111111`. Same pattern works
for chads:

```
PHASE                       HOW TO VERIFY
─────────────────────────────────────────────────────────────────
After Deploy 1              Hit Supabase dashboard — chads table
(schema only)               exists, indexes present, empty.
                            No code path touches it.

After Deploy 2              CHADS_ENABLED_WALLETS=<my-wallet>
(code shipped, flag off)    flips the feature on for one wallet.
                            Walk all 10 modal phases against
                            test profiles.
                            Send a real chad request from your
                            wallet to a TEST_2 wallet, accept it,
                            view armies.

                            Then unset CHADS_ENABLED_WALLETS,
                            reverify the public profile renders
                            byte-identical to pre-chad.

After Deploy 3              Monitor for 24h:
(flag on, launched)         - Error rate on /api/chads/*
                            - p95 latency on /@<handle> rendering
                              (should be unchanged — strip is
                              additive, not blocking)
                            - Notification queue depth
                            - DB connection pool

                            If any signal drifts: flip flag off.
```

---

## Why three deploys instead of one

A naive "one big PR, ship everything at once" approach has every
risk land in one window:

- Schema migration runs against a live DB while UI tries to read
  from it → race condition possible
- Bug in adapter exposes itself the same minute the UI surface goes
  live → no triage time
- Cache invalidation tested only at launch → cache stampede risk
- Rollback = revert + redeploy + DB rollback (3+ minutes minimum,
  user-facing damage in that window)

Three deploys decouples each risk:

```
DEPLOY 1 RISK     just schema — no code reads it yet
DEPLOY 2 RISK     code lands but flag-gated; bugs surface in
                  CHADS_ENABLED_WALLETS testing, not at launch
DEPLOY 3 RISK     just an env var flip; rollback is one click
```

Total elapsed: 3 days minimum (could be hours if you're confident,
but the value of the gap is in monitoring between deploys).

---

## Open questions for coordinator

1. **Launch date target?** No external dependency, so any date
   works once Deploy 2 verification passes. Worth picking before
   Deploy 1 to set monitoring expectations.
2. **Soft-launch vs hard-launch?** The current plan flips the flag
   globally for all 5000 profiles in Deploy 3. Could instead use
   `CHADS_ENABLED_WALLETS` as a percentage rollout (10% → 50% →
   100%) over a few days. More cautious, more chat overhead. My
   default: hard-launch since the feature is opt-in (visitors must
   click `+ ADD CHAD` to engage).
---

## TL;DR

```
ADDITIVE EVERYWHERE
   ↓
SCHEMA FIRST (separate deploy, zero UI risk)
   ↓
CODE WITH FLAG OFF (bake-time, dark-test on real prod)
   ↓
FLAG FLIP (one-line ship commit, instant rollback)
   ↓
WATCH 24H BEFORE DECLARING DONE
```

Five thousand active profiles see byte-identical pages until the
flag flips. The flag flip is reversible in seconds.
