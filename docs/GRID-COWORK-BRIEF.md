# LASTPROOF Grid — Cowork Wireframe Brief

**Project:** LASTPROOF — Web3 operator discovery + verification platform on Solana
**Live site:** https://lastproof.app
**Deliverable:** Static HTML wireframe of `/grid` at desktop + mobile breakpoints
**Launch target:** 2026-05-08

---

## How to use this brief (for Kellen)

### Handing to Cowork

Cowork starts with **no context** about this drive, our repo, or this session. Give it what it needs explicitly.

1. **Paste the brief body** (everything below the `BRIEF CONTENT FOR COWORK` divider) directly into Cowork's prompt. Don't try to point Cowork at a drive path — it probably can't read your drive.
2. **Add this one line to the end of Cowork's prompt:**
   > *"Output a single file named `lastproof-grid.html`. Don't save it anywhere — just hand the HTML back to me in the chat. I'll save it to the drive myself."*

### Saving Cowork's output to the drive

Wireframes for the repo are organized like this:

```
lastproof-build/wireframes/
├── <canonical wireframes at root>   ← shipped, referenced across docs, DON'T move
├── _drafts/                          ← work-in-progress wireframes (Cowork output)
│   ├── README.md                     ← folder convention
│   └── grid/                         ← Grid session's drafts
└── _archive/                         ← superseded wireframes (promoted-out of canon)
```

When Cowork returns HTML, save it here (exact path):

```
/Volumes/LASTSHIFT/lastproof-build/wireframes/_drafts/grid/lastproof-grid.html
```

Do **not** save it at the `wireframes/` root. The root is reserved for canonical/shipped wireframes. Only after the grid session approves + Frontend polishes does a draft get promoted up to the root (simple `mv`, handled by the grid session on build).

### Cowork failure modes to watch for

If any of these appear in Cowork's output, send it back for revision — don't accept as-is:

- **Terminal chrome sneaks in.** Scanlines, macOS titlebar dots, mono-everywhere, cascading boot-lines, CRT overlays. The brief explicitly forbids these but Cowork may default to them because the vibe "feels" right for a Web3 app.
- **Categories get simplified to 5–6.** Cowork may think 15 "feels too many" and truncate the list. All 15 must be there.
- **New top-bar SHIFTBOT UI gets designed.** SHIFTBOT lives in the inherited `ShiftbotStrip` at the bottom. Cowork should show that for reference, not build a new one.
- **Tier labels drift.** If any card says "TIER 5" or "TRUSTED" instead of the locked 4-tier `TIER N · NAME` format, it's wrong.
- **Cards carry a HIRE button.** The spec is view-first — cards route to `/@handle`, HIRE lives on the profile page.

### Workflow

```
You (Kellen)  →  paste brief to Cowork
Cowork        →  returns lastproof-grid.html to you in chat
You           →  save to /Volumes/LASTSHIFT/lastproof-build/wireframes/lastproof-grid.html
You           →  ping grid session ("Cowork's done, review it")
Grid session  →  reads from drive, audits for canon adherence
                 → approves → you hand to Frontend session
                 → or sends revision notes → back to Cowork
Frontend      →  verifies brand tokens, CSS prefixes, typography, etc.
                 → returns polished wireframe
You           →  final approval → grid session builds Phase 2
```

---

<a id="cowork-brief"></a>
# ═══ BRIEF CONTENT FOR COWORK ═══
*Paste everything below this divider into Cowork's prompt.*

---

## Context (60-second read)

LASTPROOF lets Web3 marketers build on-chain-verified profiles. The Grid is the discovery page where devs and hiring parties find operators. It's a public page (no login, free to browse) and replaces the current `/grid` locked-placeholder.

Think **Behance for Web3 operators** — faceted ecommerce-style filter page. 15 category "departments" across the top, a filter sidebar on the left, sort pills on the right, and an infinite-scroll single-column card feed. Marketing-aesthetic, not terminal-themed.

---

## Visual baseline

Your wireframe must feel like a natural sibling to these existing LASTPROOF pages:

- **Profile page:** https://lastproof.app/@lastshiftfounder — the trust vocabulary (tier bar, verified check, status pill, HIRE button) lives here
- **Homepage:** https://lastproof.app — the card pattern (`.wall` section) and category chip row (`.cats`) already exist there; the Grid expands and deepens them

**Design language:**
- Dark theme, flat cards, minimal 1px borders
- Sans-serif body (Inter); mono (JetBrains Mono) reserved for metrics, wallets, tickers, small labels
- Orange brand accent (#ff9100), green for verified/money/success, grey-dim for meta
- Subtle hover affordances (border-color shift, faint bg tint)

🚫 **Do NOT use terminal chrome** — no scanlines, no macOS-window traffic-light dots, no mono-everywhere, no cascading boot lines, no CRT effects. An archived April 2026 wireframe used terminal chrome; that direction is dead. The Grid is a discovery page, not a CLI.

---

## Desktop layout (1280px)

```
┌─────────────────────────────────────────────────────┐
│ TOPBAR (inherited from marketing layout, for ref)  │
├─────────────────────────────────────────────────────┤
│ LIVE ticker (slim 32px, scrolling proof events)    │
├─────────────────────────────────────────────────────┤
│ CATEGORY CHIPS (horizontal row, 15 + ALL)          │
├────────────┬────────────────────────────────────────┤
│            │ [Relevant][Most Trusted][High][Low]   │
│  FILTER    ├────────────────────────────────────────┤
│  SIDEBAR   │  ┌──────────────────────────────────┐ │
│  (~240px   │  │ Card 1 (full-width)              │ │
│   sticky,  │  └──────────────────────────────────┘ │
│   own      │  ┌──────────────────────────────────┐ │
│   scroll)  │  │ Card 2 (full-width)              │ │
│            │  └──────────────────────────────────┘ │
│            │  ... infinite scroll                   │
├────────────┴────────────────────────────────────────┤
│ SHIFTBOT STRIP (inherited, bottom, expandable)     │
└─────────────────────────────────────────────────────┘
```

---

## Component specs

### LIVE ticker (top)
- Height 32px, slim strip
- Green `LIVE` mono label, left-pinned, sticky against a left-edge fade gradient
- Items scroll right → left on infinite loop: `[wallet-short] proof [operator name] on [$TICKER] [DEV?] [Nm ago]`
- Mono 10px. Color semantics: wallet = text-secondary, action "proof" = green, project = orange, time = dim, DEV = orange-tint rounded pill (2px radius, 8px uppercase)
- Left + right 40px fade gradients so items appear/disappear softly
- Infinite CSS animation via `translateX(-50%)` on duplicated track

### Category chips
- Single horizontal row of 16 chips: `ALL` (leftmost, active by default) + 15 category labels
- Order: `ALL`, then 15 categories sorted by **usage count descending** (most-used first)
- Active chip: orange background, `--bg-primary` text
- Inactive: ghost style with 1px `--border`, text-secondary
- Clicking a chip applies the category filter and makes the chip active
- Horizontal scroll on overflow (narrow viewports)

### Sort pills (above card list)
Single-select pill row, **4 options**, one active at a time:

| Pill | Rule |
|---|---|
| `Relevant` (default) | `tier DESC → proofs DESC → is_verified DESC` |
| `Most Trusted` | `tier DESC → proofs DESC` (pure ladder; verified tiebreaker removed) |
| `High Fee` | `fee DESC` ($$$$ first) |
| `Low Fee` | `fee ASC` ($ first) |

Active pill: orange border + faint bg tint. Inactive: grey border, text-secondary.

**Distinction note:** `Relevant` and `Most Trusted` differ only in the verified tiebreaker. `Most Trusted` = clean tier ladder sorted by proofs. `Relevant` adds a small editorial bump so ✓-verified profiles break ties in their favor.

There is no "New Profiles" sort — new profiles don't get visibility preference in LASTPROOF; they earn placement through proofs.

### Filter sidebar (left)
- Width ~240px, sticky top (below topbar + ticker), with **independent vertical scroll** when content exceeds viewport height
- **7 collapsible sections** (see order below); each section has a header + `+` (collapsed) / `−` (expanded) icon on the right
- Clicking header OR icon toggles — slide-collapse animation ~200ms
- **Default state on page load:** `Tier` + `Fee` expanded, other 5 sections collapsed
- Each filter option row: label left, `(count)` right — counts update live as other filters apply (faceted search)
- Top of sidebar: `Clear all` text link, visible only when ≥1 filter is active
- Selected filters appear as chips at the top of the main content area with `× remove`

**Sections in order:**

1. **Tier** — 4 checkboxes, each with a colored dot matching the tier token
   - ◻ `TIER 4 · LEGEND` (50+ proofs) — purple dot
   - ◻ `TIER 3 · EXPERIENCED` (25–49) — gold dot
   - ◻ `TIER 2 · VERIFIED` (10–24) — bronze dot
   - ◻ `TIER 1 · NEW` (0–9) — silver dot

2. **# of Proofs** — range slider (minimum threshold only)
   - Scale: 0 to max observed on the Grid; snap to clean values (0, 10, 25, 50, 100+)
   - Live count caption: `Operators with N+ proofs: X`

3. **DEV Proofs** — range slider (minimum threshold only)
   - Scale: 0 to max observed; snap to clean values (0, 1, 3, 5, 10+)
   - Live count caption: `Operators with N+ DEV proofs: X`
   - Note: DEV proofs are the highest-trust signal on LASTPROOF — on-chain verification signed by project deployers / mint authorities / first-5 holders. Devs filter by this when they want operators with verified track records on real launches.

4. **Fee** — 4 checkboxes
   - ◻ `$` / ◻ `$$` / ◻ `$$$` / ◻ `$$$$`

5. **Language** — checkboxes listing every unique language present on profiles, with counts
   - Show top 6 by default; `More languages` expands the full list

6. **Timezone** — checkboxes listing every unique UTC offset / city label used by profiles, with counts
   - Example row: `UTC-5 · NEW YORK (22)`
   - Scrollable list — can be long

7. **Verified** — single toggle
   - ◻ `Only verified operators (✓)` — restricts to profiles with both X AND Telegram verified

### Card (single-column, full-width)

```
┌─────────────────────────────────────────────────────────┐
│ [Avatar]  CryptoMark ✓ EA ACTIVE              TIER 3   │
│           47 proofs · 3 DEV · 50 projects · UTC-5 · EN │
│                                                   $$$   │
│           Three years in the trenches of web3          │
│           marketing. Taken projects from zero to 15K   │
│           organic followers on X...                    │
│           [X Growth] [Raid Leading] [Community Mgmt]   │
│                                            > view ↗    │
└─────────────────────────────────────────────────────────┘
```

- **Click anywhere on the card** → opens `/@handle` in a **new tab** (`target="_blank"`). Grid state preserved.
- Avatar: 48–60px square (initials gradient fallback, or image)
- Top row: name + verified checkmark ✓ (if both X + TG verified) + `EA` badge (if early adopter) + `ACTIVE` pill on the left; tier pill right-aligned
- Meta row: `N proofs · N DEV · N projects · UTC-offset · LANG` — mono, text-dim, inline on a single line
- Pitch: sans-serif, full text (NOT truncated — wide cards allow it)
- Categories: up to 3 chips; first = primary (orange fill), others = ghost
- Right rail: tier pill (color per canon — T1 silver, T2 bronze, T3 gold, T4 purple) → fee range in mono → `> view ↗` link in green
- Background `--bg-secondary`, `--border` 1px
- Hover: border-color → accent, faint bg tint, small `translateX(2px)`

---

## Mobile layout (≤640px)

- Topbar + ticker remain (ticker may shrink or hide `LIVE` label)
- Category chips: horizontal scrollable row (same as desktop)
- Sort pills: horizontal scrollable row
- **Filter sidebar collapses into a `[Filters (N)]` button** at the top of the main area; `N` = active filter count
- Tapping `[Filters]` opens a **full-height slide-in drawer from the right** (ecommerce shopping-cart style)
- Drawer layout:
  - Close `×` top-right
  - Same 7 filter sections
  - `Clear all` text link (if any active)
  - `Apply (N results)` orange button pinned at the bottom of the drawer
- Cards: full-width; fields wrap naturally; meta row may break to two lines

---

## Design tokens (use verbatim)

```css
:root {
  /* Background */
  --bg-primary:    #0a0b0f;
  --bg-secondary:  #12131a;
  --bg-card:       #161822;
  --bg-card-hover: #1a1d2a;
  --border:        #1e2030;
  --border-2:      #2a2d3f;

  /* Text */
  --text-primary:   #e2e4ed;
  --text-secondary: #8b8fa3;
  --text-dim:       #5a5e73;

  /* Brand */
  --orange: #ff9100;   /* primary accent, CTAs */
  --green:  #00e676;   /* verified, success, money */
  --red:    #ff5470;   /* errors */
  --blue:   #409eff;   /* secondary links */

  /* Tier colors — do NOT swap */
  --silver: #9ca3af;   /* TIER 1 — NEW */
  --bronze: #cd7f32;   /* TIER 2 — VERIFIED */
  --gold:   #ffd700;   /* TIER 3 — EXPERIENCED */
  --purple: #a78bfa;   /* TIER 4 — LEGEND */

  /* Fonts */
  --sans: "Inter", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;

  /* Radii */
  --r-sm:   3px;
  --r-btn:  6px;
  --r-card: 10px;
  --r-pill: 999px;
}
```

---

## Tier canon (LOCKED — do not modify)

**4 tiers only. No T5. Always render as `TIER N · NAME`, never the number alone.**

| Tier | Name | Proof threshold | Color token |
|---|---|---|---|
| 1 | NEW | 0+ | `--silver` |
| 2 | VERIFIED | 10+ | `--bronze` |
| 3 | EXPERIENCED | 25+ | `--gold` |
| 4 | LEGEND | 50+ | `--purple` |

Rules:
- Tier number and name are always paired via the `·` separator: `TIER 2 · VERIFIED`
- Never use green for a tier label (reserved for DEV / verified / money)
- Never use orange for a tier label (brand accent only)
- Free-variant profiles (unpaid or unpublished) never appear on the Grid and carry no tier UI

---

## Visibility rule (LOCKED)

The Grid shows **ONLY ACTIVE operators**:

- `is_paid = true` AND
- `published_at IS NOT NULL` AND
- Not the stripped free-variant

Free profiles, unpublished profiles, and defunct profiles **never appear** on the Grid.

---

## Non-negotiables

1. **Wireframes win.** This brief is canon. If you disagree with a decision, flag back to Kellen — don't silently change it.
2. **Do NOT wireframe a new SHIFTBOT UI** at the top of the page. SHIFTBOT lives in the existing `ShiftbotStrip` component — bottom of the page, expandable, inherited from the marketing layout. Show it at the bottom of your wireframe for layout reference only; do not redesign it.
3. **Tier canon locked at 4 tiers.** The archived April 2026 wireframe used a dead 5-tier system. Do not copy it.
4. **Cards open in a new tab** (`target="_blank"`) to `/@handle`.
5. **No terminal chrome.** Dark theme, yes — scanlines / titlebar traffic-lights / mono-everywhere / boot lines, no.
6. **Provide both breakpoints** in the deliverable: 1280px desktop + 390px mobile.
7. **Echo the profile page visual vocabulary** (https://lastproof.app/@lastshiftfounder).

---

## Explicitly out of scope

- Don't wireframe the Topbar, Footer, or ShiftbotStrip — all inherited from the marketing layout; show them for reference only
- Don't redesign brand tokens, colors, or fonts
- Don't specify backend queries, ranking math, or data-loading behavior — all Phase 2 concerns
- Don't design variants of the profile page (already shipped)
- Don't propose a terminal-themed alternative

---

## Deliverable

- **One static HTML file:** `lastproof-grid.html`
- Embedded CSS using the tokens above
- **Both breakpoints visible** — either side-by-side frames OR a viewport-size toggle: 1280px desktop + 390px mobile
- **Light JavaScript** enough to demonstrate UX:
  - Filter section expand / collapse
  - Sort pill active-state switching
  - Mobile filter drawer open / close
  - Category chip active-state switching
  - No real data loading required
- **8–12 sample cards** with placeholder content. Mix:
  - Tiers (at least one T4, two T3, two T2, one T1)
  - Several with the `EA` badge
  - A couple with no DEV proofs to show that state
  - A T1 with 0 proofs to show the minimum-state card
- **No backend, no API, no real data** — everything inline
- Return the file to Kellen when done

---

*Brief prepared by the grid session, 2026-04-23. Hand to Cowork verbatim; Cowork returns to Kellen; Kellen hands to the grid session for canon-adherence review; grid session hands to Frontend for brand-token verification; Frontend hands back to Kellen; Kellen approves; grid session builds.*
