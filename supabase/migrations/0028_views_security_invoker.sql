-- 0028_views_security_invoker.sql
--
-- Resolve Supabase Security Advisor errors:
--   - security_definer_view: public.grid_operators
--   - security_definer_view: public.referral_funnel_daily
--
-- Both views were created without `security_invoker = true`, so they
-- run with the view owner's (postgres superuser's) permissions — the
-- linter flags this as a SECURITY DEFINER pattern that bypasses RLS
-- on underlying tables.
--
-- Today the bypass is harmless: both views are queried server-side
-- only via the service role, which bypasses RLS regardless. This
-- migration is defense-in-depth: if any future change accidentally
-- grants SELECT on these views to anon or authenticated, RLS on the
-- underlying tables (profiles, referral_events, proofs, categories,
-- profile_categories) will still deny the read.
--
-- No data change. Idempotent — safe to re-run.

alter view public.grid_operators
  set (security_invoker = true);

alter view public.referral_funnel_daily
  set (security_invoker = true);

-- Verification (prints to NOTICES tab — should show
-- {security_invoker=true} for both views).
do $$
declare
  r record;
begin
  for r in
    select relname, reloptions
    from pg_class
    where relname in ('grid_operators', 'referral_funnel_daily')
      and relkind = 'v'
  loop
    raise notice '[0028] view % options: %', r.relname, r.reloptions;
  end loop;
end $$;
