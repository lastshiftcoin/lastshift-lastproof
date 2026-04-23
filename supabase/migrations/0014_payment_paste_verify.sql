-- 0014_payment_paste_verify.sql
--
-- Paste-verify infrastructure for payments (mint, subscription, handle_change).
-- Mirrors proof_verifications / proof_sessions pattern.

-- Payment sessions — anti-scam timestamp gate (same concept as proof_sessions)
CREATE TABLE IF NOT EXISTS payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'mint', 'handle_change')),
  profile_id UUID,
  ref_id TEXT,                              -- work_item_id for mint, new_handle for handle_change, null for subscription
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pms_id ON payment_sessions(id);

-- Payment verification queue — async verification pipeline for paste-verify payments
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature TEXT NOT NULL UNIQUE,           -- on-chain tx signature (idempotency key)
  pubkey TEXT,                              -- extracted from accountKeys[0] post-verify
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'mint', 'handle_change')),
  token TEXT NOT NULL CHECK (token IN ('LASTSHFT', 'SOL', 'USDT')),
  profile_id UUID NOT NULL,
  ref_id TEXT,                              -- work_item_id for mint, new_handle for handle_change
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'verified', 'failed'))
    DEFAULT 'queued',
  failure_check TEXT,                       -- check that failed
  failure_detail TEXT,                      -- human reason
  attempt_number INT NOT NULL DEFAULT 1,
  payment_id UUID,                          -- FK to payments.id on success
  processed_at TIMESTAMPTZ,
  session_id UUID,                          -- FK to payment_sessions
  session_opened_at TIMESTAMPTZ             -- cached for TX blockTime check
);
CREATE INDEX IF NOT EXISTS idx_pmv_status_queued
  ON payment_verifications(status, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_pmv_signature
  ON payment_verifications(signature);

-- RLS — service-role key bypasses, but anon key must not touch these tables
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;
