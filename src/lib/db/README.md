# `src/lib/db/` — dual-write adapter layer

This directory is the SINGLE boundary between LASTPROOF's in-memory
stores and Supabase. Nothing else in `src/` imports `@supabase/supabase-js`.

## Files

- `client.ts` — lazy service-role + anon Supabase client singletons
- `mode.ts`   — per-store backend mode flag (`memory` / `dual` / `supabase`)
- `case.ts`   — camelCase ↔ snake_case row converters
- `health.ts` — DB reachability probe for `/api/health`

## Migration plan (Step 16)

Each store gets a thin adapter file here (e.g. `quotes-adapter.ts`) that
exposes the same shape as the in-memory store. The store file itself
becomes a switch:

```ts
const mode = getStoreMode("quotes");
if (mode === "memory") return memoryImpl(...);
if (mode === "dual")   { memoryImpl(...); void supabaseImpl(...); return ... }
if (mode === "supabase") return await supabaseImpl(...);
```

Flip order — one per deploy, verify with `/api/health` between each:

1. `quotes`         (no FK dependents on other adapted tables yet)
2. `payments`       (FK → quotes, profiles)
3. `profiles`       (FK target for everything)
4. `proofs`         (FK → work_items → profiles)
5. `notifications`  (FK → profiles)
6. `handle_history` (FK → profiles)

After all six are `supabase`, the in-memory implementations get deleted.

## RLS reminder

Service role bypasses RLS. Anon client respects it. Public reads of
profile data MUST go through the `public_profiles` /
`public_profiles_expired` views, not the `profiles` table.
