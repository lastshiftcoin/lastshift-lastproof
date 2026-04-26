# LASTPROOF Grid — Phase 2 architecture

**Status:** architecture reference for Phase 2 implementation
**Audience:** future Grid + backend sessions building this out
**Authority:** baseline reference, not canon — production wins (per CLAUDE.md hierarchy)
**Authored:** 2026-04-24, by the grid session

---

## 1. Scope

This document describes how the LASTPROOF Grid will be implemented in Phase 2. It assumes:

- Phase 1 (planning, decisions, wireframe) is complete — see `WORKLOG.md` 2026-04-23 23:29 entry
- The wireframe at `wireframes/_drafts/grid/lastproof-grid.html` is approved canon for the visual
- All product decisions are locked — see `docs/GRID-COWORK-BRIEF.md` for the locked decisions
- `CLAUDE.md` is the source-of-truth hierarchy (production > Frontend judgment > wireframes > docs)

What this doc covers: routing, data layer, query strategy, client state, sort/filter logic, mobile drawer, boot gate, rate limiting, category-count caching, build phases, file inventory.

What it does NOT cover: SHIFTBOT upgrade (separate sub-session), specific SQL migration scripts (those land in implementation commits), per-component React code (same), `LASTPROOF-BUILDER-HANDOFF.md` reframing (flagged separately in WORKLOG).

Every "exists" claim in this doc cites the file path and (where useful) line numbers. Every "needs to be built" item is verified to NOT already exist.

---

## 2. Route structure

Two distinct surfaces with different chrome models:

| URL | File | Layout group | Purpose |
|---|---|---|---|
| `/grid` | `src/app/grid/page.tsx` | OUTSIDE `(marketing)` — own custom terminal chrome | Boot screen / door experience. The brand entrance. |
| `/operators` | `src/app/(marketing)/operators/page.tsx` | INSIDE `(marketing)` — inherits Topbar + Footer + ShiftbotStrip | The actual Grid surface. Card list, filters, sort. |

The `/grid` route stays exactly as it currently exists — no redesign. Phase 2 only adds an "ENTER GRID" button to the existing locked-placeholder page that triggers a Server Action setting a cookie + redirecting to `/operators`.

The `/operators` route is brand new and doesn't share a parent folder with `/grid`, which avoids the parallel-tree routing edge case Next.js sometimes flags as a conflict.

### Why two routes, not one

Per CLAUDE.md / Kellen's framing: `/grid` is the door, `/operators` is the room. URLs describe what each surface does. The "Grid" brand concept lives in marketing copy, the boot screen, the homepage `SCAN GRID` button — never needs URL real estate.

---

## 3. Data layer

### 3.1 `GridCardView` — the slim per-card projection

```ts
// src/lib/grid/grid-view.ts
export interface GridCardView {
  // Identity
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarMonogram: string;

  // Trust signals
  tier: 1 | 2 | 3 | 4;            // never 5 on Grid (visibility predicate filters those out)
  isVerified: boolean;            // x_verified AND telegram_verified

  // Counts (derived via joins/aggregates — these columns DO NOT exist on profiles)
  proofsConfirmed: number;        // count from proofs table
  devProofsConfirmed: number;     // count from proofs WHERE kind = 'dev_verification'
                                  //   OR from dev_verifications table — see §3.3
  projectsCount: number;          // count from work_items

  // Meta
  timezone: string;
  language: string;               // primary; if secondary exists, render as "EN / ES"
  feeRange: '$' | '$$' | '$$$' | '$$$$';

  // Categories (first = primary, rest = ghost)
  categories: Array<{ slug: string; label: string }>;

  // Pitch
  pitch: string;

  // Sort/data helpers
  publishedAt: string;            // ISO
}
```

**Critical:** `proofsConfirmed`, `devProofsConfirmed`, and `projectsCount` are NOT columns on `profiles`. They are aggregated at query time from `proofs` and `work_items`. See §3.3 for the SQL.

### 3.2 `profiles` table — what's actually there

Verified against `supabase/migrations/0001_init.sql:32-66` plus 0005, 0006, 0007. Columns:

`id`, `operator_id`, `handle`, `display_name`, `headline`, `pitch`, `about`, `bio_statement`, `location`, `timezone`, `avatar_url`, `fee_range`, `hire_telegram_handle`, `x_handle`, `x_verified`, `telegram_handle`, `telegram_verified`, `tier`, `is_paid`, `is_dev`, `is_early_adopter`, `subscription_started_at`, `subscription_expires_at`, `last_payment_at`, `published_at`, `referral_slug`, `created_at`, `updated_at`, `view_count`, `ea_number`, `secondary_language`.

Notably absent (must be derived): `proofs_confirmed`, `dev_proofs_confirmed`, `projects_count`, `last_proof_at`.

### 3.3 `getGridList()` — single-query aggregation strategy

New file: `src/lib/grid/grid-adapter.ts`. Pattern follows existing `*-adapter.ts` shape (`profiles-adapter.ts`, `work-items-adapter.ts`).

```ts
// Shape, not production code
export async function getGridList(): Promise<GridCardView[]> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from('profiles')
    .select(`
      id, handle, display_name, avatar_url, tier,
      x_verified, telegram_verified,
      timezone, location, language, secondary_language, fee_range,
      pitch, published_at,
      categories:profile_categories(category_slug, categories(slug, label, position)),
      work_items(id, profile_id),
      ...
    `)
    .eq('is_paid', true)
    .not('published_at', 'is', null)
    .neq('tier', 5);
  // …aggregate proofs/dev counts, transform to GridCardView[]
}
```

OR — preferred approach for performance — write the aggregation as a Postgres view or `rpc` function so a single SQL query returns everything pre-shaped. Sketch:

```sql
-- Phase 2 migration (e.g. 0022_grid_view.sql)
CREATE OR REPLACE VIEW grid_operators AS
SELECT
  p.id,
  p.handle,
  p.display_name,
  p.avatar_url,
  p.tier,
  (p.x_verified AND p.telegram_verified) AS is_verified,
  p.timezone,
  p.location,
  p.language,
  p.secondary_language,
  p.fee_range,
  p.pitch,
  p.published_at,
  COALESCE(pc.proofs_count, 0) AS proofs_confirmed,
  COALESCE(pc.dev_count, 0)    AS dev_proofs_confirmed,
  COALESCE(wc.projects, 0)     AS projects_count
FROM profiles p
LEFT JOIN (
  SELECT wi.profile_id,
    count(*) FILTER (WHERE pr.status = 'confirmed') AS proofs_count,
    count(*) FILTER (WHERE pr.status = 'confirmed' AND dv.id IS NOT NULL) AS dev_count
  FROM proofs pr
  JOIN work_items wi ON wi.id = pr.work_item_id
  LEFT JOIN dev_verifications dv ON dv.work_item_id = wi.id AND dv.tx_signature = pr.tx_signature
  GROUP BY wi.profile_id
) pc ON pc.profile_id = p.id
LEFT JOIN (
  SELECT profile_id, count(*) AS projects FROM work_items GROUP BY profile_id
) wc ON wc.profile_id = p.id
WHERE p.is_paid = true
  AND p.published_at IS NOT NULL
  AND p.tier != 5;
```

The view returns one row per Grid-eligible operator with all aggregations baked in. `getGridList()` becomes `select * from grid_operators` plus a separate query for category lists.

**Why a view, not just a query:** views are versioned in migrations, tested independently, and cacheable at the Postgres level. They're the standard pattern in this repo (see `public_profiles` view in `0001_init.sql:251-277`).

### 3.4 LIVE ticker — `getRecentProofs(limit)`

New file: `src/lib/grid/recent-proofs.ts`.

```ts
export interface TickerProof {
  shortWallet: string;        // "9xK…aZ2"
  operatorHandle: string;     // "CryptoMark"
  projectTicker: string;      // "$BONK"
  isDev: boolean;
  createdAt: string;          // ISO
}

export async function getRecentProofs(limit = 20): Promise<TickerProof[]> {
  // Slim query: proofs JOIN work_items JOIN profiles, ORDER BY confirmed_at DESC, LIMIT N
  // Render once on SSR. No polling. Static-per-pageload (per Phase 1 decision).
}
```

Static-per-pageload — no client polling. Users refresh the page to see new proofs. Cheaper, no animation-restart UX issue.

### 3.5 Why we trust `profiles.tier` from the DB column

`recalcProfileTier()` in `src/lib/tier-recalc.ts` writes the tier value back to `profiles.tier` after every confirmed proof. Combined with the daily subscription cron's tier recompute on expiry flips, the stored tier is fresh enough for Grid queries. We don't recompute live in `getGridList()`.

---

## 4. Visibility predicate (LOCKED)

```sql
WHERE p.is_paid = true
  AND p.published_at IS NOT NULL
  AND p.tier != 5
```

This matches the policy in `docs/FULLSTACK-GRID-HANDOFF.md` (ACTIVE PAID + FIRST 5,000 EA only). EA pre-launch (null `subscription_expires_at`) profiles are still `is_paid = true` because they were granted free premium at publish — see `src/lib/subscription.ts:eaPublishExpiry()`. They appear on the Grid normally during the 30-day post-launch window.

---

## 5. Client-side state model

Single React component, single state object. URL is the source of truth; client state mirrors URL params.

```ts
interface GridUIState {
  // URL-synced
  category: string | 'all';
  tiers: number[];                  // multi-select
  fees: string[];                   // multi-select
  languages: string[];              // multi-select
  timezones: string[];              // multi-select
  minProofs: number;                // 0 = no filter
  onlyDevProofs: boolean;
  onlyVerified: boolean;
  sort: 'relevant' | 'trusted' | 'high' | 'low';
  query: string | null;             // SHIFTBOT — only when arriving via /operators?q=...

  // Local-only UI
  visibleCount: number;             // infinite scroll: starts 30, +30 per scroll trigger
  filterDrawerOpen: boolean;        // mobile
}
```

On every render:

```ts
const filtered = applyFilters(allCards, state);
const sorted   = applySort(filtered, state.sort);
const visible  = sorted.slice(0, state.visibleCount);
const totalCount = filtered.length;     // shown next to Sort dropdown
```

`applyFilters` and `applySort` are pure functions in `src/lib/grid/filter.ts` and `src/lib/grid/sort.ts`. Trivially testable.

### URL param shape

```
/operators
/operators?category=shiller
/operators?category=shiller&tier=3,4&fee=2,3
/operators?minProofs=10&onlyVerified=1&sort=trusted
/operators?q=best+raid+leader+for+solana
```

Single-value params: `category`, `sort`, `minProofs`, `onlyVerified`, `onlyDevProofs`, `q`.
Multi-value params: `tier`, `fee`, `language`, `timezone` — comma-delimited.

Serialization in `src/lib/grid/url-params.ts`. Use `replaceState` (not `pushState`) for filter changes so the back button doesn't fill with each filter toggle.

---

## 6. The 4 sort options (LOCKED)

| Pill | SQL semantics |
|---|---|
| `Relevant` (default) | `ORDER BY tier DESC, proofs_confirmed DESC, is_verified DESC` |
| `Most Trusted` | `ORDER BY tier DESC, proofs_confirmed DESC` (no verified tiebreaker) |
| `High Fee` | `ORDER BY fee_range DESC` (`$$$$` first) |
| `Low Fee` | `ORDER BY fee_range ASC` (`$` first) |

Sort happens client-side after the full corpus is loaded. Server-side ordering applies only to the initial query (`Relevant` default). Subsequent sort-pill changes re-sort the in-memory array.

`Relevant` and `Most Trusted` produce nearly identical orderings because tier is a function of proof count. They diverge only on the verified-tiebreaker — which is the point. `Most Trusted` is a "pure ladder" view, `Relevant` adds an editorial bump for verified profiles.

No `New Profiles` sort — Kellen's call: visibility is earned through proofs, not granted to new arrivals.

---

## 7. The 7 filter sections (LOCKED)

Order in sidebar matches the wireframe (Verified at #2 per Kellen override):

| # | Section | Type | Data source |
|---|---|---|---|
| 1 | Tier | 4 checkboxes | `tier` column on `profiles` |
| 2 | Verified | toggle | `x_verified AND telegram_verified` derived |
| 3 | DEV Proofs | toggle (binary, per Kellen override) | `dev_proofs_confirmed > 0` derived |
| 4 | # of Proofs | range slider, min threshold | `proofs_confirmed` derived |
| 5 | Fee | 4 checkboxes | `fee_range` column on `profiles` |
| 6 | Language | checkboxes (top 6 + "More") | `language` + `secondary_language` columns |
| 7 | Timezone | checkboxes (all unique values) | `timezone` column |

### 7.1 Faceted counts

Counts next to filter options ARE in the wireframe (e.g. `TIER 4 · LEGEND (31)`) but Kellen later removed them from the design. There is exactly ONE count surface on the page — the aggregate `<b>297</b> Profiles` next to the sort dropdown — Shopify-style. That count updates as filters apply, computed client-side from `filtered.length`.

No per-option counts, no per-option faceted queries. Phase 2 simpler than originally specced.

### 7.2 Default expand state

Tier + Fee expanded; Verified, DEV Proofs, # of Proofs, Language, Timezone collapsed. Matches the wireframe's `.g-fsec.open` markup.

---

## 8. Mobile filter drawer

Below 768px:
- Filter sidebar collapses to a `[Filters]` button at top of feed
- Tap → slide-in drawer from right (CSS transform)
- Drawer has: close × top-right, same 7 sections, "Clear all" link, orange `Apply (N results)` button pinned at bottom

Implementation requirements:
- **Body scroll lock** while drawer open (prevent feed scroll behind it). Use `overflow: hidden` on `<body>`.
- **Focus trap** for accessibility — first focus on close button when drawer opens; tab cycle stays inside drawer.
- **Escape key** closes drawer.
- **Backdrop click** closes drawer (CSS pointer-events on `.g-drawer-overlay`).

CSS for all of this is already in the wireframe at `wireframes/_drafts/grid/lastproof-grid.html` (search `.g-drawer`, `.g-drawer-overlay`). Port to JSX.

---

## 9. Boot screen gate

### 9.1 Server Action on `/grid`

Add an "ENTER GRID" button to the existing `src/app/grid/page.tsx`. The button submits to a Server Action:

```ts
// src/app/grid/enter-action.ts (or inline in page.tsx)
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function enterGrid() {
  (await cookies()).set('grid_entered', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,            // 24h TTL — re-gate daily
  });
  redirect('/operators');
}
```

24h TTL means returning users re-experience the gate once per day. Adjustable via session-cookie if shorter is preferred.

### 9.2 `proxy.ts` matcher on `/operators*`

Add to `src/proxy.ts`:

```ts
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Existing ambassador-slug logic stays …

  // Grid gate
  if (path === '/operators' || path.startsWith('/operators/')) {
    const entered = request.cookies.get('grid_entered')?.value;
    if (!entered) {
      return NextResponse.redirect(new URL('/grid', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // existing ambassador campaign paths …
    '/operators/:path*',
  ],
};
```

### 9.3 Bot UA bypass — deferred

Per Kellen's call: SEO is handled by blog + homepage. The Grid doesn't need to be indexed. No Googlebot bypass in Phase 2. If/when discovery indexing matters, add a UA check in the proxy.

---

## 10. Rate limiting

Existing infrastructure. Use it:

```ts
// src/app/api/grid/list/route.ts (or inside the SSR data fetch)
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const limiter = createRateLimiter({ window: 60_000, max: 60 });

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const result = limiter.check(ip);
  if (!result.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  // … getGridList() and return
}
```

`src/lib/rate-limit.ts` already exists — in-memory per-IP token bucket, used by 6 routes. Drop in.

Recommended limits for Grid:
- `/operators` page (SSR): no per-route limit needed; Vercel caches at the edge
- `/api/grid/list` (if we expose it for client-side data refresh): 60 req/min/IP
- Future SHIFTBOT endpoint: 5 req/min/IP (cost-drain protection — see §13)

---

## 11. EA expiry — already handled

**This is NOT Phase 2 work. The infrastructure exists and runs daily.**

- `src/app/api/subscription/cron/route.ts:46-67` — daily cron walks every published profile
- Lines 51-53: explicitly skips EA profiles with null `subscription_expires_at`
- Line 53-67: when `deriveState()` returns `'expired'` and the profile is paid, flips `is_paid = false` and recomputes tier
- `vercel.json:4-7` confirms the cron is scheduled at `5 0 * * *` (00:05 UTC daily)

Once Grid launches and EA profiles' `subscription_expires_at` field is set to 2026-06-07 (via `eaPublishExpiry()` in `src/lib/subscription.ts:83-91`), this cron will flip them off the Grid on 2026-06-08.

The one verified edge case: an EA profile that claimed but never published. They have `is_paid = true` and null `subscription_expires_at`. The cron skips them (correctly — they're not on the Grid because they're not published, so the visibility predicate already excludes them). They remain paid until they eventually publish or until the EA campaign is administratively closed.

No new code needed.

---

## 12. Category-count cron (NEW — Phase 2 work)

Per Kellen's call: cron-cached counts, not on-demand aggregation.

### 12.1 New column

```sql
-- Phase 2 migration (e.g. 0022_categories_operator_count.sql)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS operator_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS categories_operator_count_idx ON categories (operator_count DESC);
```

### 12.2 New cron endpoint

```ts
// src/app/api/grid/categories-cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = supabaseService();
  // SQL: write count per category from profile_categories joined against the visibility predicate
  // (uses the same predicate as the Grid query so counts reflect what's actually visible)
  const { error } = await sb.rpc('refresh_categories_operator_count');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
```

The `refresh_categories_operator_count` RPC function (in the migration) executes:

```sql
CREATE OR REPLACE FUNCTION refresh_categories_operator_count()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE categories c
  SET operator_count = sub.cnt
  FROM (
    SELECT pc.category_slug, count(*) AS cnt
    FROM profile_categories pc
    JOIN profiles p ON p.id = pc.profile_id
    WHERE p.is_paid = true
      AND p.published_at IS NOT NULL
      AND p.tier != 5
    GROUP BY pc.category_slug
  ) sub
  WHERE c.slug = sub.category_slug;

  -- Reset to 0 for categories with no Grid-visible operators
  UPDATE categories SET operator_count = 0 WHERE slug NOT IN (
    SELECT DISTINCT pc.category_slug FROM profile_categories pc
    JOIN profiles p ON p.id = pc.profile_id
    WHERE p.is_paid = true AND p.published_at IS NOT NULL AND p.tier != 5
  );
$$;
```

### 12.3 Cron schedule

Add to `vercel.json`:

```json
{
  "crons": [
    // … existing crons …
    { "path": "/api/grid/categories-cron", "schedule": "10 0 * * *" }
  ]
}
```

Daily at 00:10 UTC, 5 min after the subscription cron. Counts reflect the morning's state.

### 12.4 Grid reads cached value

`getGridList()` includes `categories.operator_count` in its category data. Chip order on the Grid is `ORDER BY operator_count DESC` (with `ALL` chip pinned first).

---

## 13. SHIFTBOT integration — hook only

The SHIFTBOT upgrade itself (Groq wiring, intent classifier, full functionality on the existing `ShiftbotStrip`) is a separate sub-session. Phase 2 Grid work only handles the **`?q=` parameter contract**:

- When `/operators?q=<query>&ranked=<comma-separated-handles>` is hit, the Grid renders in ranked mode
- Above the card list, render a strip: `SHIFTBOT ranked these for "<query>" · [Reset]`
- Sort is suspended; cards render in the order specified by `ranked=`
- `Reset` clears `q` + `ranked` from URL → Grid returns to normal sort/filter

Implementation: a small `useSearchParams` check at the top of the client component. ~20 lines.

When SHIFTBOT itself ships in its sub-session, the strip-side handler routes to `/operators?q=...&ranked=...`. The Grid is the receiver, not the producer.

---

## 14. Build phases

Per Kellen's iterative deploy plan from the 2026-04-24 session:

### Stage 1 — Visual scaffold + mock data

**Goal:** see the Grid in production at `/operators`, iterate visually.

- Move route from `src/app/grid/page.tsx` (untouched) — add `src/app/(marketing)/operators/page.tsx`
- Port wireframe HTML → JSX. Strip `.g-topbar-ref` / `.g-shiftbot-ref` / `.lp-footer` placeholder elements (real components inherited from marketing layout)
- Typed mock: `src/lib/mock/grid-mock.ts` with 10–12 sample `GridCardView[]` entries (mix of T1–T4, EA badges, DEV counts)
- Filter sidebar fully interactive — uses pure-function filter/sort engine on the mock array
- Mobile drawer working
- Sort dropdown working (4 options)
- Category chip row working (15 + ALL)
- LIVE ticker with hardcoded sample proofs (no real data yet)
- `<meta name="robots" content="noindex" />` on the page
- Update `robots.txt` to disallow `/operators`
- No internal links to `/operators` yet — only Kellen knows the URL

**Output:** Kellen can hit `lastproof.app/operators` and see the polished Grid running on real domain/CDN/fonts.

### Stage 2 — Real data wiring

**Goal:** swap mock for live backend data.

- Backend session writes the migration: `0022_grid_view.sql` (the `grid_operators` view + supporting RPC)
- Backend session writes the categories cron: migration + endpoint
- Grid session writes `getGridList()` and `getRecentProofs()` adapters
- Grid session swaps mock import for projector call
- LIVE ticker pulls real recent proofs
- Category chip ordering reflects `categories.operator_count`
- Rate limiting added to any client-facing API endpoint

### Stage 3 — Boot screen gate

**Goal:** wire the door.

- Add ENTER GRID button to `/grid` boot screen
- Server Action sets `grid_entered` cookie + redirects to `/operators`
- `proxy.ts` adds matcher for `/operators*` → redirects to `/grid` if cookie absent
- Test: direct hit on `/operators` (no cookie) → lands on `/grid` → click ENTER GRID → on `/operators` with full state

### Stage 4 — Launch

**Goal:** open the doors.

- Remove `noindex` meta and `robots.txt` disallow on `/operators`
- Update `src/app/sitemap.ts` to include `/operators` (or leave out — Kellen's call)
- Update homepage `SCAN GRID` button if needed (currently points to `/grid` — keep, since `/grid` is the door and the boot screen redirects through to `/operators` after ENTER)
- VERSION bump (likely the major 1.0.0 milestone for Grid launch)
- `data/updates.json` entry: `[update: added]` — "The Grid is live. Find verified Web3 operators by category, tier, fee, language, timezone."
- Coordinator decision: announce on Telegram, X, blog post

---

## 15. File inventory (Phase 2 deliverables)

### Stage 1 (visual scaffold)

```
src/app/(marketing)/operators/
├── page.tsx                      ← Grid route, server component, calls mock
├── operators.css                 ← .g-* classes ported from wireframe
└── OperatorsClient.tsx           ← client component, owns filter/sort/URL state

src/components/grid/
├── CategoryChipRow.tsx
├── FilterSidebar.tsx
├── FilterDrawer.tsx              ← mobile slide-in version
├── SortDropdown.tsx
├── GridCard.tsx
├── LiveTicker.tsx
├── ActiveFilterChips.tsx
└── EmptyState.tsx                ← when filters return 0 results

src/lib/grid/
├── grid-view.ts                  ← GridCardView TypeScript type
├── filter.ts                     ← applyFilters() pure function
├── sort.ts                       ← applySort() pure function
└── url-params.ts                 ← serialize/deserialize filter+sort state

src/lib/mock/
└── grid-mock.ts                  ← typed GridCardView[] for scaffold
```

### Stage 2 (real data)

```
supabase/migrations/
├── 0022_grid_view.sql            ← grid_operators view + supporting RPC
└── 0023_categories_operator_count.sql  ← column + refresh function

src/lib/grid/
├── grid-adapter.ts               ← getGridList() — replaces mock
└── recent-proofs.ts              ← getRecentProofs() for ticker

src/app/api/grid/
└── categories-cron/route.ts      ← daily category-count refresh

vercel.json                       ← add categories-cron schedule
```

### Stage 3 (boot gate)

```
src/app/grid/page.tsx             ← edit: add ENTER GRID button
src/app/grid/enter-action.ts      ← Server Action sets cookie + redirects
src/proxy.ts                      ← edit: add /operators matcher + cookie check
```

### Stage 4 (launch prep)

```
src/app/(marketing)/operators/page.tsx  ← edit: remove noindex
public/robots.txt                       ← edit: remove disallow /operators
src/app/sitemap.ts                      ← edit (optional): add /operators
VERSION                                  ← bump (likely 1.0.0)
data/updates.json                       ← new entry
```

---

## 16. Coordination dependencies

**Backend session needs to:**
- Write + apply migration `0022_grid_view.sql` (the `grid_operators` view + helper RPC functions)
- Write + apply migration `0023_categories_operator_count.sql` (column + `refresh_categories_operator_count` function)
- Write `/api/grid/categories-cron/route.ts` cron endpoint
- Add the cron schedule to `vercel.json`
- Confirm `recalcProfileTier()` keeps `profiles.tier` fresh after every confirmed proof — currently does, just needs verification at Phase 2 start

**Grid session (this one) handles:**
- Stage 1 visual scaffold (route, JSX port, components, mock data, filter/sort engine, mobile drawer)
- Stage 2 client wiring of `getGridList()` and `getRecentProofs()` after backend's migration lands
- Stage 3 boot gate (ENTER GRID Server Action, `proxy.ts` matcher)
- Stage 4 launch prep (remove noindex, sitemap edit, VERSION + updates entry)

**Frontend session may need to:**
- Polish pass on `/operators` after Stage 1 ships to production (visual consistency check, same as the wireframe pass)
- Polish pass on the ENTER GRID button if it needs to fit the existing terminal-aesthetic of the boot page

**SHIFTBOT sub-session (separate):**
- Upgrade `ShiftbotStrip` from canned placeholder to functional Groq-backed
- Implement intent classifier (handle match → direct route; ticker/keyword → filter URL; natural language → Groq → ranked handles)
- Routes to `/operators?q=<query>&ranked=<handles>` when ranking is needed
- Phase 2 Grid only consumes the `?q=` + `?ranked=` params; doesn't produce them

---

## 17. What's locked vs flexible

**Locked (don't revisit without product input):**
- Route split: `/grid` boot + `/operators` content
- Visibility predicate: `is_paid AND published_at IS NOT NULL AND tier != 5`
- 4 sort options (Relevant default, Most Trusted, High Fee, Low Fee)
- 7 filter sections + their order
- Sort = dropdown (Kellen override)
- DEV Proofs = binary toggle (Kellen override)
- Verified at sidebar position #2 (Kellen override)
- Single aggregate count next to sort (no per-option counts)
- Category-count freshness: cron-cached (24h)
- LIVE ticker: static-per-pageload (no polling)
- Cards open in new tab (`target="_blank"`)
- No bookmark feature (rely on browser-native bookmark)
- No "New Profiles" sort

**Flexible (decide during implementation):**
- Cookie TTL on `grid_entered` (24h proposed; could be session-only or week)
- Visible-cards batch size for infinite scroll (30 proposed; tune for above/below-fold)
- Initial query result cap (300 proposed for memory budget; corpus is 5K max so could load all)
- Edge cache TTL for `/operators` SSR (60s proposed; could be longer)

---

*End of architecture reference. Implementation kicks off with Stage 1 visual scaffold once Kellen green-lights Phase 2 build.*
