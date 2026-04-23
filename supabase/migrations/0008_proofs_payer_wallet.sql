-- 0008: Add payer_wallet to proofs for wallet-per-item dedup.
--
-- Rule: 1 wallet can only proof a given work item once.
-- The UNIQUE index enforces this at the DB level as a safety net.
-- The eligibility endpoint checks this before the user pays.

alter table proofs add column if not exists payer_wallet text;

-- Composite unique index: (work_item_id, payer_wallet).
-- WHERE clause excludes legacy rows with nulls (backfill handles those).
create unique index if not exists proofs_work_item_payer_wallet_unique
  on proofs (work_item_id, payer_wallet)
  where work_item_id is not null and payer_wallet is not null;
