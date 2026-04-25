# Chad Function — Cowork wireframe brief

> This doc scopes the wireframes Cowork needs to produce for the Chad
> Function (friends). It captures the locked mechanics from planning so
> the visual work lands against the right state machine the first time.
>
> Review flow: **this doc → Cowork produces wireframes → coordinator
> reviews against this doc → Frontend applies styling → back to
> architecture for backend + QA.**

---

## What "Chad" means

- **Chad** = friend / connection
- **Chad Army** = a user's list of chads (their friends list)
- **Add Chad** = send a friend request
- Purpose: social proof on the public profile. Cold visitors see the
  operator's network at a glance — "LEGEND × VERIFIED × EXPERIENCED"
  flex on the artifact operators paste into DMs.

---

## Canon & design constraints

- `wireframes/*.html` are the single source of visual truth (per
  CLAUDE.md § top). New wireframes extend this language — do **not**
  introduce new color, typography, or motion tokens.
- Tier/color rules from CLAUDE.md § Tier system apply (no green for
  tier, no orange for tier; green reserved for success/verified/DEV;
  orange reserved for brand accent).
- Tone on the public profile is the same as `lastproof-profile-public.html`
  — terminal aesthetic, mono typography, dark canvas.
- Dashboard tone matches `lastproof-dashboard.html` /
  `lastproof-dashboard-fresh.html`.

---

## Locked mechanics — non-negotiable state contract

These are the rules the wireframes must design around. Any UI that
contradicts these is wrong.

### Relationship model — Instagram-private style, ONE-WAY DIRECTIONAL

(Updated 2026-04-25: previous version of this brief described a
"mutual" model where one accept lit both armies. That was wrong.
Locked model is directional, like Instagram's private-profile follow
flow.)

- **"My Chad Army" = chads I have asked to add, who accepted.**
  When I click `+ ADD CHAD` on B's profile, I am asking to add B to
  MY army. If B accepts, B appears in my army. **B's army is
  unchanged** — I am NOT auto-added to B's army.
- For B to also have me in their army, B must separately click
  `+ ADD CHAD` on my profile and I must accept.
- Each direction is an independent request with its own accept /
  deny / pending lifecycle. A→B and B→A are stored as separate
  rows and resolved independently.
- This means at any moment between two operators A and B, four
  independent states can co-exist:
    - 0 rows (no relationship)
    - A→B pending (A asked, B hasn't acted)
    - A→B accepted (B is in A's army)
    - B→A pending (B asked, A hasn't acted)
    - B→A accepted (A is in B's army)
    - Any combination of A→B + B→A states

### Identity
- Chad graph is **wallet-keyed**. Every node is a wallet with an
  **active** profile.
- **Active** = paid AND published. Free / unpublished profiles do not
  participate: cannot send asks, cannot receive asks, do not
  appear in anyone's visible Chad Army.

### Lifecycle
- Rows persist in the DB through lapses. When either party goes
  free/unpublished, they simply **hide** from any army that includes
  them; when they reactivate, they reappear. No re-ask needed.

### Ask flow
- One row per `requester → target` direction at a time. The DB
  unique constraint on `(requester_wallet, target_wallet)` enforces
  this. The reverse direction (`target_wallet → requester_wallet`)
  is a separate row with its own state and is unaffected.
- Target sees pending asks in their dashboard with two buttons:
  **[Accept]** and **[Deny]**. No "Ignore" button — ignore is
  inaction.
- **Accept** → row status flips to accepted; the requester gains
  the target in their (the requester's) army. The target's army
  is unchanged.
- **Deny** → row is **hard-deleted**. "As if it never happened."
  The requester can re-ask later.
- **No action / Ignore** → row sits pending forever. Requester
  cannot re-ask while the row exists in this direction. (The
  reverse direction is unaffected — target can still send their
  own ask to the requester independently.)

### Remove (un-chad)
- Each chad row can be removed by **its requester** from their
  dashboard. Remove hard-deletes only that row (one direction).
  The reverse-direction row, if any, is unaffected.
- Remove lives **only** in the dashboard. Not in the public-profile
  modal, not on the public army page.

### Requester-side visibility
- Public profile always shows a **static "Add Chad" button** for every
  viewer. Same label regardless of relationship state, regardless of
  whether the viewer has a wallet connected. Keeps the public profile
  fully cacheable and wallet-agnostic.
- All state branching happens **in the modal**, after click.

### Grid coupling
- None. The Chad graph does not feed Grid discovery or ranking. Grid
  launch (2026-05-08) and Chad Function are independent tracks.

---

## Wireframes needed

Six wireframes total — three modifications of existing files, three
new files. Each entry below lists purpose, elements the wireframe
must include, and explicit open questions for Cowork to answer
through the design.

### 1. Public profile — Add Chad button + Chad Army section

- **Type:** modification of `wireframes/lastproof-profile-public.html`
- **Purpose:** add the entry point for the Chad feature on every
  cold-share public profile.
- **Must include:**
  - `[ + ADD CHAD ]` button — static label, same for every viewer
  - `CHAD ARMY` section showing up to **10 avatars** (avatar +
    display name under each — or label-less per Cowork's call)
  - `SEE MORE →` link to the full army page (wireframe #4) when army
    size > 10
  - Empty state for an operator with 0 chads — does the section
    render with a placeholder, hide entirely, or show a zero-state
    message? (Open question for Cowork.)
- **Open questions:**
  - Placement of the `+ ADD CHAD` button relative to the existing
    `HIRE` button — adjacent? Stacked? Above the fold?
  - Ordering of the 10 avatars — most recent accept, random, pinned
    favorites, tier-sorted? (Default I'd propose: most recent accept.
    Cowork picks.)
  - Avatar grid shape — strict 10 (2×5, 5×2), flex-wrap, other?

### 2. Free-profile variant — Add Chad button decision

- **Type:** modification of `wireframes/lastproof-profile-free.html`
- **Purpose:** decide how the static `+ ADD CHAD` button renders on a
  free profile being viewed by anyone. Free profiles **cannot
  receive** chad requests.
- **Must answer one of:**
  - **Hide entirely** — no button, no army section. Cleanest; matches
    how free profiles already strip the tier bar and hire button.
  - **Render disabled** — greyed button with a "This operator hasn't
    activated their profile" tooltip/message. Invites upgrade
    pressure on the viewed operator via word-of-mouth.
  - Some third option Cowork thinks is better.
- **Note:** this is the free-variant seen BY visitors, not the free
  operator's own view of someone else's paid profile. A free operator
  viewing a paid profile will still see `+ ADD CHAD`; the modal will
  dead-end them with "Activate your profile to send" (see wireframe #3).

### 3. Add Chad modal — state-branching flow

- **Type:** new wireframe — suggest file name
  `wireframes/lastproof-add-chad-modal.html`
- **Purpose:** the full "Add Chad" experience, modeled on the existing
  payment-modal mental pattern. This is where ALL state lives.
- **Must include every branch:**
  1. **Connect wallet** — if viewer has no wallet connected yet.
     If viewer already has a wallet connected from `/manage` or an
     earlier payment flow, **skip straight to step 2**.
  2. **Verify + eligibility check** — spinner state while the app
     reads the connected wallet and resolves relationship to this
     target.
  3. **Branch outcomes** (one of):
     - ✅ **Eligible** → "Join Chad Army Request" CTA → submit →
       success screen → back-to-profile exit
     - ❌ **No profile on this wallet** → "Create a profile first"
       + link to onboarding
     - ❌ **Free profile on this wallet** → "Activate your profile
       to send chad requests" + upgrade nudge
     - ❌ **Own profile** → "That's your profile" dead-end
     - ℹ️ **Already chads** → view-state: "Already in their Chad
       Army" — **no Remove button here** (Remove lives only in
       the dashboard)
     - ℹ️ **Request pending** → "Request Pending" confirmation
       screen, no action
- **Open questions:**
  - Modal chrome — same shell as `lastproof-mint-modal.html` or
    `lastproof-upgrade-modal.html`? Pick one to match.
  - Success screen treatment — brief toast-style confirmation then
    auto-dismiss back to profile, or explicit "Done" button?

### 4. Public Chad Army — full list page

- **Type:** new wireframe — suggest file name
  `wireframes/lastproof-chad-army.html`
- **Purpose:** the `SEE MORE →` destination from the public profile
  army section. Public-facing, read-only list of all chads.
- **Route it'll map to:** `/profile/[handle]/chads`
- **Must include:**
  - Page header identifying whose army (e.g. `CHADS OF [handle]`)
  - Back-to-profile link
  - Full grid of avatars + display names
  - Each avatar + name is a link to that chad's public profile
    (Cowork: same tab or new tab? my recommendation: same tab,
    since it's already a public surface)
  - No accept/deny/remove actions — this is visitor-facing only
- **Open questions:**
  - Pagination vs infinite scroll vs single long list? Unknown army
    sizes at launch. Default I'd propose: single list with lazy-load
    beyond first 50. Cowork picks.

### 5. Dashboard inline — Chad Requests strip

- **Type:** modification of `wireframes/lastproof-dashboard.html` and
  `wireframes/lastproof-dashboard-fresh.html`
- **Purpose:** a compact Instagram-style strip embedded in the edit-
  profile dashboard, showing pending chad requests inline.
- **Must include:**
  - Section title `CHAD REQUESTS` with count, e.g. `CHAD REQUESTS (3)`
  - **Renders only when pending count > 0**. Zero pending = section
    hides entirely. No empty state.
  - First N inline request rows (Cowork picks N — 3–5 feels right).
    Each row:
    - Avatar + display name (both link → requester's public profile
      in a **new tab**)
    - `[Accept]` `[Deny]` buttons
  - `SEE ALL REQUESTS →` link at the bottom if pending count > N
- **Open questions:**
  - Placement within the dashboard — where exactly does the strip
    sit relative to existing sections?
  - Count badge style — inline parens `(3)`, or a separate pill/dot?
  - Any visual "new requests since last visit" highlight, or just
    treat all pending identically?

### 6. Dashboard Chads management — full page

- **Type:** new wireframe — suggest file name
  `wireframes/lastproof-dashboard-chads.html`
- **Purpose:** the `SEE ALL REQUESTS →` destination. Also the only
  place an operator can **Remove** an existing chad.
- **Route it'll map to:** `/dashboard/chads` (or whatever
  naming fits existing dashboard routes)
- **Must include two stacked sections:**
  - **PENDING REQUESTS** — full list, `[Accept]` `[Deny]` per row.
    Avatar + display name link to requester's public profile in a
    new tab. Section hides if empty.
  - **YOUR CHAD ARMY** — full list of accepted chads, `[Remove]`
    per row. Avatar + display name link to chad's public profile
    in a new tab. Section renders with zero-state if empty
    ("No chads yet. Share your profile to start your army.").
  - Back-to-dashboard link
- **Open questions:**
  - Visual distinction between the two sections — divider, header
    treatment, collapsible?
  - Remove confirmation — inline undo, modal "are you sure," or
    instant with no confirm?

---

## NOT in scope for wireframing

These are backend / architecture concerns, handled after wireframes
land and in the backend pass:

- Data model — `chads` table shape, adapter pattern, Supabase
  migration
- API contracts — `/api/chads/request`, `/api/chads/respond`,
  `/api/chads/list`, `/api/chads/remove` (names TBD)
- Army size cap (unlimited vs hard cap)
- Rate limits on outgoing requests per wallet
- Notifications — does an incoming chad request ping the
  `notifications` store? In-app only, or also bot/email?
- Pagination strategy for `/dashboard/chads` and
  `/profile/[handle]/chads`
- Exact deny semantics (confirmed: hard row delete) — architecture
  pass will write it
- Post-Remove re-request behavior — strict (Remove is final) vs
  soft (fresh request allowed after Remove). Open; will decide in
  backend pass
- Caching strategy for public army grids

---

## Handoff flow

1. **This brief** — coordinator reviews, adjusts any locked mechanics
   if planning revealed gaps (unlikely at this point)
2. **Cowork produces wireframes** — six files per the list above.
   Cowork may propose structural changes to this brief if the
   wireframing surfaces problems — flag them back, don't just
   diverge silently
3. **Coordinator reviews wireframes** against this brief — verifies
   every state branch in wireframe #3 is represented, free-variant
   decision is made in wireframe #2, etc.
4. **Frontend styling pass** — apply existing design tokens, animation,
   polish against the wireframes
5. **Back to architecture** — backend session writes the data model,
   adapter, API, and wires the UI to real data; QA with coordinator
   covers all branches in wireframe #3 plus the lifecycle edges
   (lapse hide/reappear, deny-delete-re-request)

---

## References

- `CLAUDE.md § Tier system` — tier colors, thresholds, pairing rule
- `CLAUDE.md § Session protocol` — commit + WORKLOG conventions
- `CLAUDE.md § Updates feed` — commit-subject prefix and VERSION
  bump requirements for any commit that ships user-visible Chad
  behavior
- `wireframes/lastproof-profile-public.html` — base for wireframe #1
- `wireframes/lastproof-profile-free.html` — base for wireframe #2
- `wireframes/lastproof-dashboard.html` — base for wireframe #5
- `wireframes/lastproof-mint-modal.html` /
  `wireframes/lastproof-upgrade-modal.html` — modal chrome reference
  for wireframe #3
