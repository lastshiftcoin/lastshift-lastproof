/**
 * Pricing — single source of truth. Mirrors docs/PRICING.md.
 * Any caller that charges the user MUST import from here.
 * Do NOT hard-code prices anywhere else in the codebase.
 */

export type PaymentKindPriced =
  | "proof"
  | "dev_verification"
  | "subscription"
  | "handle_change";

export type PaymentToken = "LASTSHFT" | "SOL" | "USDT";

export const BASE_PRICES_USD: Record<PaymentKindPriced, number> = {
  proof: 1.0,
  dev_verification: 5.0,
  subscription: 10.0,
  handle_change: 100.0,
};

export const LASTSHFT_DISCOUNT = 0.4; // 40% off

export const PRICE_TOLERANCE_PCT = 0.02; // ±2%
export const PRICE_TOLERANCE_ABS_USD = 0.05; // 5¢ floor
export const MIN_ACCEPTED_USD = 0.25;

export const QUOTE_TTL_SEC: Record<PaymentToken, number> = {
  USDT: 300,
  SOL: 60,
  LASTSHFT: 60,
};

export const HANDLE_CHANGE_COOLDOWN_DAYS = 90;

/** USD price after applying $LASTSHFT discount, if any. */
export function priceFor(kind: PaymentKindPriced, token: PaymentToken): number {
  const base = BASE_PRICES_USD[kind];
  return token === "LASTSHFT" ? +(base * (1 - LASTSHFT_DISCOUNT)).toFixed(4) : base;
}

export function toleranceForUsd(expectedUsd: number): number {
  return Math.max(expectedUsd * PRICE_TOLERANCE_PCT, PRICE_TOLERANCE_ABS_USD);
}

export function quoteTtlSec(token: PaymentToken): number {
  return QUOTE_TTL_SEC[token];
}
