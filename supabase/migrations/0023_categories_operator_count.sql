-- =============================================================================
-- 0023_categories_operator_count.sql — cron-cached chip ordering
-- =============================================================================
--
-- Purpose: cache per-category operator counts so the Grid's category chip row
-- can order chips by usage (most-used first) without aggregating on every page
-- load. Per the Phase 2 architecture decision: cron-cached, daily refresh,
-- counts up to 24h stale (acceptable trade — chip counts are decorative).
--
-- The refresh is invoked by /api/grid/categories-cron daily at 00:10 UTC
-- (5 minutes after the subscription cron at 00:05). See vercel.json.
--
-- Idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS operator_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS categories_operator_count_idx
  ON categories (operator_count DESC);

-- ---------------------------------------------------------------------------
-- refresh_categories_operator_count()
--
-- Recomputes `operator_count` for every category. Source of truth is the same
-- visibility predicate as the `grid_operators` view (migration 0022): only
-- profiles that are paid + published + on the tier ladder count.
--
-- Two-pass to handle the "category had operators yesterday, has zero today"
-- edge case — a single UPDATE-FROM with the aggregating subquery only touches
-- rows that have a current count, leaving stale rows at their old value.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_categories_operator_count()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Pass 1: write the current count for every category that has at least
  -- one Grid-visible operator.
  UPDATE categories c
  SET operator_count = sub.cnt
  FROM (
    SELECT pc.category_slug, count(*) AS cnt
    FROM profile_categories pc
    JOIN profiles p ON p.id = pc.profile_id
    WHERE p.is_paid = true
      AND p.published_at IS NOT NULL
      AND p.tier != 5
    GROUP BY pc.category_slug
  ) sub
  WHERE c.slug = sub.category_slug;

  -- Pass 2: zero out categories that had operators previously but no longer
  -- do. Without this, a category that goes from N → 0 would keep its stale
  -- value because pass 1's subquery wouldn't return a row for it.
  UPDATE categories c
  SET operator_count = 0
  WHERE c.slug NOT IN (
    SELECT DISTINCT pc.category_slug
    FROM profile_categories pc
    JOIN profiles p ON p.id = pc.profile_id
    WHERE p.is_paid = true
      AND p.published_at IS NOT NULL
      AND p.tier != 5
  );
END;
$$;

-- =============================================================================
-- Sanity checks (run after applying):
--
--   -- Run the refresh manually to populate counts now (don't wait for cron).
--   SELECT refresh_categories_operator_count();
--
--   -- Confirm counts populated, sorted as the chip row will display them.
--   SELECT slug, label, operator_count
--   FROM categories
--   ORDER BY operator_count DESC, position ASC;
--
-- =============================================================================
