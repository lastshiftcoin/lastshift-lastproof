-- =============================================================================
-- 0002_proofs_dual_write.sql
-- =============================================================================
--
-- Purpose: align the `proofs` table with the in-memory `ProofRow` shape so
-- the dual-write adapter (Step 16d) can round-trip without first requiring
-- the full work_items / payments-context UI to exist.
--
-- The in-memory store is intentionally minimal in the skeleton phase:
--   { id, profileId, workItemId | null, kind: "proof" | "dev_verification",
--     txSignature, createdAt }
--
-- Changes (all additive / loosening — no data destruction):
--   1. Add `profile_id` (nullable FK to profiles.id) so we can write proofs
--      that haven't been associated with a work_item yet.
--   2. Add `kind` text column with default 'proof' so dev_verification rows
--      can live in the same table during the migration window. Once
--      `work_items` exists end-to-end, we'll revisit whether to fold
--      `dev_verifications` into `proofs` permanently or keep them split.
--   3. Make `work_item_id`, `voucher_wallet`, `token`, `amount_usd` nullable
--      so the minimal in-memory shape inserts cleanly.
--
-- All idempotent — safe to re-run.
-- =============================================================================

-- 1. profile_id column + FK + index
alter table proofs
  add column if not exists profile_id uuid references profiles(id) on delete cascade;
create index if not exists proofs_profile_idx on proofs (profile_id);

-- 2. kind column (proof | dev_verification)
alter table proofs
  add column if not exists kind text not null default 'proof'
  check (kind in ('proof', 'dev_verification'));
create index if not exists proofs_kind_idx on proofs (kind);

-- 3. relax NOT NULL constraints on the columns the skeleton doesn't yet
--    have a value for. The full UI will start populating them again later.
alter table proofs alter column work_item_id   drop not null;
alter table proofs alter column voucher_wallet drop not null;
alter table proofs alter column token          drop not null;
alter table proofs alter column amount_usd     drop not null;

-- 4. Sanity index for tx_signature lookups already exists from the unique
--    constraint in 0001 — nothing to do.
