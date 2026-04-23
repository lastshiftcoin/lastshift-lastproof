# LASTPROOF — Supabase

Canonical source of truth for schema, RLS, and migration flow.

## Apply a fresh migration

Two supported paths depending on whether you have the Supabase CLI installed.

### Option A — Supabase CLI (recommended)

```bash
# one-time: link this repo to the remote project
supabase link --project-ref <project-ref>

# push migrations
supabase db push
```

The CLI reads every file under `supabase/migrations/` in lexicographic
order and applies new ones.

### Option B — raw psql

```bash
export LASTPROOF_DB_URL="postgresql://postgres:<svc_role_password>@db.<project-ref>.supabase.co:5432/postgres"
psql "$LASTPROOF_DB_URL" -f supabase/migrations/0001_init.sql
```

`0001_init.sql` is idempotent-where-practical (`create table if not
exists`, `drop policy if exists ... create policy ...`) so a partial
re-run is safe.

## Verify RLS denies anon writes

After applying `0001_init.sql`, run this from `psql` with the **anon**
key to confirm writes are rejected:

```sql
-- should fail with "new row violates row-level security policy"
insert into profiles (operator_id, handle) values (gen_random_uuid(), 'rls_test');
```

And this to confirm anon reads of the view are gated:

```sql
-- should return 0 rows until you seed a paid + published profile
select id, handle, tier from public_profiles;
```

## Schema shape

See `migrations/0001_init.sql`. Tables mirror the in-memory stores in
`src/lib/*-store.ts` one-for-one — the dual-write adapter layer (see
`src/lib/db/`) will translate between them.

Write side: service role key only, via server routes.
Read side:
  - Public clients → `public_profiles` / `public_profiles_expired` views
  - Server routes (dashboard, cron, webhooks) → service role, bypasses RLS
