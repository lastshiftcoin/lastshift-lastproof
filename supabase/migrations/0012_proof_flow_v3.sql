-- 0012: Proof Flow V3 — wallet-free paste-verify.
--
-- V3 removes wallet connect. The user is anonymous until they submit a TX.
-- pubkey is extracted from the on-chain transaction post-submission.
-- Session timestamp prevents old-TX-reuse scams.
-- Comment field carries through from paste screen to proof record.
-- proofs.note already exists (0001) — reused for comments, no change needed.

-- ─── proof_verifications: pubkey nullable ──────────────────────────────────
-- V3 doesn't collect pubkey upfront. It's extracted from accountKeys[0]
-- after the TX is fetched on-chain.
ALTER TABLE proof_verifications ALTER COLUMN pubkey DROP NOT NULL;

-- ─── proof_verifications: comment column ───────────────────────────────────
-- Optional user comment from Screen 4, carried through to proofs.note on insert.
ALTER TABLE proof_verifications ADD COLUMN IF NOT EXISTS comment TEXT;

-- ─── proof_verifications: session anti-scam columns ────────────────────────
-- session_id links to proof_sessions table. session_opened_at is denormalized
-- for fast verification checks (TX blockTime must be >= session_opened_at).
ALTER TABLE proof_verifications ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE proof_verifications ADD COLUMN IF NOT EXISTS session_opened_at TIMESTAMPTZ;

-- ─── proof_sessions table ──────────────────────────────────────────────────
-- Anonymous sessions created when the proof modal opens. The timestamp
-- gates TX verification: only transactions AFTER the session started are valid.
-- This kills old-TX-reuse scams without exposing time windows to the user.
CREATE TABLE IF NOT EXISTS proof_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proof_sessions_id ON proof_sessions(id);
CREATE INDEX IF NOT EXISTS idx_proof_sessions_work_item ON proof_sessions(work_item_id);

-- RLS on — server-role writes only, same pattern as all other tables.
ALTER TABLE proof_sessions ENABLE ROW LEVEL SECURITY;
