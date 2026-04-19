-- 0020: Backfill @coreops's referral attribution to @TheLeadOps.
--
-- Evidence trail in referral_events (2026-04-18):
--   17:08-18:38  seven landing_visit events on /free-early-access
--                from the same Android device (RMX1992).
--   18:38:45     register_tid insert for wallet
--                4yZoPSQXFAW51z7m5yf2hQmBEsiRpMCNjThvyES2aeh3 —
--                incomingRef=null. The ref was lost during the
--                Phantom mobile wallet return roundtrip.
--   19:04:36     campaign_claim fired with source=none.
--
-- Root cause fixed in the follow-up commit: ManageTerminal now
-- stashes ref_slug in localStorage so it survives mobile wallet
-- deep-link returns.
--
-- This backfills the one user affected by the mobile-return bug.

update profiles
set referred_by = 'free-early-access'
where handle = 'coreops'
  and referred_by is null;

update operators
set referred_by = 'free-early-access'
where id = (
  select operator_id from profiles where handle = 'coreops'
)
and referred_by is null;
