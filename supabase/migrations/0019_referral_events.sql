-- 0019: Observability for the ambassador referral pipeline.
--
-- Append-only event log capturing every decision point in the
-- attribution flow. Feeds ad-hoc debugging queries and the
-- referral_funnel_daily view.
--
-- Writes are fire-and-forget from app code — logging failure must
-- never degrade the real request.

create table if not exists referral_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- landing_visit | wallet_gate | register_tid | campaign_claim | attribution_drop
  event_type text not null,
  -- The ambassador slug observed (null for events where none was present)
  campaign_slug text,
  -- Wallet tied to the event (null for landing_visit — unknown at that point)
  wallet_address text,
  -- Operator row if known
  operator_id uuid references operators(id) on delete set null,
  -- Where the slug came from: operator | body | cookie | url | none
  source text,
  -- What we did: stamped | already_stamped | invalid_slug | no_ref | error
  outcome text,
  -- Freeform context (UA, referer, error message, etc.)
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists referral_events_created_at_idx
  on referral_events (created_at desc);

create index if not exists referral_events_slug_idx
  on referral_events (campaign_slug)
  where campaign_slug is not null;

create index if not exists referral_events_wallet_idx
  on referral_events (wallet_address)
  where wallet_address is not null;

create index if not exists referral_events_type_idx
  on referral_events (event_type);

-- Daily funnel by slug and event type.
-- Quick answer to "how is each ambassador's URL converting?"
create or replace view referral_funnel_daily as
select
  date_trunc('day', created_at)::date as day,
  campaign_slug,
  event_type,
  count(*) as events,
  count(*) filter (where outcome = 'stamped') as stamped,
  count(*) filter (where outcome = 'invalid_slug') as invalid,
  count(*) filter (where outcome = 'no_ref') as no_ref
from referral_events
where campaign_slug is not null
group by 1, 2, 3
order by 1 desc, 2, 3;
