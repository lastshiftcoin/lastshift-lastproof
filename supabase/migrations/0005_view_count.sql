-- =============================================================================
-- 0005_view_count.sql — profile view counter
-- =============================================================================
-- Adds a simple view_count column to profiles and an RPC function to
-- atomically increment it. The increment is called from the public profile
-- page for non-owner visitors.
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- RPC function: increment view count by handle, returns new count.
-- Called server-side only (service role key). Skips if handle doesn't exist.
CREATE OR REPLACE FUNCTION increment_profile_view(p_handle text)
RETURNS integer
LANGUAGE sql
AS $$
  UPDATE profiles
  SET view_count = view_count + 1
  WHERE handle = p_handle
  RETURNING view_count;
$$;
