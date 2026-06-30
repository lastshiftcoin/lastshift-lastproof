-- =============================================================================
-- 0031_test_fixture_active_paid.sql
-- =============================================================================
--
-- Purpose:
--   Add `is_test_fixture` boolean column to `profiles` and `operators` so
--   we can mark non-real rows that exist only to drive cross-tool verification.
--   Provision one such fixture row in `active_paid` state for LASTBURN
--   Sprint 4.4 Phase A's 4-case cross-tool verification.
--
-- Why this fixture exists:
--   The LASTPROOF First-5,000 program is "free forever" (v0.13.6), so until
--   the 5,000 cap is reached, every paid+published profile has
--   `is_early_adopter = true` and resolves to `first_5000_ea` via the
--   subscription-state endpoint at §8.1. The `active_paid` branch is therefore
--   structurally uncoverable pre-cap with real users. This fixture exists
--   solely so LASTBURN's Sprint 4.4 verification can exercise that branch
--   against the real /api/internal/lastburn/subscription-state endpoint.
--
-- Fixture wallet: 52y6FQvkRsNbbF6cJz6JWThsmTMSNmDUyxbKXQ3CHmLZ
--   - Generated via @solana/web3.js Keypair.generate() on 2026-XX-XX
--   - Private key intentionally discarded. The wallet exists only as a
--     base58 identifier on a database row — it never holds value, never
--     signs, never appears in any payment or proof flow.
--   - If a future workstream needs a signing keypair for this fixture,
--     regenerate with a fresh keypair and update this migration's INSERT.
--
-- Visibility:
--   The fixture row is EXCLUDED from:
--     - `grid_operators` view (recreated below with new WHERE clause)
--     - Sitemap (`src/app/sitemap.ts`)
--     - SHIFTBOT search (`src/lib/shiftbot/operators.ts`)
--     - Admin metrics totals (`src/app/api/admin/metrics/route.ts`)
--   The fixture IS visible at:
--     - LASTBURN subscription-state endpoint (intentional — that's the
--       whole point of this fixture)
--
-- Idempotent — safe to re-run. Column add uses IF NOT EXISTS; insert uses
-- ON CONFLICT DO NOTHING on the terminal_wallet unique constraint.
-- =============================================================================

-- ─── 1. Schema change ─────────────────────────────────────────────────

alter table operators
  add column if not exists is_test_fixture boolean not null default false;

alter table profiles
  add column if not exists is_test_fixture boolean not null default false;

comment on column operators.is_test_fixture is
  'TRUE for synthetic test-only rows that should be excluded from public-facing reads. See migration 0031.';

comment on column profiles.is_test_fixture is
  'TRUE for synthetic test-only rows that should be excluded from public-facing reads. See migration 0031.';

-- ─── 2. Recreate grid_operators view with fixture filter + invoker mode ────

DROP VIEW IF EXISTS grid_operators;

CREATE VIEW grid_operators AS
SELECT
  p.id,
  p.handle,
  p.display_name,
  p.avatar_url,
  p.tier,
  (COALESCE(p.x_verified, false) AND COALESCE(p.telegram_verified, false)) AS is_verified,
  p.is_early_adopter,
  p.timezone,
  p.location,
  p.language,
  p.secondary_language,
  p.fee_range,
  COALESCE(p.bio_statement, p.headline) AS short_bio,
  p.published_at,
  COALESCE(proof_agg.proofs_count, 0) AS proofs_confirmed,
  COALESCE(proof_agg.dev_count, 0)    AS dev_proofs_confirmed,
  COALESCE(work_agg.projects, 0)      AS projects_count,
  COALESCE(cat_agg.categories, '[]'::jsonb) AS categories
FROM profiles p
LEFT JOIN (
  SELECT
    profile_id,
    count(*) FILTER (WHERE status = 'confirmed') AS proofs_count,
    count(*) FILTER (WHERE status = 'confirmed' AND kind = 'dev_verification') AS dev_count
  FROM proofs
  WHERE profile_id IS NOT NULL
  GROUP BY profile_id
) proof_agg ON proof_agg.profile_id = p.id
LEFT JOIN (
  SELECT profile_id, count(*) AS projects
  FROM work_items
  GROUP BY profile_id
) work_agg ON work_agg.profile_id = p.id
LEFT JOIN (
  SELECT
    pc.profile_id,
    jsonb_agg(
      jsonb_build_object('slug', c.slug, 'label', c.label)
      ORDER BY c.position
    ) AS categories
  FROM profile_categories pc
  JOIN categories c ON c.slug = pc.category_slug
  GROUP BY pc.profile_id
) cat_agg ON cat_agg.profile_id = p.id
WHERE p.is_paid = true
  AND p.published_at IS NOT NULL
  AND p.tier != 5
  AND p.is_test_fixture = false;   -- NEW: exclude test fixtures from Grid

-- Re-apply security_invoker = true (migration 0028 set this on the previous
-- view; DROP+CREATE clears it, so we must re-apply or the Security Advisor
-- will re-flag the view as SECURITY DEFINER).
alter view grid_operators set (security_invoker = true);

-- ─── 3. Provision the active_paid test fixture row ────────────────────

-- Operator row first (profiles.operator_id FK depends on it).
insert into operators (
  terminal_wallet,
  terminal_id,
  first_five_thousand,
  is_test_fixture
) values (
  '52y6FQvkRsNbbF6cJz6JWThsmTMSNmDUyxbKXQ3CHmLZ',
  'FIXT-0000-0000-0000-PAID',
  false,
  true
)
on conflict (terminal_wallet) do nothing;

-- Profile row — looks like an active_paid user from the LASTBURN endpoint's
-- perspective (is_paid=true, is_early_adopter=false, published_at set,
-- subscription_expires_at far future so the daily cron never lapses it).
insert into profiles (
  operator_id,
  handle,
  display_name,
  is_paid,
  is_early_adopter,
  published_at,
  subscription_expires_at,
  tier,
  is_test_fixture
)
select
  o.id,
  '__lb_fix_ap',                                    -- double-underscore prefix flags it as non-real
  'LASTBURN Active-Paid Test Fixture',
  true,                                             -- is_paid
  false,                                            -- NOT EA — EA branch would short-circuit before active_paid
  '2026-01-01T00:00:00Z'::timestamptz,              -- published_at: any past timestamp
  '2099-12-31T23:59:59Z'::timestamptz,              -- subscription_expires_at: far future, cron-safe
  1,                                                -- tier (1 = NEW; arbitrary, will never render publicly)
  true                                              -- is_test_fixture
from operators o
where o.terminal_wallet = '52y6FQvkRsNbbF6cJz6JWThsmTMSNmDUyxbKXQ3CHmLZ'
on conflict (operator_id) do nothing;

-- ─── 4. Post-flight verification (NOTICES tab) ────────────────────────

do $$
declare
  op_count int;
  pf_count int;
  grid_visible int;
begin
  -- Fixture rows present
  select count(*) into op_count from operators where is_test_fixture = true;
  select count(*) into pf_count from profiles  where is_test_fixture = true;

  -- Fixture must NOT appear in grid_operators (proves filter works)
  select count(*) into grid_visible
  from grid_operators
  where id = (select id from profiles where handle = '__lb_fix_ap' limit 1);

  raise notice '[0031] operators with is_test_fixture=true: %', op_count;
  raise notice '[0031] profiles  with is_test_fixture=true: %', pf_count;
  raise notice '[0031] fixture visible in grid_operators (should be 0): %', grid_visible;

  if grid_visible > 0 then
    raise exception '[0031] FAIL — fixture leaked into grid_operators view';
  end if;
end $$;
