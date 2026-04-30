-- 0027_ea_subscription_forever.sql
-- 2026-04-30 — First-5,000 program shifted from "free for 30 days post-Grid-
-- launch" to "free FOREVER for the first 5,000 operators." This migration
-- backfills existing EA rows: anything with `is_early_adopter = true` AND
-- a non-null `subscription_expires_at` gets nulled.
--
-- The deployed code (claim/route.ts, publish/route.ts) already writes null
-- on new EA grants as of v0.13.6. This migration handles the existing
-- population (claimed before the v0.13.6 deploy with `2026-06-07` stamped).
--
-- SAFETY NETS:
--   1. Backup table preserves the pre-migration shape so we can revert if
--      something goes wrong. Keep it indefinitely.
--   2. Pre-flight RAISE NOTICE shows how many rows will change.
--   3. Post-flight RAISE EXCEPTION verifies zero EA rows still have an
--      expiry — if it raises, the migration is incomplete and you should
--      investigate before assuming success.
--
-- After running, run the verification query at the bottom in the SQL Editor
-- and paste the result. Migration is idempotent — safe to re-run.

-- 1. Snapshot existing EA rows
create table if not exists _backup_ea_subs_2026_04_30 as
select
  id,
  is_early_adopter,
  subscription_expires_at,
  ea_claimed,
  ea_number,
  is_paid,
  now() as backed_up_at
from profiles
where is_early_adopter = true;

comment on table _backup_ea_subs_2026_04_30 is
  'Pre-migration snapshot of EA profiles before subscription_expires_at was nulled. Drop after a few weeks of stable production behavior.';

-- 2. Pre-flight count
do $$
declare
  c int;
begin
  select count(*) into c
  from profiles
  where is_early_adopter = true
    and subscription_expires_at is not null;
  raise notice '[0027] Will null subscription_expires_at on % EA rows', c;
end $$;

-- 3. The migration
update profiles
set subscription_expires_at = null
where is_early_adopter = true
  and subscription_expires_at is not null;

-- 4. Post-flight verification — fails loud if anything was missed
do $$
declare
  remaining int;
begin
  select count(*) into remaining
  from profiles
  where is_early_adopter = true
    and subscription_expires_at is not null;
  if remaining > 0 then
    raise exception '[0027] Migration incomplete: % EA rows still have non-null subscription_expires_at. Investigate before assuming success.', remaining;
  end if;
  raise notice '[0027] Migration complete. All EA profiles now have null expiry.';
end $$;

-- 5. Verification queries — run separately in the SQL Editor and paste
--    the results back to confirm.
--
-- a) Should return 0:
-- select count(*) from profiles
-- where is_early_adopter = true and subscription_expires_at is not null;
--
-- b) Should return > 0 (sanity: actual EA users exist):
-- select count(*) from profiles where is_early_adopter = true;
--
-- c) Should return > 0 if any paid subscribers exist (they're untouched):
-- select count(*) from profiles
-- where is_early_adopter = false and subscription_expires_at is not null;
--
-- d) Backup row count should match the pre-migration count from step 2:
-- select count(*) from _backup_ea_subs_2026_04_30;
