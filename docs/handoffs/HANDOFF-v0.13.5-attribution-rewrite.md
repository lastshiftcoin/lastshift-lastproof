# HANDOFF — v0.13.5: Attribution Rewrite (cookie/?ref= → onboarding modal field)

**Date:** 2026-04-28
**Commit:** `b9712e7` on `main`
**Author session:** fullstack builder
**Reviewer:** backend AI session
**Goal of review:** confirm the new onboarding-modal attribution flow does
NOT break onboarding submission, profile creation, or downstream
ambassador-payout queries.

---

## TL;DR

Cookie + `?ref=` URL ambassador attribution chain was deleted entirely.
Replaced with a single explicit "Referred by an operator?" text field on
Step 1 of the onboarding modal. Field is optional, always visible, has
a debounced live-lookup that confirms the entered handle in real time.

`profiles.referred_by` is now stamped at **onboarding submit time**,
nowhere else. Ambassador report queries (`/5k/[reportSlug]`) and admin
queries (`/5k/god-ops`) are unchanged and continue to join on
`profiles.referred_by = ambassadors.campaign_slug`.

No DB migration. Existing rows untouched.

---

## Files changed

### Deleted

- `src/proxy.ts` — entire file removed (was the Next.js 16 middleware
  that wrote the `lp_ref` HttpOnly cookie on ambassador landing pages).

### Modified — backend

| File | What changed |
|---|---|
| `src/app/api/auth/wallet-gate/route.ts` | Removed `body.ref`, `lp_ref` cookie reads, the entire attribution branch (no_ref / already_stamped / invalid_slug paths), and the cookie deletion at the end. Now just resolves wallet → operator → session. |
| `src/app/api/auth/register-tid/route.ts` | Same surgery: dropped `body.ref`, cookie read, `validatedRef` lookup, `referred_by` stamping on operators row, cookie deletion, and all `logReferralEvent` calls in this file. Operators row no longer carries attribution. |
| `src/app/api/campaign/claim/route.ts` | Removed `operators.referred_by` read, body.ref + cookie fallback chain, `referred_by` stamping on profiles, and the `logReferralEvent("campaign_claim")` call. Claim no longer touches `referred_by` at all — it's already stamped at onboarding. |
| `src/app/api/onboarding/route.ts` | **NEW LOGIC.** Accepts new optional body field `referredByHandle: string \| null`. Parses via `parseReferralHandle()`. Looks up: if it maps to an ambassador campaign_slug → verifies ambassador row is active → stamps `profiles.referred_by = campaign_slug`. Otherwise looks up `profiles.handle` → stamps `profiles.referred_by = bare_handle`. Logs `onboarding_submit` event. Stamping uses `.is("referred_by", null)` guard for first-touch safety. |
| `src/app/(marketing)/manage/page.tsx` | Removed `searchParams`, `?ref=` extraction, and the `lp_ref` cookie write. Now a 3-line page that just reads session and renders. |
| `src/lib/referral-events.ts` | Added `"onboarding_submit"` to `ReferralEventType` union. Tagged legacy types with `[LEGACY pre-2026-04-28]`. |

### Created — backend

| File | Purpose |
|---|---|
| `src/lib/referral-lookup.ts` | `parseReferralHandle(raw)` parses any of: bare `handle`, `@handle`, `lastproof.app/@handle`, `https://lastproof.app/@handle/`, with query strings, with `www.`, etc. → returns lowercase bare handle or `null`. Plus `ambassadorSlugForHandle(handle)` → `campaign_slug` or `null`. Hosts the `AMBASSADOR_PROFILE_HANDLES` map (moved from proxy.ts). |
| `src/app/api/onboarding/lookup-handle/route.ts` | Public POST endpoint, no auth. Body: `{ input: string }`. Returns one of: `{ kind: "empty" }`, `{ kind: "invalid" }`, `{ kind: "not_found", handle }`, `{ kind: "operator", handle }`, `{ kind: "ambassador", handle, tgHandle, campaignSlug }`. Used for live UX feedback only — not for stamping. |

### Modified — frontend

| File | What changed |
|---|---|
| `src/components/dashboard/OnboardingModal.tsx` | Added `referredByInput` state, `referralLookup` state, `referralTimer` ref, `checkReferral()` debounced (400ms) lookup function, `handleReferralChange()`, `getReferralStatusText()`, `getReferralStatusClass()`. New input field rendered on Step 1 between the handle field and the fee callout. Submit handler now sends `referredByHandle: referredByInput.trim() \|\| null` in the POST body. |
| `src/components/dashboard/onboarding.css` | Added `.ob-ref-status`, `.ob-ref-status.ok`, `.ob-ref-status.taken` styles. |
| `src/app/(marketing)/manage/ManageTerminal.tsx` | Dropped `ref_slug` prop entirely, removed the `lp_ref_slug` localStorage stash useEffect, removed `?ref=` forwarding to wallet-gate and register-tid, removed `?ref=` query param construction on the "MANAGE PROFILE" link. |
| `src/app/(landing)/lastproof/[slug]/page.tsx` | `terminalUrl = "/manage?ref=${slug}"` → `terminalUrl = "/manage"`. |
| `src/app/(landing)/[campaignSlug]/page.tsx` | `manageUrl = "/manage?ref=${campaignSlug}"` → `manageUrl = "/manage"`. |

### Modified — meta

- `VERSION` → `0.13.5`
- `data/updates.json` → new entry at top
- `WORKLOG.md` → new entry at top

---

## The new onboarding flow (end-to-end)

1. User connects wallet on `/manage`.
2. Either the wallet has an existing operator (wallet-gate path) or they
   enter a Terminal ID (register-tid path). Neither path touches
   attribution anymore.
3. If `isNew`, frontend opens `OnboardingModal` (Step 1).
4. **Step 1 renders:**
   - The existing handle input.
   - **NEW:** "Referred by an operator?" input — optional, always visible.
     User can paste any of:
     - `habilamar_ibn`
     - `@habilamar_ibn`
     - `lastproof.app/@habilamar_ibn`
     - `https://lastproof.app/@habilamar_ibn`
     - `https://www.lastproof.app/@habilamar_ibn/?utm=...`
   - As the user types, after 400ms idle, the modal POSTs to
     `/api/onboarding/lookup-handle` and shows live status:
     - `✓ NICE — REFERRED BY @Habilamar_ibn` (ambassador match)
     - `✓ FOUND @habilamar_ibn` (regular operator match)
     - `✗ NO PROFILE WITH THAT HANDLE` (parsed, but no profile exists)
     - `✗ NOT A VALID HANDLE OR LINK` (couldn't parse)
   - The lookup is **display-only**. Whatever the user has typed is sent
     verbatim on submit; the server re-parses + re-validates.
5. Steps 2, 3, 4 unchanged.
6. On submit (Step 4 → "BUILD MY PROFILE"), modal POSTs `/api/onboarding`
   with the existing fields **plus** `referredByHandle: string | null`.
7. `/api/onboarding` (server-side):
   - Validates session, operator ownership, handle uniqueness — unchanged.
   - **NEW:** if `referredByHandle` is non-empty, calls
     `parseReferralHandle()`. If parse fails → `referralKind = "invalid"`,
     no stamp.
   - **NEW:** if parsed, calls `ambassadorSlugForHandle(parsed)`:
     - Map hit → query `ambassadors` by `campaign_slug` + `is_active=true`.
       If found, `resolvedReferredBy = campaign_slug`.
     - Map miss → query `profiles.handle ilike parsed`. If found,
       `resolvedReferredBy = profile.handle` (the bare handle, not a slug).
   - Calls existing `upsertProfileByOperator()` to create the profile.
   - Calls existing `updateProfile()` to set timezone/language/bio.
   - **NEW:** if `resolvedReferredBy`, runs
     `update profiles set referred_by=$1 where id=$2 and referred_by is null`.
     The `is null` clause is defensive — first-touch wins, even though
     the row was just inserted milliseconds earlier.
   - **NEW:** logs `onboarding_submit` event with the outcome.
   - Inserts category — unchanged.
   - Returns the profile — unchanged.

---

## Backwards-compatibility / data integrity claims

1. **`profiles.referred_by` semantics unchanged for ambassadors.** It still
   holds the ambassador's `campaign_slug` (e.g. `"free-before-grid"`),
   matching the existing `ambassadors.campaign_slug` join keys used by:
   - `src/app/(marketing)/5k/[reportSlug]/page.tsx`
   - `src/app/(marketing)/5k/god-ops/page.tsx`
   - `mark_ambassador_referrals_paid()` Postgres function
2. **Non-ambassador referrals stamp the bare handle.** This is new shape —
   `profiles.referred_by = "some_random_operator_handle"`. These rows
   will NOT match any `ambassadors.campaign_slug`, so they don't appear
   in any payout report. They're queryable for cohort analytics but
   produce no payouts. This was the user's explicit intent.
3. **`operators.referred_by` is no longer written or read.** The column
   still exists in the schema but is functionally dead going forward.
   Existing rows untouched. (Could be removed in a future migration but
   not required for this ship.)
4. **No data migration.** All existing rows in `profiles.referred_by`
   are valid ambassador `campaign_slug` values today and continue to
   work as-is.
5. **Existing ambassador profile pages and `/@handle` rewrites are
   untouched.** Next.js `next.config.ts` rewrites `/@handle` →
   `/profile/[handle]` and that's still in effect; what changed is
   that there's no longer any cookie set when those pages are visited.

---

## Risks the backend reviewer should look at

1. **`upsertProfileByOperator()` does not set `referred_by`.** The new
   stamping is a **second** UPDATE statement after the upsert. If the
   upsert fails, the stamping is never reached (correct). If the upsert
   succeeds and the stamping fails, the profile exists with
   `referred_by = null`. Currently we don't roll back. Worst case: lost
   attribution for that one user. Acceptable per the user's risk
   stance.
2. **Race on duplicate handle entry.** The lookup endpoint and the final
   submit are separate calls. A user could see "✓ FOUND @x" and then by
   submit time `@x` could have been deleted. The submit-time validation
   would then return `referralKind = "not_found"` and NOT stamp — clean.
3. **`profiles.handle` ilike match.** The lookup uses `ilike` and the
   stamp uses `ilike`. Both return `profile.handle` (the canonical
   stored case). We stamp the stored case, not the user's input case.
   Consistent.
4. **`AMBASSADOR_PROFILE_HANDLES` is a hardcoded map.** Adding/rotating
   an ambassador now requires updating both `src/lib/referral-lookup.ts`
   AND inserting a row in the `ambassadors` table. (Old: 4 places —
   table, AMBASSADOR_SLUGS in proxy, AMBASSADOR_PROFILE_HANDLES in proxy,
   matcher config. New: 2 places.) The map's docstring says this.
5. **`logReferralEvent` is fire-and-forget.** The onboarding route
   doesn't await it. If Supabase is down, logging silently fails; the
   actual onboarding submit still succeeds.
6. **No new RLS implications.** The `lookup-handle` endpoint uses
   `supabaseService()` (service role) and exposes only `{ kind, handle,
   tgHandle?, campaignSlug? }` — no PII beyond what's already public on
   `/profile/[handle]` and `/5k/<reportSlug>`.

---

## Things explicitly NOT done

- No migration script. `operators.referred_by` is now a dead column;
  removing it is a future cleanup, not part of this ship.
- No data backfill. The user's existing referral history (where a user
  arrived via the old cookie chain and got stamped on `operators` but
  not on `profiles`) is unaffected because `campaign/claim` used to
  carry `operators.referred_by` → `profiles.referred_by`. Going forward
  that copy doesn't happen, but historical rows that already had the
  copy stay correct.
- No `npm run lint` (pre-existing breakage in repo's lint script —
  unrelated to this change). `npx tsc --noEmit` passes clean with this
  diff.
- No proxy-config update for matcher: the entire `proxy.ts` file is
  gone, so there's no matcher config to maintain.

---

## Test checklist for the reviewer

1. ☐ Open `OnboardingModal.tsx` Step 1 — confirm new field renders
   between handle input and fee callout, with autoFocus still on the
   handle input above it.
2. ☐ Confirm `canAdvance()` for step 1 still returns
   `handleStatus === "available"` only (referral field is optional, must
   not block submit).
3. ☐ Confirm submit body includes `referredByHandle` even when null.
4. ☐ Confirm `parseReferralHandle()` rejects: empty string, `"a"`,
   `"a".repeat(50)`, non-handle URLs like `lastproof.app/manage`.
5. ☐ Confirm `parseReferralHandle()` accepts all the documented forms.
6. ☐ Confirm `/api/onboarding` returns 200 with `referredByHandle:
   null`, `referredByHandle: ""`, `referredByHandle: "garbage!!!"`,
   `referredByHandle: "@habilamar_ibn"`,
   `referredByHandle: "https://lastproof.app/@habilamar_ibn"`.
7. ☐ Confirm a fresh wallet → onboarding with
   `referredByHandle: "@habilamar_ibn"` results in
   `profiles.referred_by = 'free-before-grid'` (the campaign_slug, NOT
   the handle).
8. ☐ Confirm a fresh wallet → onboarding with a non-ambassador handle
   like `@yuan` results in `profiles.referred_by = 'yuan'` (the bare
   handle — won't match any ambassador report).
9. ☐ Confirm `/5k/habilamar` (or whichever report slug) still loads,
   counts haven't dropped, the join `profiles.referred_by =
   'free-before-grid'` still returns existing referrals.
10. ☐ Confirm the `/manage` page still works for: existing session,
    new wallet (TID prompt), wallet with stale TID. None of those
    paths read attribution anymore so they should be simpler/faster.
11. ☐ Confirm `/api/onboarding/lookup-handle` returns the expected
    shape for all 5 `kind` values.

---

## Rollback

`git revert b9712e7` is clean. The diff is purely code/markdown — no
schema changes, no destructive data ops. After revert, the cookie/`?ref=`
chain is fully restored. Reviewers concerned about data shape can
verify via `select count(*), referred_by is null from profiles group by
2;` before and after.
