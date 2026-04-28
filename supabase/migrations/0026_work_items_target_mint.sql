-- 0026: work_items.target_mint — operator-attested contract address.
--
-- Context: today's dev-verification only works for tickers in the
-- hardcoded TOKEN_MINTS constant ($LASTSHFT, $USDT, $SOL). Every
-- other ticker (XNEO, BTCRIP, etc.) hits "No mint address found for
-- <ticker>" before the on-chain dev check runs. This column lets the
-- operator explicitly attest to the mint address that represents
-- their work item's token.
--
-- Filled at dev-check time:
--   - Operator pastes the CA in the dev-check screen when the ticker
--     isn't in TOKEN_MINTS
--   - On successful eligibility, the API persists target_mint here
--   - Subsequent dev-check + post-payment proof-verification both
--     read this column first, falling back to TOKEN_MINTS[ticker]
--     for the legacy hardcoded tickers ($LASTSHFT)
--
-- Chain semantics:
--   - Today: Solana SPL mints only (44-char base58)
--   - Future: multi-chain. Column is plain text so EVM/other-chain
--     addresses fit later without migration. A sibling target_chain
--     column can be added then.
--
-- Backward compat:
--   - Nullable, no default. Existing rows unaffected.
--   - Code reads target_mint first, falls back to TOKEN_MINTS for
--     the 3 legacy tickers — existing $LASTSHFT flow unchanged.

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS target_mint text;

-- Index for the sub-1% case where we'd want to query "all work items
-- with a stamped target_mint" (admin tooling, audits). Cheap given
-- the column's mostly-null state.
CREATE INDEX IF NOT EXISTS idx_work_items_target_mint
  ON work_items (target_mint)
  WHERE target_mint IS NOT NULL;
