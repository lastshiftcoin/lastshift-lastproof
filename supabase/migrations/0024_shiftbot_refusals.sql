-- =============================================================================
-- 0024_shiftbot_refusals.sql — log every SHIFTBOT refusal for pattern analysis
-- =============================================================================
--
-- Purpose: capture refusals from /api/shiftbot/search so we can:
--   1. Spot novel jailbreak / prompt-injection patterns we haven't catalogued yet
--   2. Identify abusive IP addresses (high prompt_injection rate from one source)
--   3. Validate that our refusal categorization (off_topic / no_match /
--      prompt_injection) is accurate over time
--
-- Stored fields:
--   - reason     : the refusal reason returned to the user (3-value enum)
--   - query      : the sanitized user input (max 200 chars per Layer 4 spec)
--   - ip_hash    : sha256(ip + IP_HASH_SALT) — pattern correlation WITHOUT
--                  storing raw IP. The salt is server-side env, so the hash
--                  cannot be reversed by anyone reading the table.
--   - created_at : when the refusal happened
--
-- See docs/SHIFTBOT-SECURITY-PLAN.md § Layer 4 for context.
-- See docs/SHIFTBOT-JAILBREAK-CATALOG.md for the threat model.
--
-- RLS: enabled, no anon policies (deny-all for anon key). Service role
-- inserts via supabaseService(), reads via SQL Editor for analysis.
--
-- Idempotent — safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS shiftbot_refusals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason     TEXT NOT NULL CHECK (reason IN ('off_topic', 'no_match', 'prompt_injection')),
  query      TEXT NOT NULL,
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shiftbot_refusals_reason_idx
  ON shiftbot_refusals (reason, created_at DESC);

CREATE INDEX IF NOT EXISTS shiftbot_refusals_ip_idx
  ON shiftbot_refusals (ip_hash, created_at DESC);

ALTER TABLE shiftbot_refusals ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Sanity checks (run after applying):
--
--   -- Confirm the table exists and is empty.
--   SELECT count(*) FROM shiftbot_refusals;
--
--   -- Once SHIFTBOT is live and refusals start landing, useful queries:
--
--   -- Refusal counts by reason in the last 24h
--   SELECT reason, count(*) AS n
--   FROM shiftbot_refusals
--   WHERE created_at > now() - interval '24 hours'
--   GROUP BY reason
--   ORDER BY n DESC;
--
--   -- IPs with the most prompt_injection attempts in the last 7 days
--   SELECT ip_hash, count(*) AS attempts
--   FROM shiftbot_refusals
--   WHERE reason = 'prompt_injection'
--     AND created_at > now() - interval '7 days'
--   GROUP BY ip_hash
--   ORDER BY attempts DESC
--   LIMIT 20;
--
--   -- Recent novel-looking queries (sample for catalog updates)
--   SELECT created_at, reason, query
--   FROM shiftbot_refusals
--   WHERE reason = 'prompt_injection'
--   ORDER BY created_at DESC
--   LIMIT 50;
-- =============================================================================
