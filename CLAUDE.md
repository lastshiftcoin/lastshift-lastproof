# LASTPROOF — architectural source of truth

This file is the top-level architectural anchor for the LASTPROOF codebase.
It exists to stop drift between the plan, the wireframes, and the code.

**Visual + functional canon lives in the wireframes** (`wireframes/*.html`).
They were designed with the builder down to the last detail. When the plan,
this doc, or any code disagrees with the wireframes, **the wireframes win**.

For the full per-screen mapping (which wireframe → which route, with all
the design-token and tier details spelled out) see:

  → `LASTPROOF-BUILDER-HANDOFF.md`

That doc is the companion to this one. Read both.

---

## Tier system (locked to wireframes)

**Four tiers, pure proof count, no gates.** The old T5/T1–T4 split from
the original plan file is **dead** — replaced by the wireframe-canonical
system below.

| Tier   | Name        | Proof threshold | Color  |
|--------|-------------|-----------------|--------|
| TIER 1 | NEW         | 0+              | silver `#9ca3af` |
| TIER 2 | VERIFIED    | 10+             | bronze `#cd7f32` |
| TIER 3 | EXPERIENCED | 25+             | gold `#ffd700`   |
| TIER 4 | LEGEND      | 50+             | purple `#a78bfa` |

Rules:
- Thresholds are **on-chain minted proofs**, nothing else. No age gates,
  no dispute gates, no activity gates.
- Tier is recomputed live on each confirmed proof and cached on
  `profiles.tier`. Source of truth: `src/lib/tier.ts` → `computeTier()`.
- **Tier number is never shown alone.** Always paired with its word name
  via `·`: `TIER 1 · NEW`, `TIER 2 · VERIFIED`, `TIER 3 · EXPERIENCED`,
  `TIER 4 · LEGEND`.
- Never use green for a tier label (reserved for DEV badge, verified
  state, and money). Never use orange (brand accent only).
- **Free profiles have no tier section at all.** They render the
  `lastproof-profile-free.html` variant, which strips the tier bar, the
  hire button, and the verified section. Free = not paid AND/OR not
  published. Handled by route-level variant selection, not by giving
  them a fifth tier value.

### Internal T5 sentinel
`computeTier()` still returns `5` for unpaid/unpublished profiles so
callers can cheaply check "on the ladder or not." `5` is never rendered
as a word — the free-variant wireframe branches on it before any tier
UI is generated. Treat it as `null` conceptually; the numeric value is
only for backwards compatibility with the existing `profiles.tier`
column.

---

## Store architecture (Phase 3 — complete)

All ten stores run on Supabase (as of 2026-04-10):

| Store             | Mode     | Adapter                              |
|-------------------|----------|--------------------------------------|
| profiles          | supabase | `src/lib/db/profiles-adapter.ts`     |
| payments          | supabase | `src/lib/db/payments-adapter.ts`     |
| quotes            | supabase | `src/lib/db/quotes-adapter.ts`       |
| proofs            | supabase | `src/lib/db/proofs-adapter.ts`       |
| notifications     | supabase | `src/lib/db/notifications-adapter.ts`|
| handle_history    | supabase | `src/lib/db/handle-history-adapter.ts`|
| work_items        | supabase | `src/lib/db/work-items-adapter.ts`   |
| screenshots       | supabase | `src/lib/db/screenshots-adapter.ts`  |
| profile_links     | supabase | `src/lib/db/profile-links-adapter.ts`|
| profile_categories| supabase | `src/lib/db/profile-categories-adapter.ts`|

The original six stores have three modes (`memory` | `dual` | `supabase`)
selected by `LASTPROOF_DB_<STORE>` env. The dispatch lives in
`src/lib/db/mode.ts`. The four newer adapters (work_items, screenshots,
profile_links, profile_categories) are supabase-direct — no memory/dual
layer, just the adapter.

---

## Terminal bridge

- Real Terminal: `https://lastshift.app` (prod), `https://staging.lastshift.app`
  (staging), `http://localhost:3000` (dev).
- Local mock: `src/app/api/mock/terminal/*` — rewritten 2026-04-08 to
  match the real Terminal byte-for-byte. Proven by
  `scripts/terminal-bridge-smoke.ts` (10/10 green against both).
- S2S auth: `Authorization: Bearer ${INTER_TOOL_API_SECRET}` +
  `X-LastShift-Key-Id: v1`.
- Seed row for testing: wallet `TEST1111111111111111111111111111111111111111`,
  TID `SHIFT-TEST-0001-0001-0001`.

---

## Session protocol — multi-session / multi-machine coordination

This repo is edited from multiple Claude sessions, sometimes across different
machines (e.g. a MacBook Air + an iMac sharing files over iCloud). The
`WORKLOG.md` file at the repo root is the authoritative hand-off log so
sessions don't overwrite each other's context.

**At session start — before any substantive work:**
1. Read `WORKLOG.md` top-to-bottom to at least the last 3 entries. "Open /
   next" and "Gotchas for next session" from the previous entry are
   non-negotiable context.
2. Run `git log --oneline -20` to see what shipped recently — commit
   messages are the ground truth for *what changed*; WORKLOG.md is the
   ground truth for *why and what's still in flight*.
3. Run `git status` to confirm the working tree is clean. If it isn't,
   figure out which prior session left work uncommitted **before** starting
   your own. iCloud syncs files across machines; git does not.

**At the end of every substantive work block — before responding "done"
to the user on a task that shipped code, ran migrations, changed
architecture, or resolved an open item from a prior entry:**
4. Append a new entry at the **top** of `WORKLOG.md` using the template at
   the bottom of that file.
5. Capture device + platform + model automatically — don't ask the user
   for what the environment can tell you:
   - Device: `scutil --get ComputerName` + `hostname` + `sw_vers -productVersion`
   - Platform: `$CLAUDE_CODE_ENTRYPOINT` (`claude-desktop` → Claude Desktop,
     `claude-cli` → terminal CLI, `cowork` → Cowork) and `$__CFBundleIdentifier`
     as a tiebreaker
   - Model: `$DEFAULT_LLM_MODEL`
   - Timestamp: `date "+%Y-%m-%d %H:%M %Z"`
6. If the change impacts Terminal (e.g. you changed how you call Terminal's
   `/api/license/validate`, changed the TID handshake, changed a shared
   secret) note it on the `**Impacts:**` line so the next Terminal session
   sees the pointer.
7. If you changed architecture (new subsystem, new table, new contract
   between services), **also update the relevant section of this file**.
   CLAUDE.md always reflects current truth. WORKLOG.md always reflects
   history. If they disagree later, CLAUDE.md wins — update it to match
   reality and leave a pointer in the newest WORKLOG entry.
8. Commit and push before signing off. Never leave uncommitted changes on
   disk — iCloud will sync them to other machines but git won't, creating
   exactly the divergence this protocol prevents.
9. If any commit in your work block changes user-visible behavior
   (dashboard, public profile, proof flow, payment flow, onboarding,
   copy, pricing, notifications users receive), follow **§ Updates feed
   — commit convention** below. That section governs commit subject
   prefix, `VERSION` bump, and `data/updates.json` entry. Non-user-facing
   work (protocol, WORKLOG, observability, internal refactors) is exempt.

The sibling log lives at `lastshiftcoin/lastshift-terminal` → `WORKLOG.md`.
When a Terminal change impacts this repo, the other session records it on
its `**Impacts:**` line; read their entry before touching related code.

**Never edit an older WORKLOG entry** except to mark an "Open" item as
resolved with a `→ resolved YYYY-MM-DD in <newer entry title>` pointer.
Append-only.

**iCloud sync conflicts:** if `git status` shows
`WORKLOG.md (conflicted copy …)`, merge both sets of entries in timestamp
order and commit — never discard either side. Git is the source of truth
for this repo; iCloud is incidental filesystem sync.

**If the WORKLOG entry would be effectively empty** (you only read files,
answered a question, nothing shipped or changed state), do not write an
entry. Only log work that another session needs to know about.

### Broken git state — stop, don't improvise

If git itself is in a degraded state — `fatal:` on basic commands, a ref
pointing at a missing object, staged changes you did not make, `.git/index N`
iCloud duplicate files, or unexplained dangling commits — **stop and
report before any recovery attempt**. The "never blind-commit" rule
extends into the `.git/` directory itself.

Minimum safe diagnostic pass before proposing any fix:

```
git fsck --full 2>&1
ls -la .git/objects/pack/
ls .git/ | grep -E "^(index|HEAD|FETCH_HEAD|ORIG_HEAD)"
```

Report the output verbatim, then propose a fix path (fetch + reset,
re-clone, cherry-pick, etc.) and wait for approval. **Never run**
`git gc`, `git reset --hard`, object deletion, or `git reflog expire`
without inspecting dangling-commit content first — a dangling commit
may be unpushed work from a prior session, and hard-resetting will
destroy it silently.

The first time this protocol handled a corrupt local repo (mac mini,
2026-04-20, commit object for `d04e9e9` lost mid-iCloud-sync), the
session correctly halted, ran diagnostics, identified that the
"dangling commit" was a week-old abandoned stash with no rescue value,
and only then executed the fix. That's the pattern.

### Task-specific sessions

Sessions tied to a specific in-flight task (content writing, docs,
feature work, debugging threads) follow the same protocol as the
named specialist roles. A few adaptations:

- **Self-declare a role descriptor** that reflects the session's
  current scope — e.g. `help-page`, `blog`, `payment-debug`,
  `onboarding-copy`. Stamp it on every WORKLOG entry:
  `**Role:** help-page`.
- **Don't collide with the four persistent roles**: `coordinator`,
  `backend`, `frontend`, `fullstack`. Anything else is fair game.
- **When the task is complete and the session is retired**, the role
  naturally retires with it. No cleanup of CLAUDE.md needed — the
  protocol doesn't enumerate valid roles, it just says "stamp one."
- **First-time onboarding of a task session** uses the same prompt
  shape as a specialist session but asks the session to declare its
  own role and one-sentence-summarize its in-flight task before
  continuing. Protocol onboarding is idempotent and won't disrupt
  the task work.

This convention was codified on 2026-04-20 after the help-page
session (author of `wireframes/how-it-works-CONTENT.md`) onboarded
cleanly without needing to fit into one of the four specialist
buckets.

### iCloud duplicates: hunt both files AND directories

iCloud creates conflict copies in two shapes, and one find pattern
catches only one of them:

- **Files** → `foo 2.ts`, `README 2.md` — caught by `-name '* 2.*'`
- **Directories** → `some-route 2/`, `components 2/` — caught by
  `-name '* 2*'` (no dot)

Hunt with both:

```
find . -path ./node_modules -prune -o -path ./.next -prune \
     -o -name '* 2*' -print 2>/dev/null   # catches dirs + files
find . -path ./node_modules -prune -o -path ./.next -prune \
     -o -name '* 3*' -print 2>/dev/null   # 3rd-generation conflicts
```

For every duplicate found, diff against its canonical counterpart
before deletion. 99% of the time they're byte-identical iCloud garbage.
When they differ, the " 2" copy is usually a stale pre-refactor snapshot
(same mechanism as the 2026-04-20 drift triage) — but occasionally it
holds unique work that iCloud couldn't merge. Inspect. Then delete the
stale side and preserve the canonical. **Never blanket-rm without the
diff pass.**

---

## Updates feed — commit convention

LASTPROOF publishes a user-facing updates feed at `/status` (and the
full archive at `/status/all`). The feed is sourced from
`data/updates.json`, versioned against the `VERSION` file at the repo
root, and governed by the commit convention below.

The feed is the *only* place the public hears what changed. If a
session ships user-visible behavior without following this convention,
the change doesn't land on the feed and users don't see it. Treat the
convention as non-negotiable for commits that touch the user
experience.

### When the convention applies

Any commit that changes what a user *sees, clicks, pays, or
experiences* on lastproof.app — dashboard, public profile, proof
flow, payment flow, onboarding, landing pages, copy, layout,
responsiveness, pricing, error messages, email / bot notifications
users receive. If a non-technical user would notice the difference
when you ship the commit, the convention applies.

### When it does NOT apply

- WORKLOG entries
- CLAUDE.md / protocol edits
- Observability / logging / metrics internals users don't see
- Internal refactors, renames, typed-cleanup, test changes
- Migrations users don't feel (schema changes that don't surface
  new UI or break existing UI)
- Deployment config, CI tweaks, env var additions
- iCloud / git-hygiene cleanup
- Reverting same-session work that never shipped

Rule of thumb: if you couldn't write a non-jargon sentence
describing what changed from a user's seat, the convention doesn't
apply.

### What the convention requires

Every qualifying commit MUST do three things in the same commit:

**1. Prefix the commit subject** with one of:

```
[update: fixed]    <subject>
[update: added]    <subject>
[update: improved] <subject>
```

The category reflects the user-facing nature of the change:

- `fixed` — something was broken, now it works (bug fix, regression)
- `added` — a new capability, surface, or action exists
- `improved` — something that worked now works better (clarity,
  speed, reliability, visual polish)

**2. Bump `VERSION`** per category:

- `fixed` → patch bump (0.6.1 → 0.6.2)
- `improved` → patch bump (0.6.2 → 0.6.3)
- `added` → minor bump (0.6.3 → 0.7.0)

Major bumps (1.0.0, 2.0.0, …) are **reserved for externally-
communicable milestones** — e.g. Grid launch at 2026-05-08 will
trigger the 0.x → 1.0.0 transition. Regular commits NEVER bump
major; they only bump minor or patch per the rules above. The jump
to a new major is a deliberate coordinator decision, not a side
effect of any single commit.

**3. Append an entry to `data/updates.json`** (newest first), and
update the top-level `latest_version` field to match your new
`VERSION`.

### Schema

`data/updates.json` has a fixed shape:

```json
{
  "latest_version": "0.6.2",
  "entries": [
    {
      "version": "0.6.2",
      "date": "2026-04-18",
      "category": "improved",
      "headline": "Mobile wallet returns now resume where you left off.",
      "copy": "Switching to your wallet app during a payment or proof no longer loses your spot. When you come back to LASTPROOF, you'll pick up exactly where you were — no restart, no re-entering details.",
      "source_commits": ["d04e9e9"]
    }
  ]
}
```

Field rules:

- `version` — must match the `VERSION` file at commit time
- `date` — `YYYY-MM-DD`, no time component
- `category` — exactly one of `fixed` | `added` | `improved`
- `headline` — one sentence, no trailing period on the headline
  itself unless it's a natural sentence end (shorter headlines
  often end without). First-person language is fine.
- `copy` — 1–3 sentences. Bullets allowed when shipping something
  big enough to need structured enumeration (rare). Voice rules
  below are binding.
- `source_commits` — array of short-SHAs (7 chars) tied to this
  entry. Usually one; occasionally a small cluster when related
  commits land together.

`latest_version` at the top is redundant with `entries[0].version` —
it exists so the /status hero card can read one field without
parsing the array. **Always update both in the same commit.** If
you touch one and forget the other, the page lies to users about
what version they're on.

`entries` array is **newest-first**. Never reorder. Append to the
top, never the bottom.

### Voice rules for the `copy` field

The feed is read by marketers, operators, and casual visitors —
not engineers. The voice is App Store changelog tone: warm, direct,
specific about the user outcome.

**Banned words** (if one appears in your `copy`, rewrite):

```
schema         API            endpoint
migration      backfill       commit
SHA            route          handler
```

**Banned patterns**:

- "We updated the X to Y" — instead say what the user now
  experiences
- "Improved performance of X" — instead, what does the user feel?
- Naming internal systems or libraries by their code name

**Encouraged patterns**:

- Lead with the user outcome: "Profile page loads instantly now"
- Short. One sentence is often enough.
- Specificity over vagueness: "within 200ms" beats "fast"
- Second-person when natural: "you'll pick up exactly where you
  were" beats "users are returned to their previous state"

**Calibration corpus**: when in doubt, read the top 5 entries of
`data/updates.json`. If yours doesn't feel like it belongs next to
them, rewrite. The existing entries are the tone reference.

### Multi-commit changes

When a user-facing change lands across multiple commits (e.g. a
feature requires three commits: route, component, style), only the
*last* commit that completes the user-facing change gets the
`[update: X]` prefix and triggers the VERSION bump + entry. Earlier
commits in the chain stay un-prefixed and don't touch VERSION.
Reference all relevant SHAs in the entry's `source_commits` array.

Rationale: the feed reflects *shippable user state*, not development
milestones. An entry should never point to a commit that leaves the
app in a broken state.

### What about reverts?

If you ship an `[update: added]` entry, then the next day have to
revert it because of a bug, that's a `[update: fixed]` entry ("We
temporarily rolled back X while we investigate reports of Y.")
followed later by a new `[update: added]` when the feature returns.
Don't edit the original entry. The feed is append-only history, not
a patched document. Users saw the first entry; pretending it never
happened is dishonest.

### Enforcement

No automated check blocks a non-conforming commit today. The
protocol relies on each session remembering the convention at
commit time. If a coordinator review (weekly or ad-hoc) catches a
user-visible commit that skipped the convention, the fix is an
immediate follow-up commit that backfills VERSION + the entry with
a reference to the original SHA.

Future improvement: a commit-msg hook that validates the prefix +
VERSION diff + `data/updates.json` diff before allowing the commit.
Not built today; flagged for a quiet session.

---

## Priorities

Wireframes drive implementation order. Current priority (set by user,
2026-04-08):

1. **Public profile** (`lastproof-profile-public.html`) — the artifact
   operators paste into 100 DMs a day. Shareable cold link, no auth.
2. **Proof flow** — the "VERIFY THIS WORK" modal on public profiles.
   **Higher stakes than payments**: a fake dev verification poisons
   the trust system. Token-dev qualification gate in
   `lib/token-dev-verify.ts` is the single most important piece of
   logic in the app.
3. **Onboarding + MVP dashboard** — claim handle, add 1–3 work items,
   publish.
4. **Subscription payments** — rollover, countdown, stripe-down.
5. **Full dashboard polish** — screenshots, links, categories.
6. **Grid** — discovery layer. Launches 2026-05-08 per `GRID_LAUNCH_DATE`.
7. **SHIFTBOT** — search over the populated Grid.

Grid is the network effect. The profile + proof loop is the atomic
unit. Atomic unit ships first.

---

## Stale docs to ignore
- The top-level "Final Plan" markdown in `~/.claude/plans/` — superseded
  by the wireframes for anything UI-related, and superseded by this
  doc + `LASTPROOF-BUILDER-HANDOFF.md` for tier definitions.
