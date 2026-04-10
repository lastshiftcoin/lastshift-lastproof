/**
 * Shared constants. Pull env values here so the rest of the codebase
 * imports typed exports instead of re-reading process.env.
 */

export const LASTSHFT_MINT =
  process.env.LASTSHFT_MINT || "5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB";

export const TOOL_SLUG = process.env.TOOL_SLUG || "lastproof";

/** Grid launch date — anchor for EA subscription window. */
export const GRID_LAUNCH_DATE = new Date("2026-05-08T00:00:00Z");

/** EA free window: 30 days after Grid launch. */
export const EA_FREE_WINDOW_DAYS = 30;

/** SPL token mints we accept. `native` is the sentinel for SOL. */
export const TOKEN_MINTS = {
  LASTSHFT: LASTSHFT_MINT,
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  SOL: "native",
} as const;

export const TOKEN_DECIMALS = {
  LASTSHFT: 6,
  USDT: 6,
  SOL: 9,
} as const;

/** Reverse lookup: mint → PaymentToken. */
export function tokenForMint(mint: string): "LASTSHFT" | "USDT" | null {
  if (mint === TOKEN_MINTS.LASTSHFT) return "LASTSHFT";
  if (mint === TOKEN_MINTS.USDT) return "USDT";
  return null;
}
