# FRONTEND → GRID handoff

**From:** Frontend session (LASTPROOF, 2026-04-23)
**To:** Next session that builds out the Grid
**Scope:** Everything I can tell you about the Grid from a frontend lens, explicitly without crossing into backend/fullstack territory

Welcome. You're about to work on the most-anticipated surface in the
product — the Grid. Before you touch anything, this document captures
what I know firsthand vs what I'm observing from the outside, so you
don't burn cycles on assumptions.

---

## Role suggestion

Declare yourself **`grid`** — task-specific session per
`CLAUDE.md § Task-specific sessions`. Stamp `**Role:** grid` on every
WORKLOG entry. Don't claim `frontend` (persistent specialist, in use)
or `coordinator`.

---

## What the Grid IS (user-facing, what I can see)

From `CLAUDE.md § Priorities`:

- Priority 6, launches **2026-05-08** per `GRID_LAUNCH_DATE` constant
- Lives at `lastproof.app/grid`
- Described as: *"discovery layer. Launches 2026-05-08. Grid is the
  network effect. The profile + proof loop is the atomic unit. Atomic
  unit ships first."*

From working across the marketing surface:

- Currently `lastproof.app/grid` renders a **coming-soon /
  scan-grid-locked** page (wireframe:
  `wireframes/scan-grid-locked.html`). The real Grid replaces this
  on 2026-05-08.
- Footer across both marketing + dashboard already links to `/grid`
- Homepage `RESHUFFLE` button + profile card clicks route to `/grid`
- How-it-works and help page reference the Grid extensively — these
  references need to keep working when the real page lands
- Blog articles link to `/grid` in body copy
- Ambassador campaign landing pages CTA to `/grid`

---

## What the Grid WILL BE (from wireframes + how-it-works explainer copy)

User-facing pieces I've seen referenced but haven't built:

- Operator cards with: avatar, handle, tier badge, proof count, DEV
  badge count, categories, fee tier ($/$$/$$$), activity recency
- Filter rail: Category, Tier, Fee, DEV badges, Activity
- Sort controls (by DEV count, tier, recency)
- SHIFTBOT query bar (AI-ranked shortlist from natural-language brief)
- HIRE button on each card → opens Telegram DM to the operator

**Most complete UX spec in the codebase:**
`src/app/(marketing)/how-it-works/page.tsx` — scroll to the DEV pane's
"THE GRID" section. Marketing copy, but also the most detailed Grid
UX description available.

---

## Design canon — non-negotiable

### Tier colors (CLAUDE.md § Tier system)

| Tier | Name        | Threshold  | Color                 |
|------|-------------|------------|-----------------------|
| 1    | NEW         | 0+ proofs  | silver `#9ca3af`      |
| 2    | VERIFIED    | 10+ proofs | bronze `#cd7f32`      |
| 3    | EXPERIENCED | 25+ proofs | gold `#ffd700`        |
| 4    | LEGEND      | 50+ proofs | purple `#a78bfa`      |

- **Never use green or orange for a tier label.** Green is reserved
  for DEV badge / verified state / money. Orange is brand accent.
- **Never render the tier number alone** — always as
  `TIER N · NAME` via `formatTierLabel()` in `src/lib/tier.ts`.
- Free profiles return tier `5` (internal sentinel) and should NOT
  appear on the Grid. `deriveProfileVariant()` in `tier.ts` resolves
  this — use it, don't reinvent it.

### Boot-line / terminal-console color rule

Consistent across all /manage phases as of `6db1a44`:

- `green` = success confirmations
- `accent` (orange) = in-progress / prompts
- `red` = failure / error
- grey (no class) = ambient system info

Applies to anything terminal-flavored on the Grid too.

### Platform tokens (`src/app/globals.css`)

```
--bg-primary: #0a0b0f
--bg-secondary: #12131a
--bg-card: #161822
--border: #1e2030 / --border-2: #2a2d42
--text-primary: #e2e4ed / --text-secondary: #8b8fa3 / --text-dim: #5a5e73
--orange (brand) / --green / --gold (T3 only) / --purple (T4 only)
--silver (T1) / --bronze (T2) / --blue (links)
--mono: "JetBrains Mono" / --sans: Inter
--r-sm 3px / --r-btn 6px / --r-card 10px / --r-pill 4px
```

---

## Existing frontend patterns to reuse (don't reinvent)

- **`src/components/ResultCard.tsx`** — profile result card used on
  the homepage shuffle. Starting point for Grid cards. The
  `.result-tier.t1/t2/t3/t4` classes in `globals.css` already exist.
- **Profile public page**
  (`src/app/(marketing)/profile/[handle]/page.tsx` +
  `profile-public.css`) — for verified badge, DEV badge, tier bar,
  fee pill, HIRE button styling. Grid cards should look like
  mini-profile-public cards for visual continuity.
- **Topbar + Footer + InAppBanner + ShiftbotStrip** — all inherited
  from `(marketing)/layout.tsx`. If Grid lives under
  `(marketing)/grid/`, you get them for free. Don't edit the layout.
- **Updates feed convention** — applies to anything user-visible.
  Prefix commit `[update: added]` (minor VERSION bump) when the Grid
  ships. Read `git show origin/main:data/updates.json` BEFORE editing
  — see Gotchas in the 2026-04-22 12:41 MST WORKLOG entry, the
  mistake cost 8 entries the first time.

---

## Integration points I can see but don't own

These cross into backend/fullstack. **Ask or wait — don't guess.**

1. **Grid data source.** I don't know how Grid retrieves the operator
   list. Could be a server component reading Supabase directly, could
   be an API route, could be cached. Ask backend, or read
   `src/app/(marketing)/grid/page.tsx` when it exists.
2. **SHIFTBOT ranking logic.** Natural-language brief → ranked
   shortlist is backend/fullstack work. Frontend just renders the
   response.
3. **Pagination / infinite scroll / search indexing.** Backend
   decision. I know nothing.
4. **Real-time proof count propagation.** Proofs land via Helius
   webhook → `payment-events.ts` → `recalcProfileTier()` → profile
   row. Whether the Grid sees fresh counts on every request or on a
   cache TTL, I don't know.
5. **HIRE button telemetry.** If we're tracking clicks (for
   ambassador attribution or otherwise), that's wired server-side.
6. **Filter/sort implementation.** Could be client-side filtering of
   a server-fetched list, could be URL-param-driven server re-renders,
   could be a Grid endpoint that accepts filter state. Depends on
   corpus size + infra decisions not my call.

---

## Hard line — what I am explicitly NOT telling you to do

- Don't touch the Terminal session (`lastshift.app`) or any Terminal
  contract
- Don't touch `payment-events.ts`, `tier.ts`, or `tier-recalc.ts` —
  those are the proof-count → tier pipeline. Frontend reads them,
  doesn't modify them.
- Don't build a new auth flow or session handoff
- Don't wire caching / revalidation strategies yourself — coordinate
  with backend
- Don't edit wireframes during code implementation; they're the
  canon, not a draft

---

## What to read first (in order)

1. `CLAUDE.md` top to bottom — especially § Priorities, § Session
   protocol, § Updates feed — commit convention
2. Top 3 WORKLOG entries
3. `wireframes/scan-grid-locked.html` — current placeholder, so you
   know what you're replacing
4. `src/app/(marketing)/how-it-works/page.tsx` — search for "THE
   GRID" section, read the UX spec embedded in marketing copy
5. `src/components/ResultCard.tsx` +
   `src/app/(marketing)/profile/[handle]/page.tsx` +
   `profile-public.css` — existing card vocabulary
6. `src/lib/tier.ts` — tier logic, including `deriveProfileVariant`
   (determines which profiles are eligible for Grid visibility)

---

## Session-protocol reminders specific to this work

- The repo lives on the external drive
  (`/Volumes/LASTSHIFT/lastproof-build/`). iCloud is dead for code
  per the 2026-04-22 migration. If the drive isn't mounted, use
  `_staging/` for content-only work or stop.
- `git show origin/main:<path>` before editing any structured file
  (`VERSION`, `data/updates.json`). This has bitten multiple sessions
  — the rule exists because of real data loss.
- `git pull --rebase origin main` before every push. Multi-session
  contention is real.
- `git show --stat HEAD` after every push that touches structured
  files. Catches silent clobbers.
- WORKLOG entry at the top when you ship. Include gotchas for
  whoever comes after you.

---

## Honest disclosure — what I don't know

- I have not read `src/app/(marketing)/grid/page.tsx` — don't know
  if it exists yet as a stub or if someone has started implementing
  it.
- I don't know if there's a Grid-specific wireframe beyond
  `scan-grid-locked.html`. There might be a `grid.html` or similar I
  haven't seen.
- I don't know what URL params the Grid should respect for filter
  state (e.g., `?category=raid-leading&tier=3+`).
- I don't know the HIRE-to-Telegram resolution logic — whether it
  opens `t.me/<handle>` directly or goes through a redirect endpoint
  for tracking.
- I don't know if SHIFTBOT is shipping alongside the Grid on
  2026-05-08 or later.

Ask the coordinator or backend session for any of these before
deciding. Making them up will cost you.

---

## Closing

You're building the thing that makes the whole rest of the product
make sense. Every profile, every proof, every tier calculation exists
to populate the Grid. Honor the wireframes. Don't reinvent patterns
that already exist one folder over.

Ping the coordinator when you hit a backend/fullstack boundary —
there's no prize for crossing lines, only cleanup for someone else
later.

— Frontend session, 2026-04-23
