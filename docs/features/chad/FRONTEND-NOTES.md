# Chad Function — Frontend polish notes

**From:** Frontend-v2 / chad-polish role
**Date:** 2026-04-24
**Pairs with:** `COWORK-BRIEF.md` + `BUILDER-HANDOFF.md`
**Status:** ✅ Polish pass complete — wireframes ready to hand to architecture for backend + React port

---

## What this doc is

The companion to `BUILDER-HANDOFF.md` — written after the Frontend
polish pass. Captures:

- Token deviations + extensions Cowork made vs production canon
- Components to extract during the React port
- Production-side gaps the architecture pass needs to fill
- Coordinator-level decisions the wireframes implicitly request

Read this BEFORE the architecture pass — these are the "things you'll
hit if you skip this doc" items.

---

## Polish edits I made

Surgical CSS-only fixes, no structural or copy changes. Cowork's
locked decisions stand.

### `wireframes/lastproof-add-chad-modal.html`

- **`.conn-pill`** — `border-radius: 999px` (capsule) → `var(--r-btn)`
  (6px rounded-rect). Production convention is 4–8px on all chromed
  pills (ticker, nav buttons, status pills). Capsule shape was the
  outlier, same way it was on the topbar ticker and Grid wireframe
  before those were aligned.

That's the only structural CSS change. Everything else Cowork shipped
is already aligned to production tokens — `--r-pill: 4px` matches
`globals.css`, `--accent` is properly defined as an alias of
`--orange` (no Grid-style aliasing bug), and the platform's body
backdrop pseudos are correctly set up across all new wireframes.

---

## Token deviations + extensions Cowork introduced

Cowork's wireframes define tokens that **don't exist in production
`globals.css`**. The wireframes are self-contained so this is
non-breaking for the wireframes themselves — but the **React port
needs to land these tokens in `src/app/globals.css`** OR replace
them with literal `rgba()` values inline.

| Token | Value | Used in | Needed in globals.css? |
|---|---|---|---|
| `--purple-dim` | `rgba(167, 139, 250, 0.10)` | modal phase 8 (free upgrade), purple glows | **yes** |
| `--purple-glow` | `rgba(167, 139, 250, 0.20)` | modal phase 8, info-card.purple shadow | **yes** |
| `--gold-dim` | `rgba(255, 215, 0, 0.10)` | pending tile bg tints, locked-strip warning | **yes** |
| `--gold-glow` | `rgba(255, 215, 0, 0.30)` | pending tile shadow, dashboard-chads pending pulse | **yes** |
| `--red-dim` | `rgba(255, 84, 112, 0.10)` | DENY button bg, error states | yes (already used elsewhere too) |

These are natural extensions of the existing dim/glow pattern
(`--orange-dim`, `--green-dim`, `--accent-glow`, `--green-glow`).
Recommend landing them in the next `globals.css` edit before any
chad component lands in production.

---

## Color-reservation extensions — coordinator review needed

Per `CLAUDE.md § Tier system` rules:
- `--gold` reserved for Tier 3 · EXPERIENCED only
- `--purple` reserved for Tier 4 · LEGEND only
- `--green` reserved for verified / DEV / money / success
- `--orange` reserved for brand accent only

Cowork's wireframes extend two of these reservations. **These extensions
need a coordinator-level call:** ratify the broadened semantics in
`CLAUDE.md` (tightens design system) or push back and recolor (preserves
strict reservation).

### 1. Gold extended from "Tier 3 only" → "Tier 3 + attention / pending / upgrade-required"

Used as gold-as-attention across:

- **Dashboard chad-mgmt strip:** `Pending` count rendered in `--gold`
  (so it pops vs the white army count)
- **Locked strip:** `⚠ PREMIUM FEATURE ONLY` warning glyph in gold,
  `UPGRADE PROFILE` button filled gold
- **`/dashboard/chads` page:** pending tiles get gold border + gold
  glow + gold handle text
- **Public profile `BUILDER-HANDOFF` line:** "Pending count colored
  gold so it pops when there's something waiting"
- **Modal phase 9 (`no-profile`):** themed gold

This is consistent within Cowork's set, and gold-as-attention is a
common UI pattern. But it dilutes the "tier 3 means EXPERIENCED" signal
across the platform. If a Tier 3 user lands on `/dashboard/chads`
with a pending request, they see gold borders on pending tiles AND
their own tier-3 gold pill — two different meanings.

**Recommendation:** ratify if you're OK with gold meaning
"tier-3 OR action-required-attention." Coordinator call.

### 2. `.topbar-logo` decorative gradient

`wireframes/lastproof-chad-army.html:77` and `wireframes/lastproof-dashboard-chads.html:76`:

```css
.topbar-logo {
  background: linear-gradient(135deg, var(--accent), var(--gold));
}
```

The "L" logo tile uses an orange-to-gold gradient. Visually attractive
but uses `--gold` decoratively (not as tier signal). Production's
shipped Topbar uses an `<img>` so this is wireframe-only — won't
survive the React port. Flag included for completeness, not action.

### 3. `.chad-av.g1` avatar gradient uses literal `#a78bfa` (= `--purple`)

`wireframes/lastproof-profile-public.html:187`:

```css
.chad-av.g1 { background: linear-gradient(135deg, #5e3a8a, #a78bfa); }
```

The chad-army strip's avatar gradient palette is a 5-color cycle
(`g0` orange → `g1` purple → `g2` blue → `g3` green → `g4` red).
Same vibrant per-slot pattern that I caught and replaced on the
Grid wireframe earlier. **Per Kellen's decision on the Grid:** avatars
should render the chad's actual profile photo when available, with
a neutral dark fallback gradient for those without a photo (matches
homepage `.result-avatar` + `.result-avatar-img` pattern).

**Recommendation:** during React port, swap the per-slot gradient
classes for:

```tsx
{chad.avatarUrl
  ? <img className="chad-av chad-av-img" src={chad.avatarUrl} alt={chad.handle} />
  : <div className="chad-av">{chad.initials}</div>
}
```

Where `.chad-av` (no modifier) defaults to the neutral dark gradient
(`linear-gradient(135deg, #2a2d42, #161822)` — same as homepage), and
`.chad-av-img` strips the gradient bg so the photo fills cleanly.
Keeps tier color reservations intact, matches user's preference from
the Grid pass.

---

## Components to extract during the React port

The wireframes already telegraph the right component boundaries.
Co-locate these under `src/components/profile/` and `src/components/chad/`
(new folder). Don't inline these — Cowork's CSS is shared across pages
and will drift if duplicated.

### `<ChadArmyStrip />` — public profile section

- Sits between `<TrustTierBar />` and `<ProfileTabs />` in
  `src/app/(marketing)/profile/[handle]/page.tsx`
- Props: `{ handle: string; chads: ChadSummary[]; armyCount: number }`
- Renders: `// CHAD ARMY` section title + horizontal avatar row +
  SEE ARMY pill (when armyCount > 0; section hides at 0)
- Avatars: max 10, link each to `/@<handle>` same tab
- Imports `<ChadAvatar />` (see below) for each tile

### `<ChadAvatar />` — single avatar tile

- Used in both `<ChadArmyStrip />` (public profile) and chad-card lists
  (army page, dashboard-chads page)
- Props: `{ avatarUrl?: string | null; initials: string; handle: string; size?: number }`
- Conditional render: `<img>` when avatarUrl present, `<div>` with
  initials otherwise
- Apply CSS class `.chad-av` always; add `.chad-av-img` modifier when
  rendering the `<img>` form (strips gradient bg)
- **No per-slot gradient palette in production** — see token deviation #3

### `<AddChadButton />` + `<AddChadModal />` — paired

- `<AddChadButton />` is the static `+` pill that lives in
  `.pp-id-handle-row` next to `<ShareIconButton />`. Same render for
  every viewer (per locked decision #1). Click opens
  `<AddChadModal target={handle} />`.
- `<AddChadModal />` owns the entire 10-phase state machine. Single
  modal component, internal state machine (XState or a discriminated
  reducer — implementer's call). Phase resolver hits
  `GET /api/chads/eligibility?target=<handle>`.
- **Phase 8 (free upgrade) shares purple theme with `<UpgradeModal />`**
  — extract shared CSS variables (`--purple-dim`, `--purple-glow`,
  `pulsePurple` keyframe) to `globals.css` so both modals can use
  them. **If you touch the upgrade modal's purple, keep them in sync.**

### `<ChadManagementStrip />` — dashboard summary card

- Used on `lastproof-dashboard.html` AND `lastproof-dashboard-fresh.html`
  — the CSS is currently duplicated verbatim across both files
  (`~50 lines × 2`). Extract this immediately or the two will drift.
- Props: `{ pendingCount: number; armyCount: number; tier: Tier }`
- Internal branch: PREMIUM variant (default) vs LOCKED variant
  (`tier === 5`, i.e., free) — locked variant swaps title to dim,
  counts to `⚠ PREMIUM FEATURE ONLY` notice, MANAGE → button to
  UPGRADE PROFILE button
- Sits between `<StatusBar />` and `<IdentityCard />` on both
  dashboards

### `<ChadCard />` — list-tile component

- Used on `/@<handle>/chads` (public army page) AND `/dashboard/chads`
  (management page) — same `.chad-card` shape, different action sets
- Props: `{ chad: ChadProfile; status?: 'pending' | 'accepted'; actions?: 'none' | 'accept-deny' | 'remove' }`
- Public army page: `actions='none'`, no buttons, whole tile is a
  link to `/@<handle>`
- Dashboard pending: `actions='accept-deny'`, gold border via
  `.pending` modifier, two buttons stacked
- Dashboard army: `actions='remove'`, single REMOVE button
- All buttons MUST be DOM-siblings of the link region — clicking
  ACCEPT/DENY/REMOVE must NOT bubble into the link. `e.stopPropagation()`
  on button click handlers.

### `<ChadEmptyState />` — shared empty-state block

- Used on `/@<handle>/chads` (rare — usually unreachable since the
  public profile section hides at count=0) and `/dashboard/chads`
- Props: `{ context: 'public' | 'dashboard' }` to swap copy slightly
- Per Kellen: **no CTA button on empty state** ("copy my profile link"
  was removed). Just the icon + headline + sub-copy.

### `<InfiniteChadList />` — shared list-virtualization wrapper

- Used by both `/@<handle>/chads` and `/dashboard/chads`
- Wraps the chad-card grid + `IntersectionObserver` on the last tile
- Fires `/api/chads/list?cursor=<last_id>&type=<kind>` when last tile
  enters viewport
- **Must dedupe** — if user scrolls fast, observer can fire before
  previous fetch resolves. Guard with an `isFetching` ref.
- Empty response = natural end of list, observer goes idle (no
  explicit "end" marker)

---

## Production-side gaps for the architecture pass

Things the wireframes assume exist but production doesn't have yet.
Backend session needs to fill these.

### Routes that don't exist yet

| Route | Wireframe | Needs |
|---|---|---|
| `/@<handle>/chads` | `lastproof-chad-army.html` | New route under `(marketing)/profile/[handle]/chads/page.tsx` (or similar) — public, server-rendered |
| `/dashboard/chads` | `lastproof-dashboard-chads.html` | New route under `(marketing)/manage/chads/page.tsx` (or wherever `/manage` dashboard children land) — auth-required |

### API endpoints sketched but not implemented

```
GET  /api/chads/eligibility?target=<handle>   → { phase, viewer, target, relationshipSince }
POST /api/chads/request                       → { target: "<handle>" }
POST /api/chads/respond                       → { requester: "<handle>", action: "accept"|"deny" }
GET  /api/chads/list?cursor=<id>&type=<kind>  → cursor pagination, kind ∈ {pending, accepted, army}
POST /api/chads/remove                        → { chad: "<handle>" } — hard-deletes
```

### Database

- `chads` table — wallet-pair primary key (NOT profile IDs — graph
  is wallet-keyed so lapses hide without destroying the row, per the
  brief)
- Index considerations: probably need indexes on
  `(requester_wallet)`, `(target_wallet)`, and a uniqueness constraint
  on `(requester_wallet, target_wallet)` to enforce the brief's
  "one request per pair at a time" rule
- Lifecycle: row persists through `is_paid` / `is_published` lapses;
  `/api/chads/list` filters out chads whose profile isn't currently
  active

### Helpers / utilities likely missing

- **Chad eligibility resolver** — given a viewer wallet + target
  handle, returns one of the 10 phase keys. This is the big new
  piece. Lives somewhere like `src/lib/chads/resolve-phase.ts`.
- **Wallet-to-profile lookup** — likely already exists for the
  ambassador attribution code path, but verify; the eligibility
  resolver depends on it
- **Random-shuffle for chad ordering** — per Kellen "intentionally
  random in production." Use a seeded shuffle keyed by a daily
  rotation or per-request rng — pick whichever doesn't surprise
  cache layers
- **Avatar URL resolver for chad** — given a chad's handle, return
  their `avatarUrl` or null. If the existing profile loader already
  returns this, reuse it; otherwise add to the `chads/list` response
  shape.

### Cache strategy — open question

The public chad-army strip on `lastproof-profile-public.html` is a
high-traffic surface (operators paste profile links in DMs). Caching
strategy needs a call:

- Server-render the avatars + count into the initial HTML?
- Or render skeleton + client-fetch?

The brief says the public profile button is "fully cacheable and
wallet-agnostic." Same logic should apply to the chad-army strip
itself — it doesn't depend on the viewer. Strong candidate for ISR
or `revalidate` on the page route.

---

## Notes that aren't blockers but matter

### Phase-9 styling deserves a second look

Modal phase 9 (`no-profile`) uses gold theme. `BUILDER-HANDOFF` notes
this; flagging again because gold semantics is the elephant in the
room (see "Color-reservation extensions" above). If you keep gold for
this phase, that's another data point ratifying the broadened gold
semantic. If you ban gold from non-tier contexts, this phase needs a
new color treatment — could borrow blue (`--blue: #409eff`, currently
only used for clickable safety links) or a neutral white-on-dark.

### `chad-army-avatars` `justify-content:space-between` edge case

`wireframes/lastproof-profile-public.html:180`:

```css
.chad-army-avatars { display: flex; justify-content: space-between; flex: 1; }
```

When a profile has only 2 chads, the two avatars sit at opposite ends
of a wide row with massive empty space between. With 10 chads it
distributes nicely. Backend should consider: is there a min-count
threshold below which the strip switches to left-aligned with `gap`?
Or always pad to 10 with placeholder-empty cells? Or always
left-align with `gap` and let the SEE ARMY button float right?

Visual call. Cowork's choice was clean for the common case (5–10
chads) but degrades at edges. Worth deciding before launch.

### Modal disconnect-on-success behavior

`Phase 5` CTA reads `> DISCONNECT & BACK TO PROFILE` and triggers
both. The wallet adapter's `disconnect()` is async. Frontend-port
should:

1. Disable the button immediately (`{disabled}`)
2. Await `disconnect()`
3. Then `router.push('/@' + handle)`

Otherwise navigation can fire before the disconnect resolves, leaving
the wallet "kinda" connected on the profile page they land on.

### Modal phase toggle — wireframe-only

`wireframes/lastproof-add-chad-modal.html` has a bottom toggle that
cycles through all 10 phases for reviewer testing. **Strip this from
the React port** — it's not part of the production component. The
state machine drives phase switching from real eligibility responses,
not from a manual toggle.

### CSS duplication is a real problem

The `.chad-mgmt-*` block lives twice (already noted by Cowork). The
`.chad-card` block lives in 3 places (army page, dashboard-chads,
profile-public uses similar). When porting, the `<ChadCard />` and
`<ChadManagementStrip />` extractions are non-negotiable — duplicating
the CSS in production will cost a session of debugging the next time
one diverges.

---

## Coordinator decisions to lock before the React port

1. **Ratify or restrict the gold-as-attention extension?** Affects
   pending count colors, locked-strip warnings, dashboard-chads
   pending tile borders, modal phase 9. If ratified, update
   `CLAUDE.md § Tier system` to broaden the gold semantic.
2. **Phase-9 color call** depending on (1).
3. **Add `--purple-dim`, `--purple-glow`, `--gold-dim`, `--gold-glow`,
   `--red-dim` to `globals.css`?** Recommend yes; needed by chad
   wireframes + already implicitly needed by the upgrade modal's
   purple theme.
4. **Min-count layout for `.chad-army-avatars`** — does a 2-chad row
   space-between OK, or switch to left-aligned with gap?
5. **Cache strategy for the public chad-army strip** — ISR /
   `revalidate`, or client-fetch? (Probably ISR but architecture
   pass owns it.)
6. **Random ordering implementation detail** — fully random per
   request, or seeded daily-rotation random? Affects whether the
   list is cacheable.

---

## Files in this commit

Polish edits — wireframes only, no React code, no production CSS:

- `wireframes/lastproof-add-chad-modal.html` — `.conn-pill` radius
  swap (capsule → 6px rounded-rect)

Plus this notes doc:

- `docs/features/chad/FRONTEND-NOTES.md` — new

Wireframe polish is exempt from `§ Updates feed — commit convention`
per `CLAUDE.md` and the chad-wireframes WORKLOG entry. No
`[update:…]` prefix, no VERSION bump, no `data/updates.json` entry.
The user-visible ship lands when the architecture pass commits the
chads table + `/api/chads/*` routes + the connected React UI together.

---

## Display name + handle truncation rule (React port)

Chad tiles share row space with action buttons (`ACCEPT/DENY` or
`REMOVE`), so the meta column is narrow — especially on the 2-col
mobile grid. CSS ellipsis already truncates by pixel-width
(`overflow:hidden; text-overflow:ellipsis; white-space:nowrap` with
`min-width:0` on the flex parents), but pixel-based truncation gives
inconsistent cut points across viewports.

**React port rule** — enforce a JS-level character cap at render so
truncation is consistent regardless of column width:

- **`display_name`**: max **24 chars**, slice with `…` suffix
- **`handle`**: max **15 chars** (matches X's username limit; longer
  values shouldn't exist in practice but guard anyway)

```ts
const cap = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s;
// <div className="name">{cap(profile.display_name, 24)}</div>
// <div className="handle">@{cap(profile.handle, 15)}</div>
```

Apply everywhere chad tiles render: `ChadCard` on dashboard chads page,
`ChadAvatar` on the public army page, `AddChadModal` operator preview.

CSS ellipsis stays as the second line of defense for unusually wide
glyphs or when the parent column shrinks below the cap's pixel width.

The `lastproof-dashboard-chads.html` wireframe has one tile (Ben Fu →
Benjamin Fukuyama-Smithson, `@benfu_long_handle_test`) intentionally
left long so the ellipsis behavior is visible in the wireframe.

---

## Handoff status

**Ready for architecture.** Wireframes polished, deviations and
extensions documented, components mapped, gaps flagged. The next
session can start the chads table + adapter + API routes without
re-reading every wireframe — just walk the "Components to extract"
list against the wireframes' intended state.

— Frontend session, 2026-04-24
