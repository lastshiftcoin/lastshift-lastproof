# Backend Handoff — First 5,000 program: free forever

**Date:** 2026-04-29
**From:** Frontend session
**Status:** UI / copy pass shipped to `main` (commits `abb7896`, `b79d71d`, `924eb7a`). Backend logic still on the OLD model.
**Live impact:** All public copy now promises "free forever for the first 5,000." Backend must catch up before any EA profile hits its current 2026-06-07 expiry, otherwise published copy and runtime behavior diverge.

---

## TL;DR

The First 5,000 early-access program shifted from **"free premium for 30 days post-Grid-launch"** → **"free premium FOREVER for the first 5,000 operators."**

Frontend + copy: done.
Backend logic / data / cron / bot / tests: not done — that's this handoff.

The "5,000" cap stays. Only the timer/expiry dies.

---

## What changed in product semantics

| Aspect | OLD | NEW |
|---|---|---|
| EA window | 30 days, starting at Grid launch (2026-05-08) | None — never expires |
| EA expiry timestamp | `subscription_expires_at = 2026-06-07T00:00:00Z` | `subscription_expires_at = NULL` (or sentinel) |
| Auto-conversion | Yes — drops to FREE on 2026-06-08 if not paid | No — stays in EA forever |
| 3-day Telegram reminder | Sent to EA users 3 days before window closes | **Not sent to EA users.** Reserved for paid-subscription lapses post-cap |
| Cap | 5,000 | 5,000 (unchanged) |
| Existing EA holders | Promised 30 days | Silent retroactive upgrade to forever |
| `is_early_adopter` flag | Marker for EA + countdown logic | Marker for "founder, free forever" |

---

## What's already shipped (UI / copy)

For your awareness — do not re-touch any of this. Lives on `main`:

### Commit `abb7896` — Bulk copy rewrite
- Homepage closing strip
- Popup5000 first-load modal
- FomoCtaStrip (Legend profile footer) — pricing rewrite + deleted "30-DAY HEAD START" bullet
- StatusBar — countdown JSX hidden (state machinery left in place; **see action item B-1 below**)
- /earlyaccess landing — hero, pricing, offer tag, offer price, metadata
- /[campaignSlug] (ambassador root URLs)
- /lastproof/[slug] (legacy ambassador URLs)
- /help — "Is it free?" FAQ rewritten, FIRST 5,000 state card rewritten, state-transition diagram updated, cost matrix updated, two obsolete FAQs deleted, Telegram-bot FAQ reworded
- 7 blog posts (1, 2, 3, 4, 5, 6, 13) — surgical sentence-level edits

### Commit `b79d71d` — Scarcity hook
- Free-profile bottom CTA (`CtaStrip variant="free"`) — eyebrow swapped to "FREE FOREVER · FIRST 5,000 OPERATORS · THEN $10/MO"

### Untouched intentionally (yours to handle)
- `src/lib/constants.ts`
- `src/lib/subscription.ts`
- `src/app/api/campaign/claim/route.ts`
- `src/app/api/profile/publish/route.ts`
- `src/app/api/subscription/cron/route.ts`
- `src/lib/db/profiles-adapter.ts` (schema + adapter)
- `src/lib/session.ts` (`firstFiveThousand`, `freeSubUntil` fields)
- `src/app/api/mock/terminal/api/license/validate/route.ts`
- `tests/unit/subscription.test.ts`

---

## Action items for backend

### A. Constants & expiry math

#### A-1. `src/lib/constants.ts` lines 11-15
Currently:
```ts
export const GRID_LAUNCH_DATE = new Date("2026-05-08T00:00:00Z");
export const EA_FREE_WINDOW_DAYS = 30;
```
Decision needed:
- Keep `GRID_LAUNCH_DATE` (still useful as a marketing anchor)
- Remove or zero out `EA_FREE_WINDOW_DAYS` — nothing should consume it anymore. If anything still imports it, that's a dead reference to clean up.

#### A-2. `src/lib/subscription.ts` lines 83-91
Currently:
```ts
export function eaPublishExpiry(): string {
  const GRID_LAUNCH = new Date("2026-05-08T00:00:00Z");
  const EA_WINDOW_DAYS = 30;
  const expiryMs = GRID_LAUNCH.getTime() + EA_WINDOW_DAYS * MS_PER_DAY;
  return new Date(expiryMs).toISOString();
}
```
Two options:
- **(preferred)** Delete the function entirely. Update callers to set `subscription_expires_at = null` directly on EA publish.
- **(safer if you want to keep the call site stable)** Change the return type to `string | null` and return `null`. Then update the storage path to handle null without coercing to `now()`.

Either way, every call site that currently writes `eaPublishExpiry()` to `subscription_expires_at` should write `null` instead.

#### A-3. Comment cleanup
The comments at `src/lib/subscription.ts` lines 26-28 and 77 still reference the 30-day timer model. Update or delete to match new behavior. Same for the comment at the top of `src/app/api/campaign/claim/route.ts` (lines 10-12: "30-day timer does NOT start until GRID_LAUNCH_DATE").

---

### B. Profile state & dashboard

#### B-1. StatusBar countdown (frontend already hid the JSX, backend completes the cleanup)
File: `src/components/dashboard/StatusBar.tsx`

I left in place:
- `daysUntilExpiry()` helper
- `useEffect` that computes `countdown` state
- Lines 35-38 in `deriveStatus()` that flip status to `"expired"` if `subscriptionExpiresAt < now`

Once you null `subscription_expires_at` for EA profiles, none of this fires for them. But for true cleanup:
- The `daysUntilExpiry` helper and the `countdown` state are now unused (their JSX render is commented out). Could be deleted as dead code, or leaves them parked for a future paid-subscription countdown.
- The `expired` branch in `deriveStatus()` will still apply to **paid** profiles whose subscription lapsed — that's correct. Don't remove it.

No backend code change strictly required here — flagging so you know the frontend isn't relying on the field for EA users anymore.

#### B-2. `subscription_expires_at` data migration
For existing EA profiles in production:
- Find all rows with `is_early_adopter = true` AND `subscription_expires_at IS NOT NULL`
- Set `subscription_expires_at = NULL`

Silent retroactive change per Kellen — **no notification copy needed**. Anyone who was promised 30 days now has forever.

#### B-3. Future EA claims
`/api/campaign/claim` and `/api/profile/publish` should both write `subscription_expires_at = null` on the path that grants EA. Confirm both paths are covered.

---

### C. Cron job

#### C-1. `src/app/api/subscription/cron/route.ts`

Lines 49-50 already have a partial guard:
```ts
const isEaWithNoExpiry = p.isEarlyAdopter && !p.subscriptionExpiresAt;
```
Good — this skips EA-with-null-expiry profiles. Confirm it's actually treating them as paid-and-active (not downgrading them to FREE).

Once B-2 is done (all EA rows have `subscription_expires_at = null`), the existing guard naturally covers them. No code change strictly required if the guard works as intended — but please verify by running the cron in dry-run mode against a snapshot.

#### C-2. Notification side effect
The cron currently inserts a `subscription_expired` notification when it flips a profile to FREE. Make sure no EA profile gets this notification under any code path.

---

### D. Telegram bot

#### D-1. `@LastShiftAuthBot` 3-day reminder
The /help page (commit `abb7896`) now tells users:
> "3 days before your **paid subscription** lapses, we send a reminder via @LastShiftAuthBot. (First 5,000 / EA profiles don't expire and won't get this message — it only fires for paid subscriptions.)"

Backend behavior must match. If the bot was originally wired to scan EA profiles approaching their 30-day window, that scan must now:
- **Skip** all rows with `is_early_adopter = true` (they never expire)
- **Continue to fire** for non-EA profiles whose `subscription_expires_at` is within 3 days

If the bot was EA-only and isn't yet wired for paid-subscription lapses, that's a separate buildout. Either way, the FAQ now describes the post-cap behavior — so the bot needs to either match it or get a follow-up to wire the paid-lapse path.

#### D-2. Outgoing queue cleanup
If there are queued reminder messages already addressed to EA users (because the cron previously enqueued them ahead of 2026-06-07), purge them before they send.

---

### E. Session / Terminal contract

#### E-1. `src/lib/session.ts`
Fields from Terminal:
- `firstFiveThousand: boolean` — keep, semantically still valid (means "is one of the first 5K")
- `freeSubUntil: string | null` — currently carries `"2026-06-07T00:00:00+00:00"` for EA holders

Decision needed: does `freeSubUntil` still make sense?
- **If yes (rename only):** rename to something like `eaForever: boolean` — but that's redundant with `firstFiveThousand`.
- **If yes (keep as null sentinel):** Terminal returns `null` for EA holders. Document the new contract.
- **If no:** drop the field entirely. No frontend code consumes it after the StatusBar JSX removal.

The cleanest path is dropping `freeSubUntil` from the Terminal validate response and the session shape. But that's a Terminal-side change too — coordinate with whoever owns lastshift.app's `/api/license/validate`.

#### E-2. `src/app/api/mock/terminal/api/license/validate/route.ts`
Mock currently returns `freeSubUntil: "2026-06-07T00:00:00+00:00"`. Whatever you decide for E-1, mirror it in the mock.

---

### F. Tests

#### F-1. `tests/unit/subscription.test.ts` lines 129-133
```ts
test("subscription: EA publish expiry is Grid launch + 30 days", () => {
  const expected = new Date("2026-06-07T00:00:00Z").toISOString();
  assert.equal(eaPublishExpiry(), expected);
});
```
Will fail when `eaPublishExpiry()` is removed/changed. Either:
- Delete the test (preferred if function is removed)
- Replace with `assert.equal(eaPublishExpiry(), null)` if function returns null
- Add a new test asserting EA profiles never have an expiry set

#### F-2. New test recommendations (not strictly required, useful)
- EA profile cron run does not flip the profile to FREE
- `/api/campaign/claim` writes `subscription_expires_at = null` on success
- Telegram reminder cron skips rows where `is_early_adopter = true`

---

## Verification checklist (after backend changes ship)

- [ ] Pull a production EA profile via `select` — confirm `subscription_expires_at = null`
- [ ] Run `tsc --noEmit` and `npm test` — green
- [ ] Hit `/api/campaign/claim` in staging with a fresh wallet — claim succeeds, profile row has `subscription_expires_at = null`
- [ ] Trigger the subscription cron in staging — no EA profile gets flipped to FREE, no `subscription_expired` notification inserted for EA users
- [ ] Confirm the Telegram reminder cron does not enqueue messages for any `is_early_adopter = true` row
- [ ] On the live `/manage/profile` dashboard, an EA user sees no countdown and the profile status reads ACTIVE (not EXPIRED, not PENDING)
- [ ] Visit `/help` and confirm the rewritten copy is accurate against actual backend behavior

---

## Open questions for product / coordinator (not blocking, but flag for the call)

1. **What happens after 5,000 cap is hit?** All public copy says "then $10/mo." Confirm the campaign-claim API actually rejects new claims once the count hits 5,000 (look at `MAX_CLAIMS = 5000` in the claim route).
2. **Lapse-to-free policy for paid subscribers.** The cron still flips paid profiles to FREE on expiry. Confirm that's the intended behavior post-cap (the help-page diagram still shows that arrow).
3. **EA badge longevity.** The 5K badge (`pp-badge-5k` in `ProfileHero`) is gold and reads "First 5000 operator — founding member." That's correct under new model — confirm the badge stays visible forever (not tied to any expiry).
4. **Profile-state machine** in `/help` now says EA profiles can leave only "if you choose to" or via "no abuse / no 90+ days fully inactive on a defunct path." Confirm there's no code path that auto-flips EA → FREE besides those.

---

## Reference: source markdown for help page

Help-page rewrites are in `src/app/(marketing)/help/page.tsx`. If you need to compare against what was there before, the previous content is in commit `abb7896`'s parent (`e492420` or earlier).

---

## Contact
Frontend session is on `main` and standing by for follow-up questions. Reach via the same Kellen-relay channel.
