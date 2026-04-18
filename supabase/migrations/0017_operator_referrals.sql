-- 0017: Server-side referral attribution on operators.
--
-- Previously attribution was only captured at EA-claim time by reading
-- ?ref= from window.location.search (fragile — lost on refresh/nav) or
-- an lp_ref cookie (broken under Next 16 — cookies().set() no-ops in
-- Server Component page renders). Result: 0 of 12 ea_claimed profiles
-- have referred_by set.
--
-- This migration adds referred_by to operators so the ambassador slug
-- can be stamped at the FIRST authenticated call (wallet-gate or
-- register-tid), which fires while the user is still on /manage?ref=X
-- and the URL is intact. Once stamped, it survives any downstream
-- client-side URL drops.
--
-- First-touch wins: writes are guarded by `WHERE referred_by IS NULL`
-- so a later visit via a different ambassador's URL never overwrites
-- the original attribution.

alter table operators add column if not exists referred_by text;

create index if not exists operators_referred_by_idx
  on operators (referred_by)
  where referred_by is not null;
