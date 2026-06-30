/**
 * Shared constants. Pull env values here so the rest of the codebase
 * imports typed exports instead of re-reading process.env.
 */

export const LASTSHFT_MINT =
  process.env.LASTSHFT_MINT || "5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB";

export const TOOL_SLUG = process.env.TOOL_SLUG || "lastproof";

/** Grid launch date — marketing/copy anchor only.
 * As of 2026-04-30 the First-5,000 program is "free forever for the first
 * 5,000 operators." There is no EA expiry window. This constant is kept
 * for marketing copy that still references the launch date. */
export const GRID_LAUNCH_DATE = new Date("2026-05-08T00:00:00Z");

/** SPL token mints we accept. `native` is the sentinel for SOL. */
export const TOKEN_MINTS = {
  LASTSHFT: LASTSHFT_MINT,
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  SOL: "native",
} as const;

export const TOKEN_DECIMALS = {
  LASTSHFT: 9,
  USDT: 6,
  SOL: 9,
} as const;

/** Reverse lookup: mint → PaymentToken. */
export function tokenForMint(mint: string): "LASTSHFT" | "USDT" | null {
  if (mint === TOKEN_MINTS.LASTSHFT) return "LASTSHFT";
  if (mint === TOKEN_MINTS.USDT) return "USDT";
  return null;
}

/**
 * Test-fixture wallet pubkeys.
 *
 * These wallets exist as synthetic database rows ONLY — they hold no
 * SOL, never sign, never participate in real payment or proof flows.
 * They exist to drive cross-tool verification suites (LASTBURN Sprint
 * 4.4 needs to exercise the LASTPROOF subscription-state endpoint's
 * `active_paid` branch pre-5000-cap, which is otherwise structurally
 * uncoverable since every paid+published profile pre-cap is EA).
 *
 * Database rows are tagged `is_test_fixture = true` and filtered out
 * of every public-facing read path. Provisioned by migration 0031.
 *
 * If the LASTBURN endpoint at /api/internal/lastburn/subscription-state
 * is queried with one of these pubkeys, it intentionally returns the
 * real `state` value for that fixture — that's the whole point.
 */
export const TEST_FIXTURE_WALLETS = {
  /** Tagged is_test_fixture=true, returns state: "active_paid" via §8.1. */
  LASTBURN_ACTIVE_PAID: "52y6FQvkRsNbbF6cJz6JWThsmTMSNmDUyxbKXQ3CHmLZ",
} as const;
