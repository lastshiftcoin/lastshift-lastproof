-- 0015: Separate profile_aliases from handle_history.
--
-- "Previously Known As" is user-managed cosmetic text — unrelated to
-- the system-managed handle_history audit trail used for cooldown +
-- redirects. The old aliases API was destructively overwriting
-- handle_history rows, which broke cooldown tracking.

CREATE TABLE IF NOT EXISTS profile_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  alias TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_aliases_profile ON profile_aliases(profile_id);
ALTER TABLE profile_aliases ENABLE ROW LEVEL SECURITY;
