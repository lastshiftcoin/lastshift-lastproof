-- Proof verification queue for paste-to-verify flow.
-- Users paste a Solscan tx signature, server queues it for on-chain verification.
-- Cron consumer picks up queued rows, verifies against Helius RPC, records proofs.

CREATE TABLE proof_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  signature TEXT NOT NULL,
  pubkey TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('collab', 'dev')),
  token TEXT NOT NULL CHECK (token IN ('LASTSHFT', 'SOL', 'USDT')),
  work_item_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'verified', 'failed')),
  failure_check TEXT,
  failure_detail TEXT,
  attempt_number INT NOT NULL DEFAULT 1,
  proof_id UUID,
  processed_at TIMESTAMPTZ,
  UNIQUE(signature)
);

CREATE INDEX idx_pv_status_queued ON proof_verifications(status, created_at) WHERE status = 'queued';
CREATE INDEX idx_pv_status_processing ON proof_verifications(status) WHERE status = 'processing';
CREATE INDEX idx_pv_signature ON proof_verifications(signature);
