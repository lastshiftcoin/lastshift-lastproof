# HANDOFF — Public Profile page (Step 1: visual scaffold)

**Previous session committed canon-lock changes (CLAUDE.md + tier.ts).
This doc is the complete brief for the next session to build the public
profile page visually against mock data. Nothing here is optional.**

Start this session with: "Continue lastproof — build the public profile
visual scaffold per `docs/NEXT-PUBLIC-PROFILE.md`."

---

## 0. Read these first, in order

1. `CLAUDE.md` — tier canon, store state, priorities
2. `LASTPROOF-BUILDER-HANDOFF.md` — design tokens, tier rules, wireframe list
3. `wireframes/lastproof-profile-public.html` — the pixel-exact target
4. `src/app/globals.css` — existing design tokens and base classes
5. This file — the scaffold plan

---

## 1. Goal of this session

Render `/@cryptomark` as a pixel-accurate clone of
`wireframes/lastproof-profile-public.html`, populated from a typed
mock object (NOT from real stores — that's step 2).

**Definition of done:**
- Visiting `/@cryptomark` shows the hero, trust-tier bar, tabs, stat
  strip, categories, all tab panes (pitch / pow / shots / links /
  about / verify), and CTA strip.
- It visually matches the wireframe to within a few pixels. Diff
  screenshots side-by-side.
- The page reads from a single typed `PublicProfileView` object at
  `src/lib/mock/cryptomark-profile.ts`. Swapping that for a real
  projector is a later step.
- TypeScript typechecks clean.
- Nothing new is committed to Supabase schema or stores.

**Explicitly out of scope for this session:**
- Real data wiring (profiles-store already lacks most of these fields)
- New store/adapter work (work_items, screenshots, profile_links,
  categories — those are Step 3)
- Free-tier variant, EA variant (those are Step 5)
- "VERIFY THIS WORK" modal behavior (stub button only)
- Screenshot lightbox JS interactivity (static grid is fine for now)
- Tab switching JS (all panes visible OR hardcoded active=overview)

---

## 2. CRITICAL GOTCHAS — don't skip

### 2.1 Next.js reserves `@folder` as parallel-route syntax
You **cannot** create a folder named `@[handle]` or `[@handle]`. Next
will interpret it as a parallel route slot, not a URL segment.

**Also:** folders prefixed with `_` are **private folders** and are
excluded from the route tree entirely (even as rewrite destinations).
Do not use `_profile` — the rewrite will 404. This was tried and
failed during step 1; corrected to plain `profile`.

**Solution:** use a URL rewrite. Add this to `next.config.ts`:

```ts
async rewrites() {
  return [
    { source: "/@:handle", destination: "/profile/:handle" },
  ];
}
```

Then create the real route at:
`src/app/(marketing)/profile/[handle]/page.tsx`

The user-facing URL stays `/@cryptomark`. Internal folder is
`profile/[handle]`. Do NOT try to make the folder literally `@handle`,
and do NOT prefix it with `_`.

Also drop the same rewrite in reverse for canonicalization if
relevant — but for step 1 a one-way rewrite is enough.

### 2.2 CSS class-name collisions with marketing layout
`src/app/globals.css` already defines `.hero`, `.chip`, `.btn`,
`.stat`, and several others — these are the **marketing homepage**
versions and will clash with the wireframe's identically-named
classes for the public profile.

**Solution:** namespace every profile-page class with a `pp-` prefix
(`pp-hero`, `pp-avatar`, `pp-trust-tier`, `pp-tabs`, `pp-stat`,
`pp-pow-card`, `pp-cat-chip`, etc.). Scope all new CSS under a
single `.pp-page` wrapper class on the route's root element. Do NOT
touch the existing marketing classes.

Alternative: use CSS Modules (`page.module.css`). Either works;
pick one and stick to it. I'd recommend a single `profile-public.css`
file imported at the top of the route `page.tsx` with the `pp-`
prefix approach — it mirrors how the wireframe ships and makes
diffing easier.

### 2.3 The wireframe HTML is 1.9MB — do NOT Read it whole
It contains large base64-embedded screenshot data. Reading it
blindly blows the token budget.

**Solution:** use `Grep` with structural patterns to pull the
sections you need:
- `Grep` `class="pp-|class="hero|class="trust-tier|section class=`
  → structural skeleton
- `Read` with `offset`/`limit` to pull specific regions (e.g.,
  `offset=393, limit=400` for the `<main>` HTML, `offset=94,
  limit=200` for the `<style>` block)
- For the embedded screenshot sources, ignore them entirely and
  use placeholder URLs — real screenshots come in Step 3.

### 2.4 Layout wrapper is already provided
`src/app/(marketing)/layout.tsx` wraps its children with `<Topbar>`,
`<Footer>`, and `<ShiftbotStrip>`. Place the new route inside the
`(marketing)` group to inherit them — the wireframe's `.topbar` and
`footer` are already implemented. Do NOT re-render them.

The only caveat: the wireframe's `.topbar` has a ticker in the
middle. Check `src/components/Topbar.tsx` to see if it already
renders the ticker or if that's a profile-specific thing. If the
existing Topbar doesn't have the ticker, leave it alone for now —
matching the marketing topbar is fine for step 1.

### 2.5 Tier rendering rule
Always use `formatTierLabel(tier)` from `src/lib/tier.ts`. It
returns `"TIER 3 · EXPERIENCED"` style strings and returns `null`
for tier 5 (unlisted — triggers free variant). **Never hard-code
"TIER 3" or "EXPERIENCED" alone.** The paring rule is enforced in
CLAUDE.md.

The trust-tier bar's 4 ticks are at 0% / 20% / 50% / 100% with
labels `0+ NEW`, `10+ VERIFIED`, `25+ EXPERIENCED`, `50+ LEGEND`.
These thresholds are locked — see `TIER_THRESHOLDS` in `tier.ts`.

The fill-bar `width` percentage is `(proofsConfirmed / 50) * 100`,
capped at 100%. Cryptomark sample has 47 proofs → 94%.

### 2.6 Colors — never use green or orange for a tier label
Per CLAUDE.md §Tier:
- Green is reserved for DEV badge, verified state, money
- Orange is the brand accent only
- Tier colors: silver / bronze / gold / purple (T1–T4 respectively)

### 2.7 `.pp-pitch` is the component, `.id-pitch` is the short one
Wireframe has TWO "pitch" concepts:
- `.id-pitch` (inside hero) — one-line tagline, ~15 words,
  shown in the hero next to the handle
- `.pitch-body` (in the Pitch tab) — long-form, multi-paragraph
  elevator pitch

They are DIFFERENT fields. In the data model: `ProfileRow.pitch`
(short) vs `ProfileRow.aboutPitch` or similar (long). Name them
distinctly in `PublicProfileView` to avoid confusion:
`headline` (=id-pitch) and `pitchBody` (=pitch-body).

Better names — match the wireframe semantics:
- `headline: string` → the one-liner in hero (`id-pitch`)
- `pitchBody: string` (markdown or plain paragraphs) → tab pane
- `about: string` (markdown or plain) → "About Me" tab pane
- `bioStatement: string` → the expired-view survivor field (may
  differ from `about`)

---

## 3. Where things already are

### 3.1 Existing files you'll touch
| Path | What it is |
|---|---|
| `src/app/(marketing)/layout.tsx` | Wraps with Topbar / Footer / ShiftbotStrip |
| `src/app/globals.css` | Design tokens + existing marketing/homepage CSS |
| `src/lib/tier.ts` | `computeTier`, `formatTierLabel`, `TIER_THRESHOLDS` (wireframe-canonical) |
| `src/lib/public-view.ts` | Existing projector — handles expired stripe-down. DOES NOT yet carry the rich fields. |
| `src/app/api/profile/[handle]/route.ts` | Existing JSON API route for the projected view |
| `next.config.ts` | Add the `rewrites()` block here |

### 3.2 Files you'll create
| Path | What it is |
|---|---|
| `src/app/(marketing)/profile/[handle]/page.tsx` | The route |
| `src/app/(marketing)/profile/[handle]/profile-public.css` | Namespaced CSS lifted from wireframe `<style>` |
| `src/lib/mock/cryptomark-profile.ts` | Typed mock `PublicProfileView` |
| `src/lib/public-profile-view.ts` | `PublicProfileView` TypeScript type (see §4 below) |
| `src/components/profile/ProfileHero.tsx` | Avatar + identity + meta + hire |
| `src/components/profile/TrustTierBar.tsx` | The colored tier credential strip |
| `src/components/profile/ProfileTabs.tsx` | Tab nav (static, no JS switching in step 1) |
| `src/components/profile/StatStrip.tsx` | 4 stat cards |
| `src/components/profile/CategoryChips.tsx` | The pill row |
| `src/components/profile/WorkItemCard.tsx` | Single PoW card with VERIFY button stub |
| `src/components/profile/ScreenshotGrid.tsx` | 6-up grid, no lightbox yet |
| `src/components/profile/ProfileLinksList.tsx` | Pinned links list |
| `src/components/profile/ProofsTable.tsx` | 5-row verification table |
| `src/components/profile/CtaStrip.tsx` | Bottom dual-CTA block |

Component folder: `src/components/profile/` — keep them scoped so
when the dashboard/builder land they can share where useful.

### 3.3 Files you'll NOT touch
- `src/lib/profiles-store.ts` — already async with mode dispatch;
  expanding ProfileRow is Step 3, not Step 1
- Any of the six adapters — store cutover is done
- `CLAUDE.md` — canon is locked; only edit if you find new drift
- `LASTPROOF-BUILDER-HANDOFF.md` — companion doc, already correct
- The wireframes themselves — they are canon; do not edit
- `src/app/api/profile/[handle]/route.ts` — JSON API stays as is
  (the new `/@cryptomark` page is a server component that imports
  the mock directly; it does NOT hit the JSON API)

---

## 4. Data model — the `PublicProfileView` type

This is the single shape the page consumes. Put it in
`src/lib/public-profile-view.ts`. Mock at
`src/lib/mock/cryptomark-profile.ts` must satisfy this exactly.

```ts
import type { Tier } from "./tier";
import type { SubscriptionState } from "./subscription";

export interface PublicProfileView {
  // ─── Identity (hero) ─────────────────────────────────────────
  handle: string;                    // "cryptomark"
  displayName: string;               // "CryptoMark"
  avatarUrl: string | null;          // fallback → monogram
  avatarMonogram: string;            // "C" — first letter of displayName

  // ─── State pills ─────────────────────────────────────────────
  state: SubscriptionState;          // "active" | "warning" | "expired" | "none"
  statusLabel: "ACTIVE" | "WARNING" | "NON-ACTIVE";
  tier: Tier;                        // 1..4 for public view (5 triggers free variant)
  isEarlyAdopter: boolean;           // renders the 5K ribbon badge
  earlyAdopterNumber: number | null; // e.g. 247 → "#247 / 5000"

  // ─── Headline + meta ─────────────────────────────────────────
  headline: string;                  // short one-liner (id-pitch)
  timezone: string;                  // "UTC−5 · NEW YORK (EST)"
  language: string;                  // "ENGLISH"
  feeRange: "$" | "$$" | "$$$" | "$$$$";

  // ─── Verified socials ────────────────────────────────────────
  xHandle: string | null;
  xVerified: boolean;
  tgHandle: string | null;
  tgVerified: boolean;
  website: string | null;
  hireTelegramHandle: string | null; // renders HIRE button if set

  // Convenience flag — true only if BOTH x_verified AND tg_verified.
  // Controls the blue checkmark next to the display name.
  isVerified: boolean;

  // ─── Trust tier strip ────────────────────────────────────────
  proofsConfirmed: number;           // 47 for cryptomark sample
  devProofsConfirmed: number;        // 3
  projectsCount: number;             // 50 — distinct projects
  // Computed: (proofsConfirmed / 50) * 100 capped at 100
  tierBarFillPct: number;
  // Computed from formatTierLabel + next tier threshold:
  //   "47 verified proofs · 3 to TIER 4 · LEGEND"
  tierSubtitle: string;

  // ─── Categories ──────────────────────────────────────────────
  categories: Array<{
    slug: string;                    // "launch-ops"
    label: string;                   // "LAUNCH OPS"
    isPrimary: boolean;              // orange highlighted chip
  }>;

  // ─── Tab panes ───────────────────────────────────────────────
  pitchBody: string;                 // markdown OR paragraphs array; step 1 = plain text w/ \n\n splits
  about: string;                     // same
  bioStatement: string;              // the expired-view survivor

  workItems: WorkItem[];
  screenshots: Screenshot[];
  profileLinks: ProfileLink[];
  recentProofs: ProofRow[];

  // ─── Counts surfaced in section titles ──────────────────────
  totalWorkItems: number;            // 50 projects total, 8 shown
  totalProofs: number;               // 47 total, 5 shown in verify tab
  totalScreenshots: number;
  totalLinks: number;
  pinnedLinksCount: number;
}

export interface WorkItem {
  id: string;
  ticker: string;                    // "$ETH"
  role: string;                      // "Growth Lead"
  description: string;
  startedAt: string;                 // "JAN 2023"
  endedAt: string | null;            // "AUG 2023" | null = CURRENT
  isMinted: boolean;                 // gold border + "MINTED" tag
  isDev: boolean;                    // renders "DEV" tag
  isCurrent: boolean;                // renders "CURRENT" tag
  proofCount: number;                // 12
  // Future: workItemCategory, links to proofs, etc.
}

export interface Screenshot {
  id: string;
  imageUrl: string;                  // full-size
  previewUrl: string;                // cropped card thumb
  aspectRatio: number;               // 1.78 etc.
  caption: string | null;
  linkedUrl: string | null;          // optional click-through
  position: number;
}

export interface ProfileLink {
  id: string;
  label: string;                     // "LASTSHIFT TERMINAL"
  url: string;
  isPinned: boolean;
  position: number;
}

export interface ProofRow {
  id: string;
  shortWallet: string;               // "9pQ7…xN2j"
  isDev: boolean;                    // renders DEV mini badge
  ticker: string;                    // "$LASTSHFT"
  date: string;                      // "MAR 20, 2026"
  comment: string | null;            // null → "— NO COMMENT —"
  solscanUrl: string;                // deep link
}
```

### 4.1 Cryptomark mock — exact values from wireframe

Pull these directly from `wireframes/lastproof-profile-public.html`.
Key values verified against the wireframe:

| Field | Value |
|---|---|
| handle | `cryptomark` |
| displayName | `CryptoMark` |
| avatarMonogram | `C` |
| state | `active` |
| statusLabel | `ACTIVE` |
| tier | `3` |
| isEarlyAdopter | `true` (5K ribbon visible) |
| headline | `Web3 growth strategist. 3 years in crypto marketing.` |
| timezone | `UTC−5 · NEW YORK (EST)` |
| language | `ENGLISH` |
| feeRange | `$$$` |
| xHandle | `cryptomark` |
| xVerified | `true` |
| tgHandle | `cryptomark` |
| tgVerified | `true` |
| website | `cryptomark.xyz` |
| hireTelegramHandle | `cryptomark` |
| isVerified | `true` (x ∧ tg both verified) |
| proofsConfirmed | `47` |
| devProofsConfirmed | `3` |
| projectsCount | `50` |
| tierBarFillPct | `94` (47/50 × 100) |
| tierSubtitle | `47 verified proofs · 3 to TIER 4 · LEGEND` |
| totalWorkItems | `50` (PoW shows `8 SHOWN · 47 TOTAL` — note the discrepancy in the wireframe; match what the wireframe literally says) |
| totalProofs | `47` |
| totalScreenshots | `6` |
| totalLinks | `9` |
| pinnedLinksCount | `6` |

Categories (1 primary + 2 normal):
```
{ slug: "launch-ops",      label: "LAUNCH OPS",      isPrimary: true  }
{ slug: "raid-leader",     label: "RAID LEADER",     isPrimary: false }
{ slug: "content-creator", label: "CONTENT CREATOR", isPrimary: false }
```

Work items (8 shown, in wireframe order):

| Ticker | Role | Dates | Minted | Dev | Current | Proofs |
|---|---|---|---|---|---|---|
| $ETH | Growth Lead | JAN 2023 — AUG 2023 | ✓ | ✓ | | 12 |
| $SOL | Marketing Director | SEP 2023 — MAR 2024 | ✓ | ✓ | | 8 |
| $BONK | Raid Commander | MAY 2024 — SEP 2024 | ✓ | ✓ | | 9 |
| $LASTSHFT | X Growth Lead | FEB 2026 — PRESENT | | ✓ | ✓ | 9 |
| $PHANTOM | Community Manager | OCT 2025 — JAN 2026 | | | | 7 |
| $SFFLOOR | Growth Strategist | JUN 2025 — SEP 2025 | | | | 5 |
| $DEGODS | KOL Coordinator | FEB 2025 — MAY 2025 | | | | 4 |
| $ORCA | Content Lead | OCT 2024 — JAN 2025 | | | | 2 |

Note the wireframe has a `"RECENT"` subheader between $BONK and
$LASTSHFT — split the list visually into "MINTED" (first 3) and
"RECENT" (last 5). Add a `section: "minted" | "recent"` field to
each work item in the mock, OR hardcode the split in the component.

Descriptions are in the wireframe — copy verbatim. Use `Grep`
`pow-desc` to pull them.

Recent proofs (5 rows, verbatim from wireframe):

| Wallet | Dev | Ticker | Date | Comment |
|---|---|---|---|---|
| 9pQ7…xN2j | ✓ | $LASTSHFT | MAR 20, 2026 | "Consistent execution every single day" |
| 3kM8…pR4v | | $LASTSHFT | MAR 18, 2026 | "Great raid coordinator, always on time" |
| 7xK3…nF8q | | $PHANTOM | JAN 15, 2026 | "Delivered exactly what was promised" |
| 4pN2…jK7m | | $PHANTOM | DEC 28, 2025 | "Grew our TG from nothing" |
| 6tR8…wQ3x | | $SFFLOOR | SEP 10, 2025 | null |

Solscan URLs can be fake placeholders for the mock
(`https://solscan.io/tx/MOCK_1` etc.).

Screenshots: 6 placeholder entries. Use `https://placehold.co/1600x900/161822/ff9100?text=SS+1` through `+6` for step 1 so they render without any network calls for real images.

Profile links: pull from wireframe lines ~631–700. Should be 9 items
with 6 pinned. Use `Grep` to surface them.

**The Pitch** and **About Me** long-form text: grab verbatim from the
wireframe. Don't paraphrase. Use `Read` with the right offset, or
`Grep` `pitch-body\|about` to find the blocks.

---

## 5. Step-by-step execution plan

Assume roughly 60–90 minutes of focused work.

### Step A — Foundations (15 min)
1. Add the `rewrites()` block to `next.config.ts` per §2.1
2. Create `src/lib/public-profile-view.ts` with the full type from §4
3. Create `src/lib/mock/cryptomark-profile.ts` satisfying the type,
   filled in from §4.1. Use `Grep` to pull the verbatim long-form
   text from the wireframe.
4. `npx tsc --noEmit` clean

### Step B — Lift the CSS (15 min)
1. Read wireframe offsets ~8–367 in chunks to extract the `<style>`
   block.
2. Create `src/app/(marketing)/profile/[handle]/profile-public.css`
3. Copy every class, **prefixing each selector with `pp-`** (e.g.
   `.hero` → `.pp-hero`, `.avatar` → `.pp-avatar`, `.tab` → `.pp-tab`,
   `.stat` → `.pp-stat`, `.pow-card` → `.pp-pow-card`, etc.).
4. Drop the `body::before` / `body::after` grid-bg + radial glow into
   a wrapper class `.pp-page-bg` rather than attacking the body
   (the marketing layout owns the body).
5. Do NOT copy the scanlines — they clash with the marketing shell
   and the wireframe only uses them subtly. Skip for step 1.

### Step C — Build the components (30 min)
Order matters — build leaf components first so the page assembles
cleanly at the end.

1. `StatStrip.tsx` — 4 stat cards from props
2. `CategoryChips.tsx` — map over `categories`, primary → orange
3. `TrustTierBar.tsx` — uses `formatTierLabel`, renders 4 ticks +
   fill. This is the most fiddly one visually — diff against
   wireframe carefully.
4. `WorkItemCard.tsx` — ticker + role + tags (minted/dev/current) +
   dates + description + proof count + "VERIFY THIS WORK" button
   (stub — `<button disabled>` or `onClick={() => alert('coming soon')}`
   is fine)
5. `ScreenshotGrid.tsx` — 3-column grid on desktop, 2 on tablet, 1
   on mobile. Click handler is a no-op stub.
6. `ProfileLinksList.tsx` — pinned first, rest hidden behind a
   "SHOW ALL" expand (static for step 1)
7. `ProofsTable.tsx` — 5 rows from `recentProofs`, null comments
   render as `— NO COMMENT —`
8. `CtaStrip.tsx` — bottom section with the dual CTAs
9. `ProfileHero.tsx` — composes avatar + 5K ribbon + status pill +
   display name + verified check + handle + headline + meta row +
   links row + HIRE button
10. `ProfileTabs.tsx` — tab nav (step 1: all panes stacked below,
    tabs are decorative. Active = "overview". No JS switching.)

### Step D — Wire the route (10 min)
1. Create `src/app/(marketing)/profile/[handle]/page.tsx`
2. Import the mock + all components + the CSS file
3. Hard-fail if `params.handle !== "cryptomark"` for step 1 — we
   only have the one mock. Return a 404 for anything else:
   ```tsx
   import { notFound } from "next/navigation";
   export default async function Page({ params }) {
     const { handle } = await params;
     if (handle !== "cryptomark") notFound();
     const view = cryptomarkProfile;
     return (...);
   }
   ```
4. Wrap the root in `<div className="pp-page pp-page-bg">` so all
   the scoped CSS applies.

### Step E — Visual QA (15 min)
1. `npm run dev`
2. Open `http://localhost:3001/@cryptomark` (note: port 3001 per
   `.env.local` comment — Terminal uses 3000)
3. Open `wireframes/lastproof-profile-public.html` in a second browser
   tab
4. Diff side-by-side. Fix spacing, colors, borders, typography until
   they match.
5. Check mobile (≤780px) — the wireframe has responsive rules, the
   lifted CSS should carry them over as long as prefixing was done
   correctly.
6. `npx tsc --noEmit` — clean
7. Commit

### Step F — Commit
```
public profile: visual scaffold against cryptomark mock

Lands the /@cryptomark route as a pixel-exact clone of
wireframes/lastproof-profile-public.html, rendered from a typed
PublicProfileView mock object. Uses the existing marketing layout
shell (Topbar + Footer + ShiftbotStrip) and inherits the design
tokens from globals.css.

Zero store wiring — this is the visual foundation for the real data
pipeline in Step 3 (work_items / screenshots / profile_links /
categories store+adapter build-out). The new namespaced pp-* CSS
lives alongside the route to avoid collisions with the marketing
homepage classes (hero, chip, btn, stat all collide).

Adds a next.config.ts rewrite mapping /@:handle → /profile/:handle
because Next reserves @folder for parallel routes and cannot use
the literal @ in a folder name.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## 6. Open questions / things to flag

If any of these come up during the build, STOP and surface them to
the user rather than guessing:

1. **Ticker in topbar** — wireframe shows `$LASTSHFT` live price in
   the center. Existing `src/components/Topbar.tsx` may or may not
   have this. If not, skip for step 1 and flag as follow-up.
2. **Monogram avatar fallback** — wireframe uses a gold gradient
   circle with large mono letter. If `avatarUrl` is null, render
   the monogram. If set, render the image. For cryptomark mock,
   leave `avatarUrl: null` and use the monogram path (matches the
   wireframe exactly).
3. **Tier bar math** — the wireframe hard-codes `width:94%` with 47
   proofs. Verify `47 / 50 * 100 = 94`. ✓ Matches. Good.
4. **"SEE 43 PAST PROJECTS →"** — the wireframe shows this as a
   link at the bottom of PoW. 50 total − 8 shown = 42, not 43.
   The wireframe is off by one. Mirror the wireframe literally
   (say 43) and flag it — do not "correct" it silently.
5. **Lightbox JS** — wireframe has a full lightbox modal at the
   bottom. Skip interactivity for step 1; render an empty `<div
   hidden>` placeholder so the CSS doesn't complain about missing
   selectors, or delete the lightbox selectors during CSS lift.
6. **Tab switching** — wireframe has JS that shows/hides panes
   based on active tab. Step 1 just stacks them all vertically with
   the tab bar as a decorative nav. Flag as follow-up.
7. **Expired state** — the existing `projectPublicView` returns a
   stripe-down shape for expired profiles. Step 1's route is mock-
   only for cryptomark (active state), so expired rendering is NOT
   in scope. Free + expired variants are step 5.

---

## 7. Repo state at handoff time

- Branch: `main`
- Last commit: `CLAUDE.md + tier.ts: lock to wireframe canon`
- All 6 stores on Supabase (`LASTPROOF_DB_*=supabase`)
- Typecheck clean
- Known failing test: `tests/integration/webhook-e2e.test.ts` — uses
  a fake `op_test_1` operator ID that fails UUID validation in
  supabase mode. Pre-existing, not blocking, will be fixed when the
  webhook tests get migrated to real UUIDs. **Do not try to fix it
  in this session.**
- Dev server: `npm run dev` on port 3001
- Env: load via `set -a && . ./.env.local && set +a && <cmd>`
- Tests: `npm test` (node:test runner)
- Soak: `npx tsx scripts/soak-dual-write.ts` after env load
- Terminal bridge smoke: `npx tsx scripts/terminal-bridge-smoke.ts`
  (requires real Terminal dev server on :3000)

---

## 8. After this session — what comes next

**Step 2** — Tier drift cleanup review: check every remaining file
that mentions tiers (`tier-recalc.ts`, `payment-events.ts`,
`publish/route.ts`, any UI component) against the new tier.ts canon.
Should be a 10-min sweep.

**Step 3** — Build the stores + adapters for work_items, screenshots,
profile_links, categories, profile_categories using the same
memory|dual|supabase pattern we used for the other 6 stores. Then
expand `ProfileRow` to carry all the rich fields. Then wire the
real projector in `public-view.ts` to return a `PublicProfileView`
populated from all those stores. Then swap the cryptomark mock for
a real DB read.

**Step 4** — Proof flow: "VERIFY THIS WORK" modal, `/api/proof/*`
routes, `lib/token-dev-verify.ts` gate.

**Step 5** — Free variant + EA variant (`lastproof-profile-free.html`
and `lastproof-profile-5000.html`), conditional rendering based on
tier === 5 / isEarlyAdopter.

**Step 6** — Onboarding wireframe.

See `CLAUDE.md` § Priorities for the full list.

---

## 9. Success criteria checklist

Paste this into the next session and check off as you go:

- [ ] `next.config.ts` has the `/@:handle → /profile/:handle` rewrite
- [ ] `src/lib/public-profile-view.ts` created with full type
- [ ] `src/lib/mock/cryptomark-profile.ts` created, satisfies the type,
      contains verbatim wireframe data (pitch body, about, descriptions)
- [ ] `src/app/(marketing)/profile/[handle]/profile-public.css` lifted
      from wireframe with `pp-` prefix on every class
- [ ] 11 components created in `src/components/profile/`
- [ ] `src/app/(marketing)/profile/[handle]/page.tsx` renders the mock
      and 404s on any handle ≠ cryptomark
- [ ] `npx tsc --noEmit` clean
- [ ] Visual diff against `wireframes/lastproof-profile-public.html`
      passes — spacing, colors, typography, borders match
- [ ] Responsive mobile ≤780px looks sane
- [ ] Commit with message from §5 Step F
- [ ] Final status: report success + URL + any flagged issues

---

## 10. One final note

The user (Kellen) has been explicit that the wireframes are canon to
the pixel. If something in this doc disagrees with the wireframe, the
wireframe wins. If something in the wireframe looks like a bug or
typo, mirror it and flag it — do not silently "fix" it.

Move fast, but do not cut corners on the visual diff. The whole point
of this build is that operators can paste `/@cryptomark` into DMs and
it must look polished.
