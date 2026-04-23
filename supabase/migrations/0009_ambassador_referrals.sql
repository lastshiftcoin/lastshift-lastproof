-- 0009: Ambassador referral tracking system.
--
-- Ambassadors get unique campaign slugs (URLs that look like generic campaign pages).
-- When a user visits via a campaign URL and claims the free 5,000 upgrade,
-- the claim is attributed to the ambassador via profiles.referred_by.

-- Ambassadors table: the 10 campaign slots (6 active, 4 reserved)
create table if not exists ambassadors (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique,
  tg_handle text not null,
  campaign_slug text not null unique,
  report_slug text not null unique,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Add referred_by to profiles (links to ambassadors.campaign_slug)
alter table profiles add column if not exists referred_by text;

-- Ambassador payouts tracking
create table if not exists ambassador_payouts (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references ambassadors(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  referral_count integer not null,
  payout_usd numeric(10,2) not null,
  tx_signature text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Seed the 6 active ambassadors
insert into ambassadors (wallet, tg_handle, campaign_slug, report_slug) values
  ('6h6KZyDDFVbS2F6Ye9PwspHDYwrb4A6AKg7tGHMHacGf', '@investor_zerix', 'early-access-free', 'zerix-ops'),
  ('5cwTdohFk1zsa1JUVtZt84cxnvm4iBkvZzjEgV8YG8uQ', '@Gold_Node', 'limited-free-upgrade', 'goldnode-ops'),
  ('wYiRrZxi3SWe9brmuyZz7trL65q8p9bhzCEa61sv5yd', '@monochizzy_01', 'first-5000-free', 'monochizzy-ops'),
  ('DPXntc2TQySCHmV6vxTgn7jR7nHRPRuwQv6WdDkP6DVk', '@Habilamar_ibn', 'free-before-grid', 'habilamar-ops'),
  ('J7b4Be99SnWmPypFzVw32GGV7a4SezENDcqBFZHCgyEM', '@Joe_Babs', 'claim-before-launch', 'joebabs-ops'),
  ('2Ucpq1tkthuKX7AwprLfnsCuYUZi5sZmZ3Q9S3S7Aoy9', '@TheLeadOps', 'free-early-access', 'leadops-ops')
on conflict (wallet) do nothing;

-- Index for fast referral lookups
create index if not exists profiles_referred_by_idx on profiles (referred_by) where referred_by is not null;
