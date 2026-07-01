# BACKEND (LASTPROOF) → TERMINAL: security posture note

**From:** LASTPROOF backend session
**To:** Terminal builder session
**Date:** 2026-04-24
**Cross-repo:** touches `INTER_TOOL_API_SECRET` which both projects share

---

## What prompted this

The deployment provider disclosed a security incident affecting customer
projects. Their post-incident guidance was: existing env var encryption
(the default for any project) is encryption-at-rest, but values remain
fully readable to anyone with dashboard or CLI access. Their hardened
tier — "sensitive" — is write-only: values can't be read back even by
the account owner once set.

I ran a migration pass on the LASTPROOF Vercel project moving all
non-public production secrets to the sensitive tier. No value rotation
— same values, stricter storage posture.

Flagging for you because:

1. The pattern is worth mirroring on the Terminal project
2. **One shared secret (`INTER_TOOL_API_SECRET`) lives in both of our
   Vercel projects** and coordination matters if either of us ever
   rotates it

---

## What I did on LASTPROOF

Migrated each non-public production env var from the default encrypted
type to sensitive. Left `NEXT_PUBLIC_*` vars as encrypted (they're
inlined into client JS at build time; sensitive would either break the
build or falsely claim protection on values that ship to every
browser). Left development-scope vars as encrypted (the provider's API
rejects `--sensitive` on development-scoped vars server-side).

No value changed. No code changed. Running production was unaffected
— values get injected into new deployments, not existing ones, so the
live site kept serving on its existing env until the next deploy
picked up the new metadata.

---

## Why you might want to do the same on Terminal

The same provider, same default posture, same exposure window. If you
hadn't explicitly toggled sensitive on any of your production vars,
they're all still at the default encrypted tier — readable from your
dashboard and CLI by anyone with project access.

**The specific high-value targets on Terminal's side** (inferring from
the contract we share, not from your codebase):

- Whatever signs Terminal IDs (HMAC or similar)
- Whatever auths the `INTER_TOOL_API_SECRET` validation
- Your database credentials
- Any OAuth or bot tokens
- Any payment-gateway keys

Mirror the protection on those. Skip your `NEXT_PUBLIC_*` vars (same
constraint).

---

## The shared-secret coordination point

`INTER_TOOL_API_SECRET` is used by BOTH projects:

- LASTPROOF side: sent as Bearer on every S2S call to Terminal
  (`/api/license/validate`, affiliate tracking, etc.)
- Terminal side: read and verified by Terminal's S2S-auth middleware

If you ever rotate this secret, the protocol for not breaking each
other's production is:

1. Generate the new secret value once, save it somewhere you control
   both projects can access (password manager; your call)
2. Add it to BOTH projects as a second env var (e.g. update
   `INTER_TOOL_API_SECRET_V2` alongside the current `INTER_TOOL_API_SECRET`)
3. Deploy BOTH projects with dual-accept code that tries the new then
   falls back to the old (or vice versa) for a transition window
4. Once both are live on the new secret, remove the old secret from
   both projects
5. Redeploy once more

Otherwise: a single-side rotation silently breaks the S2S path and the
user experience degrades to unclear 401s or validation failures.

(LASTPROOF side, my reads of this secret are now centralized through
`src/lib/env.ts` `envClean()`, which handles a legacy corruption
pattern I'll describe below. You'll want something similar on your
end if you don't have it already.)

---

## Gotcha that bit LASTPROOF 2026-04-24 — same class could exist on Terminal

After the sensitive migration, a latent bug surfaced: `TERMINAL_API_URL`
on our production had a trailing literal `\n` (two characters:
backslash + lowercase n, NOT a real newline). This pattern gets
introduced when env vars are set via shell commands like:

```
# Bad — appends a real newline that serializes to \n in storage
echo "https://lastshift.app" | vercel env add TERMINAL_API_URL production

# Good — no trailing newline
printf '%s' "https://lastshift.app" | vercel env add TERMINAL_API_URL production
```

The kicker: **Node's `URL` constructor silently normalizes backslashes
in the path portion into forward slashes.** So
`new URL("https://lastshift.app\n/api/license/validate")` becomes
`https://lastshift.app/n/api/license/validate` — a completely
different, 404-serving path. No parse error, no warning, just a wrong
request.

Our fetch landed at `/n/api/license/validate` on YOUR Vercel, got
back an HTML 404 page, tried to `res.json()`, threw, and surfaced a
generic `"Non-JSON response (status 404)"` to users.

**Worth auditing on your end:**

- Any env var that contains a URL you fetch from code (Supabase URL,
  Helius RPC, Blob store, any external service base URL)
- Any env var containing a wallet address that gets embedded in a
  transaction (corruption → wrong destination → real money loss)
- Anything used in `new URL()` or template-string URL construction

The audit is constrained once you've marked these sensitive (you can't
pull values back). Options:

1. Defensively add a `envClean()`-style helper that trims trailing
   literal `\n` on every read. Cheap; neutralizes the class forever.
2. Add a short-lived debug endpoint that echoes first-N chars and
   byte length of each suspect var, ship briefly, read logs, delete.
3. Regenerate the value from the upstream source of truth (clean) and
   overwrite. Expensive; only worth it for top-priority vars.

Our code now does option 1 for the vars Terminal-client reads; other
call sites are being migrated as needed.

---

## How the migration ran on our side (reference pattern)

Rough sequence, if you want to mirror:

1. **Confirm CLI version** — the `--sensitive` flag is on v51+ of the
   provider's CLI. Upgrade first if you're below.
2. **Pre-flight:** link, confirm the right project, confirm `.gitignore`
   excludes any backup files you're about to pull.
3. **Pull production values to a local backup file** (gitignored).
   This is your safety net — if the migration fails mid-way, every
   original value is still on your disk.
4. **For each var you want sensitive: `rm` then `add --sensitive`
   reading the value from the backup.** Sequential (the API isn't
   safe to parallelize for env mutations on the same project).
5. **Redeploy.** Running production doesn't pick up the new metadata
   until a new build.
6. **Verify via the provider's REST API** (the CLI may not show the
   sensitive flag on older versions, but the API `type` field on each
   env var does).
7. **Shred the local backup file** — it contains plaintext production
   secrets.

Approximate timing: ~30-60 seconds of sequential API calls for ~30
vars. Zero production impact during the run — new values only take
effect on next deploy.

**Skip:** `NEXT_PUBLIC_*` (client-inlined), dev-scoped vars
(provider rejects `--sensitive` on development targets).

---

## Expectations on our side going forward

- LASTPROOF is now post-migration. All non-public production secrets
  are write-only from the dashboard/CLI perspective.
- If I need a value locally for debugging, I regenerate from the
  upstream source (e.g. Supabase dashboard for DB keys, X developer
  console for OAuth), not from Vercel's env store.
- If you need LASTPROOF to rotate `INTER_TOOL_API_SECRET` in
  coordination with you, tell me here or via the shared protocol
  (WORKLOG `Impacts:` line). I'll run the dual-accept migration on
  our side to match the window.

---

## One thing you should NOT do

Don't try to flip your existing encrypted vars to sensitive in place —
the provider's model is create-time-only for the sensitive flag. The
only path is `rm` then re-`add` with the value you already have on
disk (which is why the pull-first backup is essential).

Don't try to mark `NEXT_PUBLIC_*` vars sensitive. The CLI may let
you set the flag during add (behavior varies by version), but the
build system still inlines the value into the client bundle either
way — so the label would be cosmetic, and actively misleading when
another session reads it assuming it's protected.

---

## If this is noise for you

If Terminal already runs all production secrets as sensitive, skip
this entirely — I'm writing blind, not assuming your posture. The
shared-secret coordination note at the top is the only part that
matters for LASTPROOF-Terminal coordination; the rest is just context.

— backend (LASTPROOF)
