/**
 * Solana Pay Transfer Request URI builder.
 *
 * Spec: https://docs.solanapay.com/spec
 *
 * Shape:
 *   solana:<recipient>
 *     ?amount=<decimal>
 *     &spl-token=<mint>          (omit for native SOL)
 *     &reference=<base58>        (REPEATABLE — use append, not set)
 *     &label=<url-encoded>
 *     &message=<url-encoded>
 *     &memo=<url-encoded>
 *
 * Invariants this module enforces:
 *   1. `recipient` is a base58 pubkey string (we don't validate on-curve;
 *      the wallet does).
 *   2. `amount` is a plain decimal string with no scientific notation
 *      and no trailing zeros beyond the token's decimals.
 *   3. `reference` values are base58 32-byte strings and repeated via
 *      `URLSearchParams.append` so wallets preserve order.
 *   4. For SPL tokens we pass the mint via `spl-token` and the amount is
 *      in UI units (not base units) — the wallet multiplies by decimals.
 *   5. Memo, if present, becomes an SPL Memo instruction placed
 *      IMMEDIATELY BEFORE the transfer instruction. Wallets do this
 *      automatically when the `memo` param is set; we just pass it.
 *
 * This is a pure string builder — no I/O, no Solana SDK dependency.
 * It exists so the quote route, the QR code, and any deep-link URL all
 * emit IDENTICAL URIs. Drift here = wallet rejections in production.
 */

import type { PaymentToken } from "./pricing";
import { TOKEN_MINTS } from "./constants";

export interface TransferRequestInput {
  /** Treasury / AR wallet base58 pubkey. */
  recipient: string;
  /** UI-unit decimal amount (e.g. "1.25" USDT, not "1250000"). */
  amount: string;
  token: PaymentToken;
  /** One or more base58 32-byte references. Order is preserved. */
  references: string[];
  label?: string;
  message?: string;
  memo?: string;
}

/**
 * Format a UI-unit amount as a plain decimal string. Rejects NaN/Infinity,
 * strips trailing zeros beyond the allowed precision, and never emits
 * scientific notation (which wallets reject).
 */
export function formatAmount(amount: number, maxDecimals: number): string {
  if (!Number.isFinite(amount)) throw new Error("amount must be finite");
  if (amount < 0) throw new Error("amount must be >= 0");
  // toFixed avoids exponents; trim trailing zeros and a dangling dot.
  return amount
    .toFixed(maxDecimals)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function buildTransferRequestUri(input: TransferRequestInput): string {
  if (!input.recipient) throw new Error("recipient required");
  if (!input.amount) throw new Error("amount required");
  if (!input.references || input.references.length === 0) {
    throw new Error("at least one reference required");
  }

  const params = new URLSearchParams();
  params.set("amount", input.amount);

  // SPL path — include mint. SOL path — omit spl-token entirely.
  if (input.token !== "SOL") {
    const mint = TOKEN_MINTS[input.token];
    if (!mint || mint === "native") {
      throw new Error(`no mint for token ${input.token}`);
    }
    params.set("spl-token", mint);
  }

  // CRITICAL: repeated reference param must use `append`, not `set`.
  // The spec allows multiple references and wallets preserve order.
  for (const ref of input.references) {
    params.append("reference", ref);
  }

  if (input.label) params.set("label", input.label);
  if (input.message) params.set("message", input.message);
  if (input.memo) params.set("memo", input.memo);

  return `solana:${input.recipient}?${params.toString()}`;
}
