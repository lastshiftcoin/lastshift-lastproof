-- 0018: Backfill @parallell's referral attribution to @TheLeadOps.
--
-- Confirmed manually by the user: @parallell signed up via
-- lastproof.app/free-early-access (theleadops' campaign URL) but
-- attribution was lost because the Next 16 Server Component cookie
-- write is a silent no-op and the ?ref= URL param didn't survive
-- the onboarding funnel. See migration 0017 for the forward fix.
--
-- This is the ONLY confirmed pre-fix referral. Any further backfills
-- should be handled via the broader strategy discussion, not by
-- extending this migration.

update profiles
set referred_by = 'free-early-access'
where handle = 'parallell'
  and referred_by is null;

-- Also stamp the operators row so the source-of-truth is consistent
-- with post-fix behavior.
update operators
set referred_by = 'free-early-access'
where id = (
  select operator_id from profiles where handle = 'parallell'
)
and referred_by is null;
