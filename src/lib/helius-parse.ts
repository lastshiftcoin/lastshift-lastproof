/**
 * Helius enhanced-webhook parser.
 *
 * Input: the raw JSON Helius POSTs to /api/payments/webhook when a tx
 * matches our filter. This is an ARRAY of events, each with:
 *   - signature
 *   - feePayer
 *   - accountData[] (pre/post balances)
 *   - nativeTransfers[]
 *   - tokenTransfers[]
 *   - instructions[] (which contain the full account list, INCLUDING
 *     any Solana Pay reference accounts the client inserted as
 *     read-only, non-signer keys)
 *   - timestamp
 *
 * Output: canonical PaymentDraft[] — same shape the webhook already
 * consumes in the drafts[] test path. This parser is the SINGLE bridge
 * from on-chain reality to our internal model. Every production call
 * goes through it.
 *
 * KEY INVARIANTS:
 *   1. A tx is only a payment to us if one of its referenced accounts
 *      matches an open quote reference. That's how Solana Pay works
 *      and it's the only way to robustly correlate on-chain data to
 *      an off-chain quote without hand-rolling memo parsing.
 *   2. The destination of the transfer MUST be our treasury address
 *      (or the per-profile treasury derived from it). Unsolicited
 *      transfers to random wallets get filtered out.
 *   3. Amount is converted via the quote's own tokenUsdRate — NOT a
 *      freshly-fetched rate. The quote locked the rate; the webhook
 *      honors it.
 *
 * What this file does NOT do:
 *   - Fetch the quote itself (caller does, via getQuoteByReference)
 *   - Apply tolerance (lib/tolerance.ts)
 *   - Idempotency (payments-store.upsertByTxSignature)
 * It's a pure data transform.
 */

import { tokenForMint, TOKEN_DECIMALS } from "./constants";
import type { QuoteRow } from "./quotes-store";
import type { PaymentDraft, PaymentToken } from "./payments-store";
import {
  collectReferencedKeys,
  type HeliusEnhancedEvent,
  type HeliusNativeTransferV1,
  type HeliusTokenTransferV1,
} from "./helius-webhook";

/**
 * Re-export the canonical Enhanced event shape from `helius-webhook.ts`
 * under the legacy name so existing callers don't break. New code should
 * import HeliusEnhancedEvent directly from `helius-webhook.ts`.
 */
export type HeliusEvent = HeliusEnhancedEvent;
export type HeliusNativeTransfer = HeliusNativeTransferV1;
export type HeliusTokenTransfer = HeliusTokenTransferV1;

// ─── Resolver hook — caller supplies the quote lookup ───────────────────────

export type QuoteResolver = (reference: string) => QuoteRow | null;

export interface ParseResult {
  drafts: PaymentDraft[];
  skipped: Array<{ signature: string; reason: string }>;
}

/**
 * Walk every event, find one that references an open quote, build a
 * draft. Events with no reference match, errored txs, or non-treasury
 * destinations are skipped (logged for audit).
 */
export function parseHeliusEvents(
  events: HeliusEvent[],
  opts: {
    treasuryWallet: string;
    resolveQuote: QuoteResolver;
  },
): ParseResult {
  const drafts: PaymentDraft[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (const ev of events) {
    if (ev.transactionError) {
      skipped.push({ signature: ev.signature, reason: "tx_errored" });
      continue;
    }

    // 1. Extract every pubkey referenced in any instruction (including
    //    inner instructions) — that's where Solana Pay reference keys
    //    live. Delegated to the canonical helper in helius-webhook.ts.
    const allReferencedKeys = collectReferencedKeys(ev);

    // 2. Collect EVERY quote that matches a referenced key. A single
    //    transaction can theoretically carry multiple reference keys
    //    (Solana Pay spec permits repetition), so we emit one draft per
    //    matched quote. Dedupe by quote.id in case the same key was
    //    pushed by nested instructions.
    const matched: QuoteRow[] = [];
    const seenQuoteIds = new Set<string>();
    for (const key of allReferencedKeys) {
      const found = opts.resolveQuote(key);
      if (found && !seenQuoteIds.has(found.id)) {
        seenQuoteIds.add(found.id);
        matched.push(found);
      }
    }
    if (matched.length === 0) {
      skipped.push({ signature: ev.signature, reason: "no_matching_quote_reference" });
      continue;
    }

    // 3. For each matched quote, build a draft against the corresponding
    //    transfer. The upsert idempotency gate uses tx_signature, so if
    //    multiple quotes resolve from the same tx each needs a distinct
    //    signature — we suffix with quote.id to prevent collision.
    let anyDraftEmitted = false;
    for (const quote of matched) {
      const draft = extractDraft(ev, quote, opts.treasuryWallet);
      if (!draft) {
        skipped.push({
          signature: ev.signature,
          reason: `no_matching_transfer_for_quote:${quote.id}`,
        });
        continue;
      }
      if (matched.length > 1) {
        // Disambiguate the upsert key when one on-chain tx settles
        // multiple quotes. The raw signature is still surfaced on the
        // row for audit/Solscan linkage via confirmedAt + parser logs.
        draft.txSignature = `${ev.signature}#${quote.id}`;
      }
      drafts.push(draft);
      anyDraftEmitted = true;
    }
    if (!anyDraftEmitted) continue;
  }

  return { drafts, skipped };
}

// ─── Per-event draft extraction ─────────────────────────────────────────────

function extractDraft(
  ev: HeliusEvent,
  quote: QuoteRow,
  treasury: string,
): PaymentDraft | null {
  const confirmedAt = new Date(ev.timestamp * 1000).toISOString();

  if (quote.token === "SOL") {
    const transfer = (ev.nativeTransfers ?? []).find(
      (t) => t.toUserAccount === treasury,
    );
    if (!transfer) return null;
    const amountToken = transfer.amount / 10 ** TOKEN_DECIMALS.SOL;
    const amountUsd = +(amountToken * quote.tokenUsdRate).toFixed(4);
    return {
      kind: quote.kind,
      refId: (quote.metadata?.refId as string) ?? null,
      operatorId: null,
      profileId: quote.profileId,
      payerWallet: transfer.fromUserAccount,
      token: "SOL",
      amountUsd,
      amountToken,
      discountApplied: false,
      quoteId: quote.id,
      txSignature: ev.signature,
      status: "confirmed",
      confirmedAt,
    };
  }

  // SPL path — LASTSHFT or USDT
  const splTransfer = (ev.tokenTransfers ?? []).find(
    (t) => t.toUserAccount === treasury && tokenForMint(t.mint) === quote.token,
  );
  if (!splTransfer) return null;

  const token: PaymentToken = quote.token === "LASTSHFT" ? "LASTSHFT" : "USDT";
  const amountToken = splTransfer.tokenAmount;
  const amountUsd = +(amountToken * quote.tokenUsdRate).toFixed(4);

  return {
    kind: quote.kind,
    refId: (quote.metadata?.refId as string) ?? null,
    operatorId: null,
    profileId: quote.profileId,
    payerWallet: splTransfer.fromUserAccount,
    token,
    amountUsd,
    amountToken,
    discountApplied: quote.token === "LASTSHFT",
    quoteId: quote.id,
    txSignature: ev.signature,
    status: "confirmed",
    confirmedAt,
  };
}
