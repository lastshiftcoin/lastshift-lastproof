-- ═══════════════════════════════════════════════════════════════════════════
-- Dev seed: operators table
--
-- Inserts the test operator that matches the mock Terminal route's hardcoded
-- seed wallet. Without this row, the wallet-gate flow always returns
-- "no_terminal" because the Supabase lookup finds nothing.
--
-- Run this in the Supabase SQL Editor or via `supabase db seed`.
-- DO NOT run in production — production operators are created by the
-- Terminal when a user registers.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO operators (terminal_wallet, terminal_id, first_five_thousand, created_at)
VALUES (
  'TEST1111111111111111111111111111111111111111',
  'SHIFT-TEST-0001-0001-0001',
  true,
  '2026-04-08T22:46:08.945661+00:00'
)
ON CONFLICT (terminal_wallet, terminal_id) DO NOTHING;
