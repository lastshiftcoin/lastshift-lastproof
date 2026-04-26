-- =============================================================================
-- 0022_grid_view.sql — `grid_operators` view for the /operators page
-- =============================================================================
--
-- Purpose: a single denormalized view that returns one row per Grid-eligible
-- operator with all `GridCardView` fields pre-aggregated. Eliminates per-card
-- fan-out queries from the projector — the page can SELECT * from this view
-- and have everything it needs for the card list in one round trip.
--
-- Visibility predicate (LOCKED — matches docs/GRID-PHASE-2-ARCHITECTURE.md §4):
--   - p.is_paid = true
--   - p.published_at IS NOT NULL
--   - p.tier != 5
--
-- Aggregations (these counts are NOT columns on `profiles`):
--   - proofs_confirmed:     count of all confirmed proofs (kind = 'proof' OR 'dev_verification')
--   - dev_proofs_confirmed: subset where kind = 'dev_verification'
--   - projects_count:       count of work_items per profile
--   - categories:           jsonb array of {slug, label} ordered by category position
--
-- Reads via supabaseService() (service-role) — RLS doesn't gate this. The view
-- is NOT exposed to anon clients via PostgREST.
--
-- Idempotent — safe to re-run.
-- =============================================================================

CREATE OR REPLACE VIEW grid_operators AS
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
  p.pitch,
  p.published_at,

  -- Proof aggregations — both kinds live in `proofs` (per migration 0002).
  -- Confirmed status only — pending/queued proofs don't count toward Grid totals.
  COALESCE(proof_agg.proofs_count, 0) AS proofs_confirmed,
  COALESCE(proof_agg.dev_count, 0)    AS dev_proofs_confirmed,

  -- Distinct work_items the operator has shipped.
  COALESCE(work_agg.projects, 0)      AS projects_count,

  -- Categories as JSON for single-query consumption. Ordered by category
  -- position so the "primary" category (lowest position) is first in the array.
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
  AND p.tier != 5;

-- =============================================================================
-- Sanity checks (run after applying):
--
--   -- How many operators currently qualify for the Grid?
--   SELECT count(*) AS grid_operators FROM grid_operators;
--
--   -- Sample 5 — confirm proof/dev counts and categories array look right.
--   SELECT handle, tier, proofs_confirmed, dev_proofs_confirmed, projects_count,
--          jsonb_array_length(categories) AS category_count
--   FROM grid_operators
--   ORDER BY tier DESC, proofs_confirmed DESC
--   LIMIT 5;
--
--   -- Verify the visibility predicate caught the right edges:
--   --   should EXCLUDE: tier=5, unpaid, unpublished
--   --   should INCLUDE: paid+published EA profiles even with null subscription_expires_at
--   SELECT count(*) FROM profiles WHERE is_paid = true AND published_at IS NOT NULL AND tier != 5;
--   -- ↑ should match the count of grid_operators
--
-- =============================================================================
