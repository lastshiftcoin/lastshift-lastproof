-- 0013: Pending webhook signatures cache.
--
-- Helius webhook fires when a TX hits the treasury (1-5 sec after chain),
-- but the user hasn't submitted the signature yet. We cache unmatched
-- signatures here. When the user submits, verify-tx checks this cache
-- and processes immediately instead of waiting for the 60-sec cron.
--
-- Rows are cleaned up after matching. TTL cleanup via cron if needed.

CREATE TABLE IF NOT EXISTS pending_webhook_sigs (
  signature TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pending_webhook_sigs ENABLE ROW LEVEL SECURITY;
