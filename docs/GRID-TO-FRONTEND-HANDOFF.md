# LASTPROOF Grid — Frontend Verification Handoff

**From:** grid session
**To:** frontend session
**Date:** 2026-04-23
**Deliverable:** brand/token/styling audit of the Cowork wireframe draft
**Status:** Wireframe locked by Kellen; Frontend verifies only — do NOT redesign

---

## How to use this brief (for Kellen)

### Handing to Frontend

1. Open a fresh Frontend session
2. Paste everything below the `═══ BRIEF CONTENT FOR FRONTEND ═══` divider directly into Frontend's prompt
3. Frontend reads files on the external drive directly (it has drive access)
4. When Frontend returns a polished file, it will be saved at:
   ```
   /Volumes/LASTSHIFT/lastproof-build/wireframes/_drafts/grid/lastproof-grid-fe-verified.html
   ```
   (different filename, so we preserve the Cowork → Frontend diff)

### Critical for Frontend to hear upfront

Kellen made three intentional overrides on top of Cowork's draft. Frontend's first instinct will be to "restore" them to the Cowork brief's spec. **Don't.** These are locked:

1. **Sort is a dropdown**, not a pill row
2. **DEV Proofs is a binary toggle**, not a range slider
3. **Filter section order:** Tier → Verified → DEV Proofs → # of Proofs → Fee → Language → Timezone (Verified is at position 2)

Include this warning in the Frontend prompt. It's in the brief body below too, but it's easy to miss buried in a list.

### Frontend's earlier mental-model correction

Frontend's own [FRONTEND-GRID-HANDOFF.md](./FRONTEND-GRID-HANDOFF.md) assumed the Grid would live inside `(marketing)` inheriting Topbar/Footer/ShiftbotStrip — that assumption is now correct (we landed on marketing-aesthetic, inside `(marketing)`). But the wireframe's `.g-topbar-ref` and `.g-shiftbot-ref` are visual placeholders only — Phase 2 code will use the real inherited components. Frontend doesn't need to re-wireframe those; they should verify the GRID CONTENT (everything between the topbar ref and the shiftbot ref).

### Failure modes to watch for

- Frontend redesigns layout instead of verifying tokens/brand → push back
- Frontend reverts the 3 overrides → push back
- Frontend argues against marketing-aesthetic chrome → push back (that decision is locked)
- Frontend starts rewriting production CSS in globals.css — out of scope for wireframe verification

### Workflow

```
Kellen  →  pastes brief below to Frontend
Frontend → reads wireframe + canon docs from drive
         → audits: tokens, tier rendering, brand elements, typography, a11y, CSS prefixing, copy voice
         → saves polished version as lastproof-grid-fe-verified.html
         → reports summary of changes + any flagged items
Kellen  →  relays to grid session for final canon check
Grid    →  approves → Phase 2 build begins
         → or loops back to Kellen with revisions
```

---

<a id="frontend-brief"></a>
# ═══ BRIEF CONTENT FOR FRONTEND ═══
*Paste everything below this divider into Frontend's prompt.*

---

## Context

You're the frontend specialist on LASTPROOF. A new wireframe for `/grid` (launching 2026-05-08) was produced by Cowork from a detailed brief, then Kellen made three edits on top. Your job is a **brand / token / styling verification pass** — audit the wireframe against LASTPROOF's visual canon and either refine it in place or flag issues.

**You are verifying, not redesigning.** The layout, interactions, filter set, sort model, card anatomy, category chips, ticker, and chrome model are all locked. Your scope is brand fidelity.

---

## Three overrides Kellen locked on top of the Cowork brief

Do NOT revert these. They are intentional product decisions:

1. **Sort is a dropdown** (`Sort: Relevant ▾`), not a pill row
2. **DEV Proofs is a binary toggle** ("Only operators with DEV proofs"), not a range slider
3. **Filter section order:** Tier → Verified → DEV Proofs → # of Proofs → Fee → Language → Timezone (Verified was moved up to position #2 for discoverability)

If you think one of these should be something else, flag it to Kellen — don't silently change it.

---

## Files to read (all on the external drive)

**Primary — the wireframe you're auditing:**
- `/Volumes/LASTSHIFT/lastproof-build/wireframes/_drafts/grid/lastproof-grid.html`

**The canon brief Cowork worked from (for context on what was locked):**
- `/Volumes/LASTSHIFT/lastproof-build/docs/GRID-COWORK-BRIEF.md` — read below the `═══ BRIEF CONTENT FOR COWORK ═══` divider

**Brand / design canon:**
- `/Volumes/LASTSHIFT/lastproof-build/LASTPROOF-BUILDER-HANDOFF.md` — read §§ 2–7 (tokens, tier, brand elements, typography, components)
- `/Volumes/LASTSHIFT/lastproof-build/CLAUDE.md` — § Tier system (locked), § Updates feed convention (not applicable yet, but good to know)

**Tier rendering:**
- `/Volumes/LASTSHIFT/lastproof-build/src/lib/tier.ts` — note `formatTierLabel()` format (`TIER N · NAME`)

**Visual vocabulary to echo (the Grid is a sibling of these):**
- `/Volumes/LASTSHIFT/lastproof-build/src/app/(marketing)/profile/[handle]/profile-public.css` — profile page card + hero vocabulary
- `/Volumes/LASTSHIFT/lastproof-build/src/components/ResultCard.tsx` — homepage ResultCard
- `/Volumes/LASTSHIFT/lastproof-build/src/app/globals.css` — global tokens and shared classes

Do NOT modify any of the reference files. Read-only.

---

## Your audit checklist

### 1. Design tokens

- [ ] Every color in the wireframe uses a `var(--*)` token from the `:root` block
- [ ] No hex drift — e.g. no `#ff5555` where `var(--red)` should be, no hardcoded `#ffd700` where `var(--gold)` should be
- [ ] Tier colors: T1 → `--silver`, T2 → `--bronze`, T3 → `--gold`, T4 → `--purple`
- [ ] Orange `--orange` #ff9100 is the ONLY value used for brand accent; no `#ff8800` or `#f59500` drift
- [ ] Green `--green` #00e676 used for verified/DEV/success; no swap with emerald shades

### 2. Tier rendering

- [ ] Every tier pill renders as `TIER N · NAME` with the `·` separator (U+00B7)
- [ ] Never a bare `TIER 3` or `EXPERIENCED` alone anywhere
- [ ] `.g-tier-pill[data-tier="N"]` maps `1→silver`, `2→bronze`, `3→gold`, `4→purple`
- [ ] Tier 5 does not appear anywhere (it's the unpaid-sentinel, internal only)

### 3. Brand elements

- [ ] Wordmark in topbar ref is `LAST` (white) + `PROOF` (orange) — two-tone, mono
- [ ] `//` eyebrow prefix is orange where it appears (Filter section title, drawer title, anywhere else)
- [ ] Mono eyebrow labels: 10–11px, uppercase, 2–2.5px letter-spacing, `var(--text-dim)` or `#fff`

### 4. Typography

- [ ] Inter loaded and used for sans body
- [ ] JetBrains Mono loaded and used for mono (metrics, wallets, tickers, eyebrows, small labels)
- [ ] No all-caps in sans body copy (operator pitches must be sentence case)
- [ ] Tickers (`$BONK`, `$LASTSHFT`, etc.) rendered in green mono with bold weight

### 5. Accessibility

- [ ] Touch targets ≥44×44px on mobile (≤640px) — check filter option rows, sort dropdown items, category chips, card click areas
- [ ] Interactive elements have clear hover states
- [ ] Keyboard focus states — add `:focus-visible` outlines if missing (orange, 2px, offset)
- [ ] Drawer has proper close-on-escape behavior, focus-trap if feasible

### 6. CSS class prefix consistency

- [ ] All new classes use the `.g-*` prefix (matches existing per-page convention: `.pp-*` profile, `.help-*` help, `.mg-*` manage)
- [ ] No unscoped class collisions with `globals.css` (e.g. `.card`, `.button`, `.chip`, `.avatar` would collide — must stay `.g-card`, etc.)
- [ ] No inline styles except for placeholder demonstrative values (slider width, avatar gradient variations)

### 7. Copy voice

- [ ] Operator pitches in sample cards sound natural — App Store changelog tone, specific numbers where they belong
- [ ] No banned jargon in user-visible copy: `schema`, `API`, `endpoint`, `migration`, `backfill`, `commit`, `SHA`, `route`, `handler`
- [ ] Labels use product-locked vocabulary: `ACTIVE`, `TIER N · NAME`, `DEV`, `EA`, `> view`

### 8. Card anatomy parity with profile page

- [ ] Card avatar → name + verified ✓ + EA + ACTIVE pill row matches the profile hero pattern (scaled down)
- [ ] Meta row: `N proofs · N DEV · N projects · UTC-offset · LANG` — mono, dim, inline
- [ ] Pitch: sans, full text, not truncated
- [ ] Categories: first chip primary (orange fill), others ghost
- [ ] Right rail: tier pill → fee glyphs → `> view ↗` link
- [ ] Hover: border-color → accent, subtle bg tint, `translateX(2px)` for motion affordance

### 9. Filter interactions

- [ ] Section headers have `+` (collapsed) / `−` (expanded) caret right-aligned
- [ ] Click header toggles; animation is slide-max-height (~200ms)
- [ ] Default expand state: Tier + Fee open, others collapsed
- [ ] Checkbox rows: `.cb` shows orange fill when `.checked`
- [ ] Counts `(N)` right-aligned on every filter option
- [ ] Verified toggle has a proper switch UI (not a checkbox)
- [ ] Range slider (# of Proofs only now) has fill, thumb, scale markers, live caption

### 10. Ticker + category chips

- [ ] LIVE ticker: 32px height, `LIVE` label pinned left with pulse, fade gradients both edges, 60s infinite `translateX(-50%)` scroll
- [ ] Ticker color semantics: wallet dim, proof green, operator orange, ticker green, time dim, DEV orange pill
- [ ] All 15 category chips present + `ALL` chip (= 16 total), wrapped (not scrolled) on desktop
- [ ] Counts render in each chip; active state is orange-fill

---

## What is explicitly OUT of scope

- Don't redesign the layout
- Don't re-wireframe the Topbar or ShiftbotStrip (`.g-topbar-ref` and `.g-shiftbot-ref` are placeholders; Phase 2 uses real inherited components)
- Don't add or remove filters or sort options
- Don't change the chrome model (marketing-aesthetic is locked)
- Don't touch the 3 Kellen overrides (sort = dropdown, DEV = toggle, section order)
- Don't write production code (this is a wireframe)
- Don't decide on backend integration, ranking math, or data loading — all Phase 2 concerns
- Don't modify any of the reference files in `src/` or `docs/` — read-only

---

## Deliverable

**Save your polished version at:**
```
/Volumes/LASTSHIFT/lastproof-build/wireframes/_drafts/grid/lastproof-grid-fe-verified.html
```

**Do NOT overwrite** `lastproof-grid.html` — we preserve the Cowork draft separately so we can diff the changes.

If you flag issues rather than fix them, embed them as HTML comments at the top of the file:
```html
<!-- FLAGGED FOR KELLEN: filter row touch targets are 36px on mobile — needs scale-up at ≤640px -->
```

Or return them as a bulleted list in your reply to Kellen.

**When done, tell Kellen:**
1. The file is saved at the path above
2. Short summary of what you changed
3. Any unresolved items flagged for Kellen's decision

---

*Brief prepared by the grid session, 2026-04-23. Frontend verifies only — does not redesign. Kellen approves the final before the grid session starts Phase 2 code.*
