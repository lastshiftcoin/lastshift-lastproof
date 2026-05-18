-- 0029: Ambassador weekly-target model (Habilamar opt-in)
--
-- Adds a new payout shape for ambassadors paid a flat monthly retainer
-- with a weekly referral quota, instead of the per-referral $0.50 model.
-- Initially only @Habilamar_ibn opts in — others stay on per_referral.
--
-- Schema additions on `ambassadors`:
--   payout_model            text   — 'per_referral' (default) | 'weekly_flat'
--   weekly_referral_target  int    — quota for the bar; null for per_referral
--   display_timezone        text   — IANA tz for report display ("Europe/Istanbul")
--
-- Report behavior is keyed off payout_model: 'weekly_flat' rows render a
-- weekly progress bar (X / target) instead of AMOUNT OWED, and times are
-- shown in display_timezone so the ambassador reads them in their own
-- locale.

alter table ambassadors
  add column if not exists payout_model text not null default 'per_referral'
    check (payout_model in ('per_referral', 'weekly_flat')),
  add column if not exists weekly_referral_target integer
    check (weekly_referral_target is null or weekly_referral_target > 0),
  add column if not exists display_timezone text;

-- Habilamar: 250 referrals/week target, displayed in Istanbul time.
update ambassadors
set
  payout_model = 'weekly_flat',
  weekly_referral_target = 250,
  display_timezone = 'Europe/Istanbul'
where campaign_slug = 'free-before-grid';
