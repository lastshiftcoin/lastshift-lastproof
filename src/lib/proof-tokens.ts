/**
 * Proof modal token + price table.
 *
 * Single import target for step 4 (token select) of the proof modal.
 * All three values the picker needs — accepted tokens, mint addresses,
 * decimals, and path-aware USD prices — live here so the modal never
 * hardcodes a mint or a number inline.
 *
 * Token set (locked, see docs/PROOF-MODAL-SPEC.md §4 and
 * docs/PROOF-MODAL-SPEC-REPLY.md §3):
 *   LASTSHFT (default, 40% discount applied as a separate row)
 *   SOL
 *   USDT       ← NOT USDC. We switched per user direction.
 *
 * Pricing is path-aware (COLLAB vs DEV) × token. The $LASTSHFT rows
 * are NOT a runtime discount calculation — they are separate locked
 * USD prices. The frontend renders whichever row matches the user's
 * path + token selection. No math on the client.
 *
 * Conversion from USD → token-amount is backend-side and rides on the
 * eligibility response's `quote` object (`quote.amount_ui`,
 * `quote.amount_raw`). The client never touches price feeds.
 */

import { TOKEN_MINTS, TOKEN_DECIMALS, LASTSHFT_MINT } from "./constants";

export type ProofToken = "LASTSHFT" | "SOL" | "USDT";
export type ProofPath = "collab" | "dev";

export interface ProofTokenInfo {
  /** Enum key — use this as the React list key and the picker value. */
  key: ProofToken;
  /** Display label with leading $ for the ticker. */
  label: string;
  /** SPL mint address. `"native"` for SOL. */
  mint: string;
  /** SPL decimals (or 9 for native SOL). */
  decimals: number;
  /** Whether this token is the default selection in the picker. */
  isDefault: boolean;
  /** Whether this token has the 40%-off discount row shown in the UI. */
  hasDiscountBadge: boolean;
}

/**
 * Path-aware USD prices. These are the authoritative numbers displayed
 * on step 4 and signed on step 7. Backend must match on every quote —
 * a drift here is a contract violation.
 */
export const PROOF_PRICES_USD: Record<ProofPath, Record<ProofToken, number>> = {
  collab: {
    LASTSHFT: 0.6, // 40% off $1
    SOL: 1.0,
    USDT: 1.0,
  },
  dev: {
    LASTSHFT: 3.0, // 40% off $5
    SOL: 5.0,
    USDT: 5.0,
  },
} as const;

/**
 * The base (non-discounted) price per path. Used only for rendering
 * the strike-through on the $LASTSHFT row — never for math.
 */
export const PROOF_BASE_PRICE_USD: Record<ProofPath, number> = {
  collab: 1.0,
  dev: 5.0,
} as const;

/** Discount label rendered on the $LASTSHFT token row. Hardcoded copy. */
export const LASTSHFT_DISCOUNT_LABEL = "40% OFF";

/**
 * Picker card order. LASTSHFT is first (default selection), SOL second,
 * USDT third. Do not reorder without wireframe owner sign-off.
 */
export const PROOF_TOKENS: readonly ProofTokenInfo[] = [
  {
    key: "LASTSHFT",
    label: "$LASTSHFT",
    mint: LASTSHFT_MINT,
    decimals: TOKEN_DECIMALS.LASTSHFT,
    isDefault: true,
    hasDiscountBadge: true,
  },
  {
    key: "SOL",
    label: "SOL",
    mint: TOKEN_MINTS.SOL,
    decimals: TOKEN_DECIMALS.SOL,
    isDefault: false,
    hasDiscountBadge: false,
  },
  {
    key: "USDT",
    label: "USDT",
    mint: TOKEN_MINTS.USDT,
    decimals: TOKEN_DECIMALS.USDT,
    isDefault: false,
    hasDiscountBadge: false,
  },
] as const;

/** URL for the `BUY $LASTSHFT ↗` button on the $LASTSHFT card. Canonical. */
export const BUY_LASTSHFT_URL = "https://lastshiftcoin.com/buy";

/** Lookup helpers — prefer these over array.find() in the UI. */
export function getProofToken(key: ProofToken): ProofTokenInfo {
  const found = PROOF_TOKENS.find((t) => t.key === key);
  if (!found) throw new Error(`unknown proof token: ${key}`);
  return found;
}

export function getProofPriceUsd(path: ProofPath, token: ProofToken): number {
  return PROOF_PRICES_USD[path][token];
}
