/**
 * Pure payment-vs-quote validation. Zero I/O. Every rejection reason
 * documented in docs/PRICING.md lives here.
 */

import type { QuoteRow } from "./quotes-store";
import type { PaymentToken } from "./pricing";
import { MIN_ACCEPTED_USD, toleranceForUsd } from "./pricing";

export type ValidationReason =
  | "ok"
  | "quote_not_found"
  | "quote_expired"
  | "quote_already_consumed"
  | "discount_token_mismatch"
  | "underpayment"
  | "token_amount_mismatch"
  | "dust";

export interface ValidationResult {
  ok: boolean;
  reason: ValidationReason;
  detail?: string;
}

export interface PaymentAgainstQuoteInput {
  quote: QuoteRow | null;
  paidToken: PaymentToken;
  paidUsd: number;
  /**
   * Amount paid in the token's own unit (UI-scaled, not base units).
   * Optional for backward-compat, but every real payment path should
   * supply it — without it we can only validate USD, and an attacker
   * could theoretically manipulate the rate converter to smuggle a
   * low-token-amount payment through the USD check.
   */
  paidToken_amount?: number;
  now?: Date;
}

export function validatePaymentAgainstQuote(input: PaymentAgainstQuoteInput): ValidationResult {
  const now = input.now ?? new Date();

  if (!input.quote) return { ok: false, reason: "quote_not_found" };

  if (input.quote.status === "consumed") {
    return { ok: false, reason: "quote_already_consumed" };
  }
  if (input.quote.status === "expired" || new Date(input.quote.expiresAt) <= now) {
    return { ok: false, reason: "quote_expired" };
  }
  if (input.paidUsd < MIN_ACCEPTED_USD) {
    return { ok: false, reason: "dust", detail: `paid=${input.paidUsd} min=${MIN_ACCEPTED_USD}` };
  }
  if (input.paidToken !== input.quote.token) {
    return {
      ok: false,
      reason: "discount_token_mismatch",
      detail: `paid=${input.paidToken} quoted=${input.quote.token}`,
    };
  }

  const tol = toleranceForUsd(input.quote.expectedUsd);
  if (input.paidUsd < input.quote.expectedUsd - tol) {
    return {
      ok: false,
      reason: "underpayment",
      detail: `paid=$${input.paidUsd} expected=$${input.quote.expectedUsd} tol=$${tol}`,
    };
  }

  // Belt-and-suspenders: token-denominated check. The quote LOCKED the
  // rate at issue time (see quotes-store.ts), so the on-chain token
  // amount must match `expectedToken` within the same 2% / $0.05 USD
  // tolerance re-expressed as token units at the locked rate. This
  // closes a theoretical hole where a mis-computed USD conversion in
  // the parser could approve a severely under-paid token transfer.
  if (typeof input.paidToken_amount === "number") {
    const tokenTol = tol / input.quote.tokenUsdRate;
    if (input.paidToken_amount < input.quote.expectedToken - tokenTol) {
      return {
        ok: false,
        reason: "token_amount_mismatch",
        detail:
          `paidToken=${input.paidToken_amount} expected=${input.quote.expectedToken} ` +
          `rate=${input.quote.tokenUsdRate} tol=${tokenTol.toFixed(6)}`,
      };
    }
  }

  return { ok: true, reason: "ok" };
}
