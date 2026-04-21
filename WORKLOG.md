# LASTPROOF — Work Log

Perpetual, append-only session log. **Newest entry at the top.** Every Claude
session touching this repo reads the top of this file before work, and writes a
new entry at the top when a work block ships. See `CLAUDE.md § Session protocol`
for the rules.

This log is one of a pair:

- `WORKLOG.md` (this file) — LASTPROOF repo, covers LASTPROOF work
- `lastshiftcoin/lastshift-terminal` → `WORKLOG.md` — Terminal repo, covers Terminal work

When a change in one repo impacts the other (shared contract, shared secret,
API signature, wallet/TID handshake), note it on the `**Impacts:**` line of
your entry. The other platform's next session will see the pointer and read
the linked entry before touching related code.

When this file exceeds ~500 lines, roll the oldest half into
`WORKLOG-ARCHIVE.md` and keep only the recent entries here.

---

## 2026-04-21 01:02 MST — Terminal ID format corrected: no SHIFT- prefix

**Device:** Kellen's Mac mini (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Role:** help-page
**Commits:** this entry
**Migrations run in prod Supabase:** none
**Impacts:** Terminal session reciprocally updated `terminal-build/CLAUDE.md`
+ confirmed canonical format via their `generateTerminalId()` — cross-session
format alignment complete. Notes at end of this entry.
**Status:** ✅ shipped, 2 files changed, larger scope flagged (not fixed)

### Did

- Kellen caught me using `SHIFT-XXXX-XXXX-XXXX-XXXX` as the Terminal ID
  format across the `/help` wireframe. Cited it against my training source.
  I'd picked it up from `terminal-build/CLAUDE.md` + this repo's
  `CLAUDE.md` test-seed note.
- Relayed a cross-session message through Kellen to the Terminal builder.
  They confirmed: production `generateTerminalId()` outputs
  **`XXXX-XXXX-XXXX-XXXX-XXXX`** — 5 groups of 4 alphanumeric chars, no
  fixed prefix. `SHIFT-` was a wireframe/doc artifact that never shipped.
  Terminal builder updated their `CLAUDE.md` on their side.
- Per Kellen's explicit narrow-scope instruction ("fix the place you got
  the understanding... then update your wireframe. thats it."), made
  exactly two targeted changes:
  1. `CLAUDE.md` — replaced the bare "TID `SHIFT-TEST-0001-0001-0001`"
     seed note with a full Terminal-ID-format section that documents the
     real production format, marks `SHIFT-` as a legacy artifact, explains
     the dual-accept regex in `/api/auth/register-tid`, and flags the
     `/api/auth/validate-tid` regex-mismatch bug (not fixed — see below).
  2. `wireframes/help.html` — replaced all 5 occurrences of
     `SHIFT-XXXX-XXXX-XXXX-XXXX` with `XXXX-XXXX-XXXX-XXXX-XXXX`
     (hero TID display, step-02 caption, step-02 copy, FAQ "What's a
     Terminal ID?" answer, and the JSON-LD schema answer text).
- Nothing else touched. Preview-verified: http://127.0.0.1:8765/help.html
  HTTP 200, 100,224 bytes.
- No grep matches remain for `SHIFT-` in `wireframes/help.html`.

### Production bug flagged, NOT fixed

During the investigation I found a real production mismatch and
explicitly left it alone per Kellen's scope narrow:

- `src/app/api/auth/validate-tid/route.ts:29` uses ONLY the legacy
  `^SHIFT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$` regex.
- `src/app/api/auth/register-tid/route.ts:39-40` uses a dual-accept
  regex (both real and legacy formats).
- `src/app/(marketing)/manage/ManageTerminal.tsx:287-288` uses the same
  dual-accept as register-tid.

**The result:** any real Terminal TID hitting `/api/auth/validate-tid`
will 400-reject with `tid_malformed`. It's silently blocking production
auth flows that go through that endpoint. I drafted a regex fix during
the session (dual-accept matching register-tid's pattern) but reverted
it per scope narrow. Flagged here so another session picks it up.

### Current state

- 2 files modified: `CLAUDE.md`, `wireframes/help.html`.
- `validate-tid/route.ts` reverted to unchanged.
- `wireframes/help-CONTENT.md`, `wireframes/manage-wallet-auth-flow.html`,
  `wireframes/manage-profile-dashboard-entry.html`, `docs/TERMINAL-*.md`,
  and `memory/project_lastproof_terminal_ecosystem.md` still carry
  `SHIFT-XXXX-XXXX-XXXX-XXXX` references — **intentionally not touched**
  per Kellen's narrow-scope instruction. Future session can sweep these
  if desired.
- Test fixtures, seed SQL, mock terminal, soak/smoke scripts all retain
  legacy `SHIFT-TEST-*` strings — valid under the dual-accept regex.

### Open / next

- **validate-tid regex bug fix** (see above) — not fixed, flagged here.
  Fix is a 4-line dual-accept pattern matching register-tid. Needs a
  fullstack/backend session to execute + test.
- Remaining `SHIFT-` cleanup across other wireframes + docs + memory —
  not requested.
- The original `/help` wireframe productionization still pending from
  prior entries.

### Gotchas for next session

- **Terminal ID format is `XXXX-XXXX-XXXX-XXXX-XXXX`** (5 groups of 4
  alphanum, no prefix). Confirmed by Terminal builder 2026-04-21. Don't
  reintroduce the `SHIFT-` prefix in new wireframes, code, or docs.
- **`SHIFT-` in existing test fixtures is fine** — the dual-accept regex
  covers them for backward-compat with seed data.
- **`/api/auth/validate-tid` regex mismatch** is a real bug; don't
  assume auth flows through that endpoint work in production until
  the regex is fixed.

---

## 2026-04-21 00:28 MST — /help: global topbar match + scrub "how it works" framing

**Device:** Kellen's Mac mini (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Role:** help-page
**Commits:** this entry
**Migrations run in prod Supabase:** none
**Impacts:** none — wireframe + content doc only, no code changes, no Terminal touches
**Status:** ✅ shipped, preview verified at http://127.0.0.1:8765/help.html (HTTP 200)

### Did

- **Replaced `/help` topbar with the homepage global header verbatim**
  so there's one consistent site-wide header. Kellen was specific: the
  prior custom header ("HELP · GETTING STARTED" sub + custom 5-link nav)
  was out of place. Now matches `wireframes/homepage.html`:
  - Logo tile (SHIFTBOT PNG with inline-CSS fallback tile for wireframe
    previews — frontend builder will wire `/public/shiftbot-logo.png`
    in prod)
  - Brand: `LAST` (white) + `PROOF` (orange)
  - Sub-label: `VERIFIED OPERATORS` (homepage brand tagline — kept
    consistent across site, not page-specific)
  - Centered ticker: `$LASTSHFT $0.00012 -2.7%`
  - Right side: `topbar-nav` with single `HOW IT WORKS` link + `MANAGE
    PROFILE` ghost button
  - Position: `relative` (not sticky — matches homepage exactly)
- **Adjusted tab-bar sticky offset** from `top:60px` → `top:0` since the
  topbar is no longer sticky; the tab bar now sticks flush to viewport
  top once scrolled past. Added `backdrop-filter: blur(8px)` on the tab
  bar so content scrolling behind it reads correctly.
- **Mobile topbar rules** now mirror homepage responsive pattern exactly
  (topbar becomes 2-column with ticker wrapping to row 2 on <900px,
  `topbar-nav` hides on mobile).
- **Scrubbed "how it works" framing from the help page:**
  - `<title>`: `LASTPROOF — Help / How It Works` → `LASTPROOF — Help`
  - `<meta description>`: added "Separate from the /how-it-works
    marketing page." so crawlers and future edits don't conflate
  - Hero eyebrow: `HELP · HOW IT WORKS` → `HELP CENTER · GET UNSTUCK`
  - CSS comment: scrubbed reference to "matches homepage / how-it-works"
    → "matches homepage global chrome"
  - Kept: the `<a href="/how-it-works">HOW IT WORKS</a>` nav link — it
    legitimately navigates TO the separate page, which is the behavior
    the global header has on every page
- **Renamed content doc** `wireframes/how-it-works-CONTENT.md` →
  `wireframes/help-CONTENT.md` via `git mv` (history preserved).
  Added top-of-doc warning callout: "This document is for /help ONLY.
  It is NOT about /how-it-works..." to stop the naming confusion from
  creeping back in.
- **Content doc scrubs:**
  - Entry Points table: Homepage link label `"How it works →"` → `"Need
    help? →"` (it's the link text shown on homepage leading TO the help
    page — "how it works" there is a category error)
  - Design Notes: `Chrome: match /manage — full terminal chrome...` →
    updated to describe the homepage global header (the current truth
    per wireframe v3)
  - Screenshot capture protocol: `/public/how-it-works/` → `/public/help/`
    with explicit note that the how-it-works path is owned by the
    separate marketing page
- **Verified no stray "HOW IT WORKS" text remains** in the help-page
  body — the only match is the legit global-header nav link.

### Current state

- `wireframes/help.html` — 1,601 lines, global topbar matches homepage
  1:1, no "how it works" framing anywhere in the body content, FAQ
  search + isolated tabs + 6 topic panels all still working.
- `wireframes/help-CONTENT.md` — renamed + scrubbed, with a permanent
  warning callout at the top to prevent regression.
- Preview: http://127.0.0.1:8765/help.html (HTTP 200, 100,229 bytes).
  Server `b3pu52zas` still backgrounded from prior task.
- No code changes, no migrations, no Terminal impact.

### Open / next

- **Screenshot capture** still pending (same as prior entries).
- **Link /help from every Terminal-ID prompt** per Entry Points table.
- **Frontend builder productionization** at
  `src/app/(marketing)/help/page.tsx`. When they build it, they'll
  wire the real `shiftbot-logo.png` asset + real `$LASTSHFT` ticker
  hook (same one used across other pages).

### Gotchas for next session

- **"How it works" is a sibling, not a synonym.** `/how-it-works` =
  marketing explainer (`src/app/(marketing)/how-it-works/page.tsx`,
  `wireframes/how-it-works.html`, for prospective users). `/help` =
  help center for stuck users (`wireframes/help.html`,
  `wireframes/help-CONTENT.md`, not yet in code). Two pages, two
  purposes. Don't merge them.
- **Global header is source-of-truth on homepage.html.** If the
  global header changes site-wide (new nav link, different ticker
  data), update homepage first, then cascade to /help. When
  productionizing, the frontend builder should factor this into the
  `(marketing)` layout rather than duplicate the markup per page.
- **Content doc renamed** — anyone searching for
  `how-it-works-CONTENT.md` won't find it. Git history tracks the
  rename (use `git log --follow wireframes/help-CONTENT.md`).

---

## 2026-04-21 00:08 MST — /help wireframe v2: standard page chrome + real tabs

**Device:** Kellen's Mac mini (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Role:** help-page
**Commits:** this entry
**Migrations run in prod Supabase:** none
**Impacts:** none — wireframe-only, no code changes, no Terminal touches
**Status:** ✅ shipped, preview verified at http://127.0.0.1:8765/help.html (HTTP 200)

### Did

- Rewrote `wireframes/help.html` per Kellen's feedback on the first
  version. Three structural changes:
  1. **Dropped terminal chrome entirely.** No more system-bar,
     titlebar (`help — lastproof — 80x24`), CRT scanlines,
     vignette, or bottom-bar. Now matches the site-standard page
     treatment (profile, dashboard, homepage, how-it-works):
     sticky topbar + grid-pattern body background + orange radial
     glow + standard `max-width:1100px` content column.
  2. **Anchor-nav → real tabs.** Sticky tab bar under the Quick
     Answers block with 6 tabs: `01 Profile Creation ·
     02 Verify Work · 03 Updating Profile · 04 Profile Status ·
     05 FAQ · 06 Contact`. Orange underline + accent on active tab,
     subtle hover state, horizontal scroll on mobile, keyboard
     navigation (arrow keys), `role="tablist"` + `aria-selected`
     for a11y.
  3. **Tab click isolates content.** Only the active tab's panel
     renders (`.tab-panel.active { display:block }`, others hidden
     via CSS + `hidden` attribute). Same UX pattern as the existing
     `/how-it-works` page (`useState("dev" | "op" | "verify")`).
     Hash sync (`#profile-creation`, `#faq`, etc.) so users can
     deep-link to a specific tab. Initial load with hash activates
     the right tab without a scroll-jump.
- **Topbar** now matches other pages: logo tile + LASTPROOF
  two-tone brand + HELP · GETTING STARTED sub + $LASTSHFT ticker
  in the center + nav links on the right (HOME / GRID / HOW IT
  WORKS / HELP (active) / /MANAGE →). Sticky, backdrop-blurred.
- **Hero** is site-standard: centered eyebrow + H1 + lead + two
  CTAs (LAUNCH TERMINAL primary / GO TO /MANAGE ghost) + microcopy.
  No more terminal-chrome-hero treatment.
- **Quick Answers** block sits above the tabs and stays always
  visible — top-3 blockers with inline jump-to-FAQ link (uses
  `data-jump-tab="faq"` to activate the FAQ tab in-place).
- **Reference material** (stack analogy, Terminal ID explainer,
  two-wallet explainer) folded into the most relevant tabs rather
  than living as always-visible footer content. Stack + Terminal
  ID inside Profile Creation ("WHY THE TERMINAL FIRST?" section);
  two-wallet explainer inside Updating Profile ("TWO WALLETS?
  HERE'S WHY" section at the bottom). Fits the "tab isolates
  content" rule — no always-visible reference section between
  tabs and footer.
- **Contact tab** gets its own first-class treatment — big
  Telegram handle, "What to include / Never share" two-column
  info-cards, scam-alert red callout, and a closing CTA pair
  (LAUNCH TERMINAL / GO TO /MANAGE).
- **FAQ tab** now has a live search input — typing filters the
  accordion list by substring match on question + answer text,
  auto-opens matches, restores default open state when cleared.
  Still works without JS (graceful degradation: all FAQs visible,
  first three open by default).
- **Mobile responsive** tuned for the new layout — ticker hides
  <900px, tab bar stays sticky with horizontal scroll, tab numbers
  hide <540px for tighter space, panel titles shrink to 24px,
  multi-column grids collapse to single column.
- Preview-tested via the local static server already running at
  `127.0.0.1:8765` (from prior task). 99,648 bytes, HTTP 200.

### Current state

- `wireframes/help.html` — rewritten, 1,595 lines, self-contained.
  Standard page chrome, 6 isolated tabs with click-to-switch, FAQ
  search, hash-sync for deep links, mobile-responsive, accessible.
- Content is identical in coverage to the prior version (all 4
  topics, 33 FAQs, reference material) — only the framing and
  interaction changed.
- Preview server still running: `b3pu52zas` at
  http://127.0.0.1:8765/help.html. Kill when done.
- No code changes, no migrations, no Terminal impact.

### Open / next

- **Screenshot capture protocol still pending** — the wireframe
  uses browser-chrome-framed placeholders with source-wireframe
  references and captions. Real screenshot capture (Playwright at
  1440×900 → WebP+PNG, 2x retina, lazy-load, lightbox) to be done
  when frontend builder productionizes at
  `src/app/(marketing)/help/page.tsx`.
- **Link /help from every Terminal-ID prompt** per content doc
  Entry Points table — /manage auth screen, onboarding screens,
  proof modal "What am I paying for?" link, public profile footer,
  homepage hero, 404 page.
- **`/faq` redirect config** when help page ships — content doc
  says `/faq` should redirect to `/help`.
- **Frontend builder TODO** — probably worth rendering each panel
  as a React sub-component (`ProfileCreationPanel`, etc.) keyed by
  `useState` rather than re-implementing the vanilla JS tab
  switcher. Mirrors the existing `/how-it-works` page pattern.

### Gotchas for next session

- **Preview server port 8765** is running in a background shell
  (ID `b3pu52zas`). If another session needs the port, kill it
  via `Bash` → `kill $(lsof -t -i:8765)` or restart cleanly.
- **Tab activation silently falls through** if the URL hash is
  invalid — the JS validates against `VALID_TABS` whitelist. If
  you add a tab, update that array.
- **`data-jump-tab` attribute** is the cross-tab link mechanism
  (used in Quick Answers and the FAQ "didn't find your answer?"
  pointer). Use it from anywhere on the page to activate a tab
  in-place.
- **FAQ search opens every matching FAQ** on each keystroke and
  restores their default state when cleared. If a builder refactor
  moves from `<details>` to headless-UI disclosure, preserve the
  open/close behavior on search match/clear.

---

## 2026-04-20 23:34 MST — /help page wireframe built

**Device:** Kellen's Mac mini (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Role:** help-page
**Commits:** this entry
**Migrations run in prod Supabase:** none
**Impacts:** none — wireframe + content doc only, no code changes, no Terminal touches
**Status:** ✅ shipped, wireframe `wireframes/help.html` ready for frontend builder

### Did

- Built the HTML wireframe at `wireframes/help.html` (1,633 lines,
  self-contained HTML+CSS, no JS dependencies beyond `<details>` for
  accessible accordion). Terminal-chrome layout matching /manage:
  system bar, titlebar (`help — lastproof — 80x24`), CRT
  scanlines + vignette, bottom bar.
- Structure implements the content doc 1:1:
  - Hero + "Quick Answers" (top-3 blockers above the fold)
  - Topic hub: 4 clickable cards with SVG icons, scroll-jumps to
    anchor targets
  - Sticky anchor nav (becomes fixed on scroll past topic hub)
  - TOPIC 01 Profile Creation — 5 visual step cards with
    browser-chrome screenshot placeholders referencing existing
    wireframes
  - TOPIC 02 Verify This Work — 6-step proof flow + 4-tactic
    collect-proofs grid
  - TOPIC 03 Updating My Profile — 8 sub-topic cards (bio, work
    items, screenshots, links, handle change, X/TG verify, upgrade,
    mint)
  - TOPIC 04 Profile Status — glance table, 4 state detail cards
    (ACTIVE PAID / EA / FREE / DEFUNCT) with color-coded
    left-border, state-transition ASCII diagram, cost matrix table
    with $LASTSHFT 40%-off callout, tier × state interaction block
  - FAQ accordion (33 questions, first 3 open by default, `<details>`
    for JS-free behavior)
  - Reference block: stack analogy, 4 ecosystem cards, Terminal ID
    key display, two-wallet explainer
  - Final CTAs (primary: LAUNCH TERMINAL, secondary: GO TO /MANAGE)
  - Contact (Telegram: @lastshiftcoinbreakroom)
  - Last-updated timestamp
  - Footer with burn tag
  - FAQ JSON-LD schema for SEO (6 top questions)
- **Did NOT touch `wireframes/how-it-works.html`** — that's an
  existing production wireframe for the `/how-it-works` marketing
  page (rendered by `src/app/(marketing)/how-it-works/page.tsx`).
  Created new file at `wireframes/help.html` to avoid collision.
  Updated content doc header to document the naming and route
  distinction.
- All screenshots are styled placeholders with browser-chrome frame
  + source-wireframe reference + caption. Frontend builder will
  replace each with actual captured screenshots per the Visual
  Assets Inventory in the content doc (capture protocol documented
  there: Playwright at 1440×900, WebP+PNG, 2x retina, lazy-load
  below the fold, lightbox on click).
- Mobile-responsive: all grids collapse to single column at ≤768px,
  anchor nav shifts top position, TID display shrinks, titlebar
  right info hides.
- Accessibility: FAQ works without JS via `<details>`/`<summary>`,
  all anchor targets have explicit IDs, SVG icons in topic cards
  are `aria-hidden`, anchor nav has `aria-label="Help topics"`.

### Current state

- Wireframe at `wireframes/help.html` — complete, self-contained,
  openable in any browser. Screenshots are placeholders (as
  expected for wireframe stage).
- Content doc `wireframes/how-it-works-CONTENT.md` serves as the
  canonical copy source. Updated header to route the primary URL
  to `/help` (not `/how-it-works`, which is already taken by the
  existing marketing page).
- No code changes; no migrations; no Terminal impact.
- Frontend builder has everything needed: wireframe for visual
  layout + content doc for final copy + Visual Assets Inventory
  for screenshot capture protocol.

### Open / next

- **Frontend builder task** — productionize at route
  `src/app/(marketing)/help/page.tsx`. Capture real screenshots
  per protocol in content doc §Visual Assets Inventory. Decide
  whether "Last updated" uses git commit date or dashboard
  timestamp pattern (if one exists).
- **Link /help from every Terminal-ID prompt** across lastproof
  per content doc Entry Points table — `/manage`, onboarding
  screens, proof modal "What am I paying for?" link, public profile
  footer, homepage, 404 page.
- **`/faq` redirect** — content doc says `/faq` redirects to
  `/help`. Needs routing config when the help page ships.
- **Topic 3 sub-topic verification** — some sub-topic affordances
  (e.g. handle change modal trigger, mint card state) reference
  dashboard sections that Kellen confirmed exist. Frontend builder
  should still sanity-check each sub-topic's affordance before
  linking — the wireframe assumes everything described in Topic 3
  is present.

### Gotchas for next session

- **Two wireframes with similar names**: `wireframes/how-it-works.html`
  = existing marketing explainer (Operator/Dev/Verify toggle,
  production at `/how-it-works`). `wireframes/help.html` = new
  help center for `/help` route. Don't confuse them.
- **FAQ source of truth is the content doc, not the wireframe.**
  If copy diverges later, update the content doc first, then
  propagate to wireframe. The content doc has the full FAQ; the
  wireframe trimmed a few minor edge-case FAQs to keep the page
  scannable.
- **Contact Telegram handle**: `@lastshiftcoinbreakroom`. Don't
  create a new support channel — use the existing one.
- **Handle change cost is $100 SOL/USDT or $60 $LASTSHFT** — locked
  today in prior commit `e2a47ca`. $LASTSHFT 40% off is the
  platform-wide discount across every paid action (subscription,
  handle change, mint, proof). Don't split the discount rate per
  action.

---

## 2026-04-20 23:02 MST — /help page content brief: 10 open questions resolved, final-copy locked

**Device:** Kellen's Mac mini (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Role:** help-page (new — doesn't collide with backend/frontend/fullstack/coordinator)
**Commits:** this entry
**Migrations run in prod Supabase:** none
**Impacts:** none — pure content work in `wireframes/how-it-works-CONTENT.md`, no code behavior changed, no Terminal touches
**Status:** ✅ shipped, content doc final-copy-ready for wireframe build

### Did

- Onboarded per protocol steps 1–6. Pulled main cleanly (7927313 → b8f606b).
  Git status clean, both iCloud duplicate scans (`* 2*` and `* 3*`) returned
  zero. Read top two WORKLOG entries + `CLAUDE.md § Session protocol`
  including the new "Broken git state" and "iCloud duplicates" sub-sections.
- Self-declared role `help-page`. Confirmed
  `wireframes/how-it-works-CONTENT.md` (ceb8091, rescued from iCloud drift
  earlier today) is this session's work — 973 lines with 4 TOPIC sections
  matching the in-memory context from the pre-onboarding session.
- Resolved all 10 open questions in the content doc via direct answers from
  Kellen:
  1. Support channel = `@lastshiftcoinbreakroom` on Telegram.
  2. `lastshift.ai` card links to homepage; help page carries visual
     ecosystem explanation itself.
  3. First 5,000 campaign mechanics excluded — help page references FIRST
     5,000 only as a profile state (Topic 4), not campaign copy.
  4. "Last updated" timestamp added to footer; matches (or falls back if
     absent) whatever dashboard pattern the frontend builder finds.
  5. **Handle change cost = $100 in SOL/USDT, or $60 in $LASTSHFT**
     (40% off — platform-wide $LASTSHFT discount). Locked in sub-topic
     3.5 + Topic 4 cost matrix. Added green callout that the 40% discount
     applies to every paid action: subscription, handle change, mint,
     proof.
  6. Single page with scroll-jumps confirmed — no `/help/[topic]`
     sub-routes.
  7. All 8 Updating-My-Profile sub-topic affordances exist on the live
     dashboard; Topic 3 references `/wireframes/lastproof-dashboard.html`
     with confidence.
  8. Defunct = 90+ days AND no payment AND no login. Locked.
  9. Defunct → Free on login (no payment required to exit Defunct).
     Locked.
  10. Research from the prior thorough-research agent was **stale on three
      claims** — verified directly against code:
      - View counter works — `src/components/dashboard/StatQuad.tsx:47`
        reads `profile.viewCount`; FAQ entry removed.
      - Handle change payment is fully on-chain verified (it's a code
        duplicate of the proof paste-verify modal). No FAQ concern needed.
      - `payer_wallet` column exists on `proofs` table — migration
        `0008_proofs_payer_wallet.sql` added it, `scripts/backfill-payer-wallet.ts`
        backfills historical rows by joining on `tx_signature`. Dedup gap
        closed. Wrote a short explanation in the doc so Kellen has the
        full context on what the original concern was.
- Replaced the "Open Questions" section in the content doc with a
  "Decisions Locked" section logging all 10 answers + the `payer_wallet`
  explainer.

### Current state

- `wireframes/how-it-works-CONTENT.md` is final-copy-ready. All 10 blocking
  and nice-to-have questions resolved. Ready to hand to frontend builder
  for HTML wireframe build, or for this session to build the wireframe
  next.
- Content doc covers 4 TOPIC sections (Profile Creation, Verify This Work,
  Updating My Profile, Profile Status) + cross-topic FAQ + references
  (stack analogy, ecosystem cards, Terminal ID, two-wallet model).
- No code changes. No Terminal impact. No migrations run.
- Memory file `project_profile_states.md` written in prior-session scope —
  per-session, not per-repo — captures Active/EA/Free/Defunct rules for
  future sessions on this machine.

### Open / next

- **Build the HTML wireframe for `/help`** using the content doc as
  source of truth. Match `/manage` terminal chrome (system bar,
  titlebar "how-it-works — lastproof — 80x24", CRT scanlines, bottom
  bar). Topic hub at top scroll-jumps to 4 anchored topic sections.
  FAQ accordion with `<details>`/`<summary>`. Embed screenshots per
  the Visual Assets Inventory in the doc.
- **Link /help from every Terminal-ID prompt** across lastproof —
  `/manage`, onboarding screens, proof modal ("What am I paying for?"),
  public profile footer, homepage, 404 — per the Entry Points table in
  the content doc.
- **Frontend builder integration** — this doc is the canonical copy
  source for whoever builds the production `/help` route.

### Gotchas for next session

- **Thorough-research agent output can be stale** — yesterday's research
  report flagged three "known bugs" from handoff-doc line references
  (view counter, handle-change verify, payer_wallet) that were all
  already fixed in code. Never copy "known bug" disclaimers from
  handoff docs into user-facing FAQ without grepping current `src/` +
  `migrations/` first. `FULLSTACK-BUILDER-HANDOFF.md:124-126` was
  written before several migrations shipped; file-line citations from
  older handoff docs are point-in-time snapshots, not live state.
- **Role name `help-page`** is new in this repo's convention — add to
  the role list in the prior entry's Gotchas if another session picks
  up help-page work.

---

## 2026-04-20 22:39 MST — Multi-session onboarding + protocol codification

**Device:** Tallada's MacBook Air (`Talladas-MacBook-Air.local`, macOS 26.4.1 arm64)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`)
**Model:** claude-opus-4-6
**Role:** coordinator (sole author on this machine; onboarded peers on the mac mini)
**Commits:** `7927313` (protocol codification)
**Migrations run in prod Supabase:** none
**Impacts:** none — purely protocol / cross-machine hygiene, no code behavior changed
**Status:** ✅ shipped, four active sessions aligned across two machines

### Did

- Onboarded the three active LASTPROOF sessions on the mac mini
  (`Kellens-Mac-mini.local`, macOS 15.3.1, account `tallada2023`) to
  the session protocol introduced earlier today: **backend**,
  **frontend**, **fullstack**. Each session ran steps 1–6 of the
  protocol at session start — pulled latest main, read top 3 WORKLOG
  entries, read CLAUDE.md § Session protocol, ran git log / git status
  / remote-v, ran the iCloud duplicate hunt, and reported back SHAs.
  All three confirmed clean against `7927313`.
- **Backend session on mac mini hit a corrupt local git state** during
  onboarding: HEAD pointed at `d04e9e9` but the object was missing from
  `.git/objects/` (iCloud dropped the file mid-sync), plus `.git/index 2`
  and `.git/index 3` duplicates, plus a week-old dangling stash
  (`cf2986`, WIP from pre-Proof-Flow-V3 Apr 15). Session correctly
  halted before any recovery, ran `git fsck --full` + pack listing +
  duplicate enumeration, reported verbatim. Recovery path executed
  cleanly: removed iCloud-duplicated index files, ran `git fetch
  origin main` + `git reset --hard origin/main`, expired the dangling
  stash via `git reflog expire --expire=now --all && git gc --prune=now`.
  Final `git fsck --full` → zero dangling, zero missing.
- **Mac mini iCloud duplicate cleanup** (by backend session, with
  approval at each diff-safety-check step): 84 duplicate files + 11
  duplicate directories removed. All but **two** byte-identical to
  canonical. The two outliers were stale pre-observability snapshots
  of `HandleChangeModal 2.tsx` (Apr 14) and
  `(landing)/[campaignSlug] 2/page.tsx` (Apr 13) — same stale-revert
  pattern as the prior entry. Both confirmed zero-rescue-value,
  deleted.
- **MacBook Air iCloud duplicate cleanup** (this session): 7 files +
  `phantom 2/` empty dir + `.git/index 3` stale file. Same diff-safety
  check first — all six content files byte-identical. Cleaned.
- **Codified two protocol rules in CLAUDE.md § Session protocol**
  (commit `7927313`) based on the incidents above:
  1. "Broken git state — stop, don't improvise" — mandates `git fsck
     --full` + pack + duplicate-file diagnostic before proposing any
     recovery; forbids blind `git gc`, `git reset --hard`, object
     deletion, or `git reflog expire` without inspecting dangling
     content first.
  2. "iCloud duplicates: hunt both files AND directories" — spells
     out the two find patterns (`* 2.*` dotted for files, `* 2*`
     un-dotted for directories), keeps the diff-against-canonical
     safety check for every duplicate before deletion.
- Closed the `terminal-build` stale-worktree mystery: the
  `/Users/tallada2023/…/worktrees/sharp-hypatia` ghost reference
  tracked back to the same mac mini (macOS account name is
  `tallada2023`, not a different user). Kellen confirmed: one person,
  two machines.

### Current state

- Four sessions onboarded and idle-but-ready:
  - MacBook Air: this session (coordinator) + the LASTPROOF
    drift-triage session from earlier today
  - Mac mini: backend, frontend, fullstack
- Both machines have zero iCloud duplicates in the working tree, zero
  stray `.git/index N` files, zero dangling commits.
- Protocol is battle-tested — one real broken-git incident was caught
  and resolved without loss. Two new rules codified as a result.
- HEAD on both machines: `7927313` on `origin/main`.
- No code behavior changed in this entry's commits.

### Open / next

- **48h ambassador attribution watch window** still running
  (continues from the 2026-04-20 19:19 MST entry). No action expected
  unless real traffic reveals a new failure mode the observability
  layer catches.
- **Pre-existing `@solana/*` tsc errors** continue to hang off
  `build-solana-tx.ts`, `token-dev-verify.ts`, `wallet/provider.tsx`.
  Not blocking deploys. Pick up in a quiet session with `rm -rf
  node_modules && npm install` + either pin the `@solana/spl-token`
  version that exports `getAssociatedTokenAddress` or update the two
  callsites; install the missing `@solana/wallet-adapter-phantom` +
  `@solana/wallet-adapter-solflare` (or remove dead imports).

### Gotchas for next session

- **Multi-session rebase discipline** — three active sessions on the
  mac mini share this repo. Always `git pull --rebase origin main`
  before `git push`. If rebase hits conflicts, stop and ask the user
  rather than auto-resolving.
- **Two new protocol sub-sections** in `CLAUDE.md § Session protocol`
  are mandatory reading: "Broken git state — stop, don't improvise"
  and "iCloud duplicates: hunt both files AND directories". They
  codify today's lessons; don't skip them because they look like
  they're only relevant "when things go wrong" — they're written to
  prevent things going *worse* when they do.
- **Cross-machine commit author drift** — commits from the MacBook
  Air come out as `Tallada <tallada@…>`, commits from the mac mini
  will come out as `Kellen <kellen@…>` (or `tallada2023`), same
  person. Not fixed yet. Consider running
  `git config --global user.name "Kellen"` + `user.email "..."` on
  each machine to unify attribution before too many more commits
  land with split author metadata.

---

## 2026-04-20 21:09 MST — iCloud drift triage: restored 10 stale files, rescued 1 content brief

**Device:** Tallada's MacBook Air (`Talladas-MacBook-Air.local`, macOS 26.4.1 arm64)
**Platform:** Claude Desktop (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `__CFBundleIdentifier=com.anthropic.claudefordesktop`)
**Model:** claude-opus-4-6
**Commits:** `ceb8091` (wireframes content brief), plus this WORKLOG entry
**Migrations run in prod Supabase:** none
**Impacts:** none — purely working-tree hygiene, no Terminal implications
**Status:** ✅ shipped, working tree clean, no code behavior changed

### Did

- Took over LASTPROOF per explicit handoff. Followed session protocol:
  read WORKLOG top entry, read `CLAUDE.md § Session protocol`, ran
  `git log --oneline -20` and `git status`.
- Found 10 modified + 1 untracked file in the working tree, dragged in
  via iCloud from a prior session on another machine (files exist on
  disk but never reached GitHub).
- Did a read-only `git diff HEAD --` pass across all 10. Every hunk
  was an **older snapshot reverting already-shipped work** — no new
  in-progress code to rescue. Key reverts the dirty tree contained:
  - `ProofOfWorkCard.tsx` / `page.tsx` / `work-items/route.ts` —
    re-added `position` column references and the deleted
    `/api/dashboard/work-items/reorder` endpoint (would 500 at
    runtime — migration 0016 dropped the column; the route dir
    doesn't exist in HEAD).
  - `ProofOfWorkCard.tsx` edit path — regressed `YYYY-MM-DD` back to
    `YYYY-MM` (the Postgres date-format bug from `9255503`).
  - `IdentityCard.tsx` — regressed the awaited-category-PATCH fix
    from `985bd90` (category save failures would go silent again).
  - `AboutCard.tsx`, `PitchCard.tsx`, `IdentityCard.tsx`,
    `ProofOfWorkCard.tsx`, `HandleChangeModal.tsx`, `MintModal.tsx`,
    `Screen5Terminal.tsx` — stripped all `useDebugLog` observability
    from `5817616` / `febac6f` / `985bd90`.
  - `dashboard.css` — re-added drag-reorder styles (cosmetic only).
- Restored all 10 files to HEAD with `git checkout --`. No stash
  needed — nothing preserved.
- Untracked `wireframes/how-it-works-CONTENT.md` was a substantive
  ~973-line content brief for a new `/help` page, aligning with the
  recent how-it-works work (`3ce08a9`, `763dfe8`, `d0a99fd`).
  Authorship unknown but clearly legit. Committed in isolation as
  `ceb8091` with a message noting the drift-rescue origin so future
  sessions can find it.
- Post-restoration `npx tsc --noEmit` reports 4 pre-existing errors
  in `src/lib/build-solana-tx.ts`, `src/lib/token-dev-verify.ts`,
  `src/lib/wallet/provider.tsx` — all `@solana/*` module resolution.
  These are **unrelated to the drift triage** (none of the affected
  files were in the restored set). Vercel builds still ship green
  (today's dev-check deploy `3fc41bb` shipped clean). Likely
  introduced when a `rm -rf node_modules && npm install` run pulled
  newer `@solana/spl-token` and missing wallet-adapter packages vs.
  the lockfile. Flagging for a follow-up session — out of scope for
  hygiene commit.

### Current state

- Working tree clean.
- No code behavior changed — HEAD is unchanged for all 10 restored
  files. Only new content: `wireframes/how-it-works-CONTENT.md`.
- No deploys needed; no migrations needed; no env var changes.
- The standing "watch next 48h of street-team traffic" order from
  the prior entry is undisturbed.

### Open / next

- **Pre-existing tsc errors** in `@solana/*` dependency chain. Not
  blocking deploys, but should be fixed: either pin the affected
  packages in `package.json` to versions exporting
  `getAssociatedTokenAddress`, or update the callsites in
  `build-solana-tx.ts` and `token-dev-verify.ts` to the new API
  shape. Also install the missing `@solana/wallet-adapter-phantom`
  and `@solana/wallet-adapter-solflare` (or remove their imports if
  dead code).
- Standing watch on ambassador attribution from prior entry continues.

### Gotchas for next session

- **iCloud drift is real** — this machine (MacBook Air) shares files
  with another via iCloud. Any session that edits source without
  committing leaves files on disk that iCloud will sync. The next
  session on a different machine will see them as "modifications"
  even though HEAD is already ahead. Always `git diff HEAD --` before
  assuming dirty files are yours. This entry is the second time in
  this repo's history the pattern has bitten — first was the
  `* 2.*` Finder duplicates caught earlier; now it's silent
  same-name overwrites.
- **Never blind-commit a dirty working tree across sessions.**
  Always triage diff direction first. Reverts of your own shipped
  work look identical to someone else's unreviewed new code at
  `git status` level.
- **If you run `rm -rf node_modules && npm install`**, expect the
  `@solana/*` type errors to reappear. Revisit the lockfile pin
  plan above.

---

## 2026-04-20 19:19 MST — Ambassador referral attribution: fix, observability, mobile fix

**Device:** Tallada's MacBook Air (`Talladas-MacBook-Air.local`, macOS 26.4.1 arm64)
**Platform:** Claude Desktop / Claude Code (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`)
**Model:** claude-opus-4-6
**Commits:** `67fc011`, `adca9f1`, `d04e9e9`
**Migrations run in prod Supabase:** 0017, 0018, 0019, 0020
**Impacts:** none directly — LASTPROOF still calls Terminal's
`/api/license/validate` unchanged. Terminal sessions don't need to act on
this entry, but the fix does rely on Terminal's existing TID validation
contract staying stable.
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
| Impacts | If your change affects the Terminal repo (shared contract, shared secret, wallet/TID handshake, etc.), say so. If not, write "none". |
| Status | ✅ shipped, 🟡 in-flight, ❌ blocked |

```
## YYYY-MM-DD HH:MM TZ — <short title>

**Device:** <ComputerName> (`<hostname>`, <os + arch>)
**Platform:** <Claude Desktop / Claude Code / Claude Cowork> (`CLAUDE_CODE_ENTRYPOINT=<value>`)
**Model:** <model name>
**Commits:** `<sha>` [, `<sha>` …]
**Migrations run in prod Supabase:** <list or "none">
**Impacts:** <none | terminal-build — short reason + pointer to their WORKLOG entry>
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
