# Chad Function — Wireframe Handoff for Builder

**From:** Cowork / chad-wireframes role
**Date:** 2026-04-23
**Source brief:** `docs/features/chad/COWORK-BRIEF.md`
**Status:** ✅ All six wireframes shipped, HTML-validated, ready for styling + wiring

---

## What this doc is

You've been given the locked wireframes for the Chad Function (friends
feature). This handoff explains **what was built, where each file lives,
and what you need to know to implement it**. Every design decision the
brief asked for is resolved — the open questions the brief listed are
answered through the design (noted per file below), with a small
coordinator-review list at the end.

Read this alongside the source brief (`COWORK-BRIEF.md`) — the brief
captures the locked mechanics (wallet-keyed graph, active=paid+published,
hard-delete on deny, etc.); this doc captures the visual canon.

---

## Wireframe files

All live at `wireframes/*.html` — flat HTML files per the existing repo
convention. Three modifications, three new files:

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `wireframes/lastproof-profile-public.html` | **modified** | Public profile — `+` add-chad pill in hero, CHAD ARMY strip between Trust Tier and Tabs |
| 2 | `wireframes/lastproof-profile-free.html` | **UNCHANGED** | **Free profiles do not change. No chad-related UI here.** Free operators don't participate in the chad graph at all. |
| 3 | `wireframes/lastproof-add-chad-modal.html` | **new** | Full state-branching modal — 10 phases, wireframe-only phase toggle at the bottom of the page for reviewer cycling |
| 4 | `wireframes/lastproof-chad-army.html` | **new** | Public read-only full army list at `/@[handle]/chads` |
| 5a | `wireframes/lastproof-dashboard.html` | **modified** | CHAD MANAGEMENT summary card between STATUS BAR and IDENTITY |
| 5b | `wireframes/lastproof-dashboard-fresh.html` | **modified** | Same card, fresh-user state (0 / 0 counts) |
| 6 | `wireframes/lastproof-dashboard-chads.html` | **new** | Full `/dashboard/chads` page — one combined grid, yellow outline on pending |

All files pass HTML structural validation (no orphaned tags, no
mismatched close tags).

---

## Universal rules that affect every file

These come from `COWORK-BRIEF.md` and are non-negotiable — if any UI
contradicts these, the UI is wrong:

- **Wallet-keyed graph.** One wallet = one node = one army. No separate
  "profile" identity; the wallet is the identity.
- **Active = paid AND published.** Only active operators participate —
  can send, can receive, appear in public armies. Lapses (free or
  unpublished) **hide** the operator from public armies on both sides;
  when both reactivate, the relationship reappears. No re-request needed.
  Backend: persist the relationship through lapses.
- **Deny = hard-delete.** No soft-delete, no "denied" status row. The
  row is gone; the requester can re-send later.
- **No-action / Ignore = pending forever.** No block feature needed —
  inaction is the block.
- **Remove = instant, no undo.** Kellen's explicit call (2026-04-23).
  The early wireframe had a 5-second undo ring; that was cut. Frontend:
  `/api/chads/remove` hard-deletes immediately. No soft-delete window.
- **Public profile button is static.** Same `+` label/treatment for
  every viewer, regardless of wallet or relationship. All state
  branching happens in the modal (after click). Keeps the public
  profile fully cacheable and wallet-agnostic.
- **Chad graph independent from Grid.** The chad relationship does NOT
  feed Grid discovery, ranking, or any scoring. Don't couple them in
  the architecture pass.
- **Profile URL format: `lastproof.app/@[handle]`.** Not
  `/profile/[handle]`. All links in the wireframes use this format.

---

## Wireframe #1 — Public profile

**File:** `wireframes/lastproof-profile-public.html`

### What changed

**1. `+` ADD CHAD pill in the handle row.** Sits inline right next to the
green `ACTIVE` status pill. Style matches the **SEE ARMY** pill (in the
chad-army section below) exactly — same 10px mono, 7px/11px padding,
pill radius, orange filled-tint — so users see a visual thread between
"add" here and "see army" below.

- Class: `.btn-add-chad`
- Content: literally just `+`
- Default: orange outline + orange `+` on `orange-dim` fill
- Hover: solid orange fill + white `+`
- Same height as the adjacent `ACTIVE` pill (status pill sizes were
  bumped to match)

Click behavior: open `lastproof-add-chad-modal.html`. No state checks on
the profile — the modal handles every branch.

**2. CHAD ARMY section.** Sits between **TRUST TIER** and the **TABS** nav
(not in the tab system — it's always visible above the tabs). Uses
`<section class="section">` so it inherits the page's standard vertical
rhythm. `.trust-tier + .section { margin-top: 28px }` adds the extra
breathing room since trust tier only contributes 18px bottom margin.

Layout:

```
// CHAD ARMY
●    ●    ●    ●    ●    ●    ●    ●    ●    ●        [SEE ARMY]
```

- Title uses the existing `.section-title` class — `// ` prefix comes
  auto from `::before`, orange accent on the slashes.
- No count, no "12" — per Kellen's direction.
- Avatars: 54px circles, 10 max, gradient palette cycled (5 colors),
  `justify-content: space-between` on the row so they distribute evenly
  across available width.
- Each avatar is a link to `/@[handle]` (same tab — public surface).
- `SEE ARMY` button matches the `ALL 9` pill from the LINKS section
  (same `.lk-tab-pub.active` treatment) — 10px mono, orange filled-tint,
  hover flips solid.
- Hide the entire section when `count === 0`.

### Production source to consult

The live page uses React components in `src/components/profile/`:

- `ProfileHero` — add the `+` pill inside `.pp-id-handle-row`, right
  after `ShareIconButton`. CSS goes in `profile-public.css`.
- The chad army strip is new — create a `ChadArmyStrip` component and
  render it in `src/app/(marketing)/profile/[handle]/page.tsx` between
  `TrustTierBar` and `ProfileTabs`.

### Open questions resolved through the design

- **`+` placement:** inline next to ACTIVE badge in `.id-handle-row`
  (NOT adjacent to HIRE at the bottom, NOT absolute-positioned in the
  hero corner — both were tried and rejected).
- **Chad army section position:** between TRUST TIER and TABS. Was
  originally between VERIFICATIONS and CTA strip; moved up so it's
  visible above the fold for cold DM-paste traffic.
- **Avatar ordering:** intentionally random in production (per Kellen).
  Backend just shuffles — no "most recent first" promise.
- **Tile content:** avatar only. No display name, no handle, no tier
  badge. Hover scale + shadow is the only per-tile feedback.

---

## Wireframe #2 — Free profile

**File:** `wireframes/lastproof-profile-free.html`

### What changed

**Nothing.** File is identical to production. No `+` button, no chad
army section, no disabled state, no upgrade nudge — **chads are a
paid-tier-only feature with zero footprint on free profiles.**

If a viewer lands on a free profile, they see the same layout as before
the Chad Function existed. If a free operator views their own profile,
they see the same layout. No change.

---

## Wireframe #3 — Add Chad modal

**File:** `wireframes/lastproof-add-chad-modal.html`

### What it is

The entire Add Chad experience lives in this modal. Click the `+`
button on any public profile → this modal opens → ten branches resolve
to one of the outcomes below. All state handling is here; the public
profile stays cacheable.

### Chrome

Modeled on `lastproof-mint-modal.html` (same 600px shell: titlebar with
traffic dots, ref-row, body, cta-row). Primary accent = **green** — chad
is a verified/social handshake, which is already the semantic meaning
of green in this design system (DEV badge, verified check, money).

### 10 phases — state machine

One phase visible at a time (`.step[data-step="…"]`). Wireframe-only
phase toggle at the bottom of the page lets you cycle all ten.

| # | Phase | Color | Trigger | Outcome |
|---|-------|-------|---------|---------|
| 1 | `connect` | green | no wallet attached | shows wallet picker (Phantom/Solflare/Backpack) |
| 2 | `checking` | orange (accent) | wallet connected, resolving relationship | spinner + log |
| 3 | `eligible` | green | paid+published viewer, no relationship yet | target card + "WHAT HAPPENS NEXT" info card + green `> SEND CHAD REQUEST` CTA |
| 4 | `submitting` | orange | signed, persisting | spinner + log |
| 5 | `success` | green | request recorded | green check + status summary; CTA `> DISCONNECT & BACK TO PROFILE` (see note below) |
| 6 | `already` | green | viewer is already chads with target | info view; points to `/dashboard/chads` for Remove |
| 7 | `pending` | orange | viewer already sent a request, not yet responded | info view; re-send locked |
| 8 | `free` | **purple** | viewer has a free profile | purple-themed upgrade nudge (see note below) |
| 9 | `no-profile` | gold | viewer's wallet has no profile at all | "Create a LASTPROOF profile" leading message, chad army mentioned as secondary benefit |
| 10 | `own` | text-dim | viewer is the target (own profile) | soft dead-end |

### Key decisions (Kellen called-outs)

- **Success (phase 5) disconnects the wallet.** The CTA reads
  `> DISCONNECT & BACK TO PROFILE` and triggers both wallet disconnect
  AND navigation. Don't leave the connection hanging — the request is
  signed, the work is done, the wallet releases.
- **Free profile (phase 8) uses PURPLE theme, not gold.** Matches
  `lastproof-upgrade-modal.html`'s purple treatment so the upgrade flow
  is visually cohesive wherever it surfaces. `.info-card.purple`,
  `.done-check.purple`, `.cta.purple`, `pulsePurple` animation — all
  defined in the modal's CSS.
- **No profile (phase 9) leads with profile creation, not chads.**
  Headline: `Create a LASTPROOF profile.` The chad army benefit is
  mentioned as "one of several premium benefits" in a dimmer paragraph
  — not the primary push. Profile creation is the main message.

### Backend contract

The modal expects one `/api/chads/eligibility` call (or equivalent)
that returns which phase to render. Shape suggestion:

```jsonc
// response from GET /api/chads/eligibility?target=<handle>
{
  "phase": "eligible",                // one of the 10 phase keys above
  "viewer": { "handle": "kellen", "wallet": "F7k2...9xMp" },
  "target": { "handle": "benfu", "displayName": "Ben Fu", "tier": 3, "armyCount": 47 },
  "relationshipSince": null           // set only for "already"
}
```

Then on submit: `POST /api/chads/request { target: "benfu" }` → 200 flips
to phase `submitting` → `success`.

### Info-card bullet alignment

There was a text-align bug where bullets in `.info-card > .info-body ul`
inherited `text-align:center` from the parent `.done-wrap`. Fixed
universally:

```css
.info-card { text-align: left; }
.info-body ul { padding-left: 20px; text-align: left; list-style-position: outside; }
.info-body li { margin: 4px 0; padding-left: 2px; }
```

Apply the same fix to any React port of this modal.

---

## Wireframe #4 — Public Chad Army page

**File:** `wireframes/lastproof-chad-army.html`
**Route:** `/@[handle]/chads`

### What it is

Public, read-only full list of someone's chads. Destination of the
`SEE ARMY` button on the public profile.

### Layout

- Same topbar + footer chrome as the public profile
- Orange background + orange `@handle` title (matches the brand accent
  treatment throughout the app)
- Page header: `> CHAD ARMY · PUBLIC LIST` eyebrow, `CHADS OF @[handle]`
  title with the `@handle` in orange, sub-line: `N ACTIVE CHADS`
  (`ACTIVE CHADS`, not "CONNECTIONS")
- 4-col grid of `.chad-card` tiles — horizontal layout: avatar + name +
  @handle, no tier badges, no timestamps
- Each tile links to that chad's `/@[handle]` profile (same tab)

### Pagination

**True infinite scroll.** No LOAD MORE button, no count footer, no
spinner, no "end" marker. Frontend wires an `IntersectionObserver` on
the last `.chad-card`; when it enters the viewport, fire
`/api/chads/list?cursor=<last_id>` and append. When the response comes
back empty, the observer goes idle — that's the natural end of the list.
Pattern matches X / IG profile follower lists.

### Empty state

A commented-out markup block exists at the bottom for reference (icon +
"NO CHADS YET" + copy). The public-profile chad army section HIDES at
count=0, so this page is usually only reached via a direct link or
middle-click when count > 0 — but render the empty state anyway for the
edge case.

### Open questions resolved

- **Tile content:** no tier badges (wall stays clean, reads "people"
  not "stats")
- **Tile target:** same tab (it's a public surface)
- **Order:** intentionally random in production

---

## Wireframe #5 — Dashboard CHAD MANAGEMENT strip

**Files:**
- `wireframes/lastproof-dashboard.html` (paid user, sample 2 pending / 200 army)
- `wireframes/lastproof-dashboard-fresh.html` (fresh user, 0 / 0)

### What it is

Tiny summary card sitting between STATUS BAR and IDENTITY on the
dashboard. Inherits `.edit-card` chrome exactly (solid background, same
border, same `z-index:1`, same drop shadow) — reads as a peer of the
other dashboard sections, not a special callout.

### Two render variants

**PREMIUM (default):**

```
// CHAD MANAGEMENT
Pending  2    Your Chad Army  200          [ MANAGE → ]
```

- Title: `//` in orange (`var(--accent)`) + `CHAD MANAGEMENT` in white.
  Use `<span class="slash">//</span>CHAD MANAGEMENT`.
- Two count lines, both mono. Pending count colored gold (`var(--gold)`)
  so it pops when there's something waiting.
- `MANAGE →` pill on the right — orange filled-tint, routes to
  `/dashboard/chads`.
- Always renders — counts can both be 0.

**FREE / LOCKED:**

Rendered when `profile.tier === 'free'`. Same chrome, but:

- Title greyed (`color: var(--text-dim)` on both slash and text)
- Counts replaced with `⚠ PREMIUM FEATURE ONLY` notice (gold warning
  glyph + dim mono text)
- Right-side button changes from `MANAGE →` to `UPGRADE PROFILE`
  (filled gold, action-oriented, routes to `/manage`)

### Markup pattern

Frontend: render ONE of these two variants depending on tier. In the
wireframe they're both present as siblings (the locked one has
`style="display:none"`) so reviewers can preview either.

### Gotcha — duplicated CSS

The `.chad-mgmt-*` block is currently duplicated verbatim in both
`lastproof-dashboard.html` and `lastproof-dashboard-fresh.html`
(~50 lines each). When you port to React, extract it to a shared
module — co-located `ChadManagementStrip.tsx` or similar — so the two
dashboards stay in sync.

---

## Wireframe #6 — Dashboard Chads page

**File:** `wireframes/lastproof-dashboard-chads.html`
**Route:** `/dashboard/chads`

### What it is

The `MANAGE →` destination from the dashboard strip. The only place
`Remove` lives. Visually mirrors the public chad army page (same orange
theme, same horizontal tile layout) so the experience feels continuous.

### Layout — ONE combined grid

No PENDING / ARMY section split — there was a split in the earlier
wireframe, removed per Kellen. Now:

- Page header: same `CHADS OF @[handle]` title treatment as the public
  army page (orange @handle)
- **2-line summary** under the title:
  - `● Pending Requests (2)` — yellow dot + **yellow** number
  - `● Your Chad Army (200)` — neutral dot + standard number
- **One big grid** — 4-col, same `.chad-card` tile shape as the public
  army page
- Pending cards get `.pending` modifier → **yellow/gold outline**
  (that's the visual distinction; no tinted bg, no separate section)
- Pending tiles render first (action-required priority); frontend orders
  by `status DESC`

### Tile actions

- **Pending tile** → stacked `[ACCEPT]` / `[DENY]` buttons on the right
- **Army tile** → single `[REMOVE]` button on the right
- Avatar + name + @handle area is the link region → opens
  `/@[handle]` in a new tab (`target="_blank" rel="noreferrer"`)
- Buttons are separate siblings so clicking them doesn't bubble into
  the link

### Remove behavior

**Instant. No undo. No confirmation modal. No 5-second countdown.**
Click REMOVE → tile is removed from the DOM → backend hard-deletes the
row via `/api/chads/remove`. Kellen's explicit call. The earlier
wireframe had an undo ring; it's been stripped entirely — no `.removing`
class, no `.ch-undo` markup, no countdown animation.

### Empty state

When both pending and army are zero:
- Grid replaced with the empty-state block (icon + "NO CHADS YET" + copy)
- Both summary counts flip to `(0)` — both lines still visible
- **No "copy my profile link" CTA** — user asked for it removed. Just
  the message.

Wireframe toggle pill at the bottom lets reviewers flip between FULL
and EMPTY states.

### Pagination

Same infinite-scroll pattern as the public army page —
`IntersectionObserver` on last `.chad-card`, fires
`/api/chads/list?cursor=<last_id>&type=pending|accepted`.

---

## API contract — backend sketch

Not implemented yet. Suggested shape from the wireframes:

```
GET  /api/chads/eligibility?target=<handle>   → phase + viewer + target + relationshipSince
POST /api/chads/request                       → body: { target: "<handle>" }
POST /api/chads/respond                       → body: { requester: "<handle>", action: "accept"|"deny" }
GET  /api/chads/list?cursor=<id>&type=<kind>  → cursor pagination; kind in: pending, accepted, army
POST /api/chads/remove                        → body: { chad: "<handle>" } — hard-deletes
```

A `chads` table with wallet-pair primary key (not profile IDs) — the
graph is wallet-keyed so lapses hide without destroying the row.

---

## Open questions for coordinator review

Design decisions I made through the wireframe that coordinator may
want to override:

1. **Modal success copy on the status summary** (phase 5) — currently
   no `YOUR ARMY +1 ON ACCEPT` line (it was pulled during iteration).
   If product wants the "you'll gain a chad" preview, add it back.
2. **Inline undo on Remove was rejected** — current design is instant
   hard-delete. If data suggests users miss the undo after launch,
   revisit — but per Kellen this was deliberate.
3. **Chad graph ordering in production is random** — no recency, no
   pinning, no favorites. v2 could add pinning.

---

## Gotchas for the builder

- **`+ CHAD` button is intentionally static for every viewer.** Don't
  branch the button render on relationship state — branch in the modal.
  Keeps the public profile cacheable and wallet-agnostic.
- **Purple theme on phase 8 (free upgrade nudge)** — if you touch the
  upgrade-modal's purple tokens (`--purple-dim`, `pulsePurple`), keep
  them in sync with the add-chad modal. Both flows should match.
- **Dashboard strip CSS is duplicated** across `lastproof-dashboard.html`
  and `lastproof-dashboard-fresh.html` — extract to a shared React
  component when porting.
- **Infinite scroll on both army pages** — IntersectionObserver
  implementation must deduplicate; if the user scrolls fast, the
  observer can fire before the previous fetch resolves. Guard against
  double-append.
- **`target="_blank" rel="noreferrer"`** on every chad-to-profile link
  in the dashboard (per brief). Opens in a new tab so the operator
  doesn't lose their dashboard context when inspecting a requester.
- **Tier colors from `CLAUDE.md § Tier system` apply** — never use
  green for tier (reserved for success/verified/DEV), never use orange
  (brand accent only). The tier pills on the dashboard chads page
  already follow this.

---

## Commit convention reminder

Wireframes are **exempt** from `§ Updates feed — commit convention`
(per `CLAUDE.md`). They're internal canon, not user-visible behavior:

- No `[update: …]` prefix on the commit
- No `VERSION` bump
- No `data/updates.json` entry

A plain commit subject like:

```
wireframes: chad function — add-chad modal + public profile + dashboard chads
```

When the backend + frontend PR lands with the actual user-visible
feature, THAT commit triggers the updates-feed convention (headline:
something like "You can now send chad requests to other operators.").

---

## Files to start with

If you have half an hour and want to orient before writing code:

1. Read `docs/features/chad/COWORK-BRIEF.md` — the locked mechanics
2. Open `wireframes/lastproof-add-chad-modal.html` in a browser, click
   through all 10 phases via the bottom toggle — this is the state
   machine you're building
3. Open `wireframes/lastproof-profile-public.html` and
   `wireframes/lastproof-chad-army.html` side by side — see the visual
   thread (orange `+` pill → orange `SEE ARMY` pill → orange page bg)
4. Open `wireframes/lastproof-dashboard.html` and
   `wireframes/lastproof-dashboard-chads.html` side by side — see the
   `MANAGE →` entry point and its destination
