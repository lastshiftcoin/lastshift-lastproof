-- =============================================================================
-- LASTPROOF — initial schema migration (0001_init.sql)
-- =============================================================================
--
-- Run this against a FRESH `lastproof` Supabase project. Idempotent where
-- practical (create table if not exists, etc.) so a partial re-run is safe.
--
-- The shape mirrors the in-memory stores in src/lib/*-store.ts one-for-one
-- so the dual-write adapter in step 15 is a transparent swap. Column names
-- are snake_case on the DB side; the Supabase client adapters will convert
-- to camelCase at the boundary.
--
-- RLS is ON by default on every table. Anon reads ONLY go through the
-- `public_profiles` SECURITY DEFINER view (see section at bottom). All
-- writes happen via server routes using the service role key. Client
-- code NEVER gets a writer token.
-- =============================================================================

-- ─── operators ──────────────────────────────────────────────────────────────
create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  terminal_wallet text not null,
  terminal_id text not null,
  tool_wallet text,
  first_five_thousand boolean default false,
  last_validated_at timestamptz,
  created_at timestamptz default now(),
  unique (terminal_wallet, terminal_id)
);
create index if not exists operators_terminal_wallet_idx on operators (terminal_wallet);

-- ─── profiles ───────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  handle text unique not null,
  display_name text,
  headline text,
  pitch text,
  about text,
  bio_statement text,
  location text,
  timezone text,
  avatar_url text,
  fee_range text check (fee_range in ('$','$$','$$$','$$$$')),
  hire_telegram_handle text,
  x_handle text,
  x_verified boolean default false,
  telegram_handle text,
  telegram_verified boolean default false,
  tier int default 5,
  is_paid boolean default false,
  is_dev boolean default false,
  is_early_adopter boolean default false,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  last_payment_at timestamptz,
  published_at timestamptz,
  referral_slug text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists profiles_operator_id_idx on profiles (operator_id);
create index if not exists profiles_is_paid_expires_idx on profiles (is_paid, subscription_expires_at);
create index if not exists profiles_handle_lower_idx on profiles (lower(handle));

-- ─── work_items ─────────────────────────────────────────────────────────────
create table if not exists work_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  ticker text,
  role text not null,
  description text,
  started_at date,
  ended_at date,
  minted boolean default false,
  is_dev boolean default false,
  position int not null default 0
);
create index if not exists work_items_profile_idx on work_items (profile_id);

-- ─── proofs ─────────────────────────────────────────────────────────────────
create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  voucher_wallet text not null,
  relationship text,
  note text,
  tx_signature text unique,
  token text not null,
  amount_usd numeric(10,2) not null,
  discount_applied boolean default false,
  status text not null default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists proofs_work_item_status_idx on proofs (work_item_id, status);

-- ─── dev_verifications ──────────────────────────────────────────────────────
create table if not exists dev_verifications (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  project_name text not null,
  project_wallet text not null,
  project_contract text,
  tx_signature text unique,
  token text not null,
  amount_usd numeric(10,2) not null,
  discount_applied boolean default false,
  status text not null default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists dev_verifications_work_item_status_idx on dev_verifications (work_item_id, status);

-- ─── screenshots ────────────────────────────────────────────────────────────
create table if not exists screenshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  preview_url text not null,
  aspect_ratio numeric(6,4),
  linked_url text,
  caption text,
  position int not null default 0
);
create index if not exists screenshots_profile_idx on screenshots (profile_id);

-- ─── profile_links ──────────────────────────────────────────────────────────
create table if not exists profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  url text not null,
  position int not null default 0
);

-- ─── categories + join ──────────────────────────────────────────────────────
create table if not exists categories (
  slug text primary key,
  label text not null,
  description text,
  position int not null default 0
);
create table if not exists profile_categories (
  profile_id uuid references profiles(id) on delete cascade,
  category_slug text references categories(slug) on delete cascade,
  primary key (profile_id, category_slug)
);

-- ─── quotes ─────────────────────────────────────────────────────────────────
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,                 -- base58 32-byte Solana Pay reference
  profile_id uuid references profiles(id) on delete cascade,
  kind text not null,                             -- subscription|proof|dev_verification|handle_change
  token text not null,                            -- LASTSHFT|SOL|USDT
  expected_usd numeric(10,2) not null,
  expected_token numeric(20,9) not null,
  token_usd_rate numeric(20,9) not null,
  metadata jsonb,
  status text not null default 'open',            -- open|consumed|expired
  consumed_tx_signature text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists quotes_profile_status_idx on quotes (profile_id, status);
create index if not exists quotes_reference_idx on quotes (reference);

-- ─── payments ───────────────────────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references operators(id),
  profile_id uuid references profiles(id),
  quote_id uuid references quotes(id),
  kind text not null,
  ref_id uuid,
  payer_wallet text not null,
  token text not null,
  amount_usd numeric(10,2) not null,
  amount_token numeric(20,9) not null,
  discount_applied boolean default false,
  tx_signature text unique,
  status text not null default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists payments_operator_kind_status_idx on payments (operator_id, kind, status);
create index if not exists payments_profile_idx on payments (profile_id);

-- ─── notifications ──────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_profile_read_idx on notifications (profile_id, read_at);

-- ─── handle_history ─────────────────────────────────────────────────────────
create table if not exists handle_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  old_handle text not null,
  new_handle text not null,
  tx_signature text,
  changed_at timestamptz default now()
);
create index if not exists handle_history_profile_idx on handle_history (profile_id, changed_at);

-- ─── session_tokens ─────────────────────────────────────────────────────────
create table if not exists session_tokens (
  token text primary key,
  operator_id uuid not null references operators(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- =============================================================================
-- RLS — on by default, deny-all for anon, server-role writes everything
-- =============================================================================

alter table operators          enable row level security;
alter table profiles           enable row level security;
alter table work_items         enable row level security;
alter table proofs             enable row level security;
alter table dev_verifications  enable row level security;
alter table screenshots        enable row level security;
alter table profile_links      enable row level security;
alter table categories         enable row level security;
alter table profile_categories enable row level security;
alter table quotes             enable row level security;
alter table payments           enable row level security;
alter table notifications      enable row level security;
alter table handle_history     enable row level security;
alter table session_tokens     enable row level security;

-- Categories are the only table with a public anon read, since they're
-- a fixed lookup table the UI needs at render time.
drop policy if exists categories_anon_read on categories;
create policy categories_anon_read on categories
  for select to anon using (true);

-- =============================================================================
-- Public profile view — the ONLY way anon clients read profile data.
-- Gated on paid + non-expired + published.
-- =============================================================================

create or replace view public_profiles as
  select
    p.id,
    p.handle,
    p.display_name,
    p.headline,
    p.pitch,
    p.about,
    p.bio_statement,
    p.location,
    p.timezone,
    p.avatar_url,
    p.fee_range,
    p.hire_telegram_handle,
    p.x_handle,
    p.x_verified,
    p.telegram_handle,
    p.telegram_verified,
    p.tier,
    p.is_dev,
    p.is_early_adopter,
    p.subscription_expires_at,
    p.published_at
  from profiles p
  where p.is_paid = true
    and p.subscription_expires_at > now()
    and p.published_at is not null;

-- Stripe-down view for expired profiles — only the fields we surface on
-- the "NON-ACTIVE" public page.
create or replace view public_profiles_expired as
  select
    p.id,
    p.handle,
    p.display_name,
    p.location,
    p.timezone,
    p.bio_statement,
    p.avatar_url,
    p.published_at
  from profiles p
  where p.published_at is not null
    and (p.is_paid = false or p.subscription_expires_at <= now());

-- =============================================================================
-- Trigger: bump profiles.updated_at on any UPDATE.
-- =============================================================================
create or replace function touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function touch_profiles_updated_at();
