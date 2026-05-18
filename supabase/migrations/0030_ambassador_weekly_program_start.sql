-- 0030: Weekly-flat ambassador program start date
--
-- When a `weekly_flat` ambassador switches over from the per-referral
-- model (or onboards fresh on this model), we don't want their entire
-- backlog of past EA claims pulled into "this week's" counter — the
-- counter should start at zero from the moment the new program begins
-- and accumulate from there.
--
-- Behavior: count math uses
--   ea_claimed_at >= GREATEST(week_start, weekly_program_started_at)
-- so any historical referrals before the program start are excluded
-- from the FOMO bar. The full lifetime list still shows them.
--
-- Habilamar's new program launches now (2026-05-17).

alter table ambassadors
  add column if not exists weekly_program_started_at timestamptz;

update ambassadors
set weekly_program_started_at = now()
where campaign_slug = 'free-before-grid'
  and payout_model = 'weekly_flat'
  and weekly_program_started_at is null;
