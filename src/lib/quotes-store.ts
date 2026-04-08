/**
 * Quotes store — in-memory, TTL-aware. Swap to Supabase later without
 * touching callers.
 *
 * A quote is issued when the user clicks "Pay." It locks:
 *   - the item (kind)
 *   - the token choice
 *   - the expected USD amount (post-discount if LASTSHFT)
 *   - the expected token amount (token-denominated, locked at issue)
 *   - the TTL window
 *
 * The webhook resolves incoming payments by `quoteId` and validates
 * against THIS row. No quote → reject `quote_not_found`. Expired →
 * `quote_expired`. Token mismatch → `discount_token_mismatch`.
 */

import type { PaymentKindPriced, PaymentToken } from "./pricing";
import { priceFor, quoteTtlSec } from "./pricing";
import { generateReferenceBase58 } from "./base58";
import { getStoreMode } from "./db/mode";
import * as quotesDb from "./db/quotes-adapter";

// In `dual` mode, memory is the source of truth and Supabase writes are
// fire-and-forget so a flaky DB cannot break the user-facing flow during
// migration. We log errors via console.error and move on.
function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[quotes-store] dual-write ${label} failed:`, err);
  });
}

export type QuoteStatus = "open" | "consumed" | "expired";

export interface QuoteRow {
  id: string;
  /**
   * Solana Pay reference key: base58-encoded 32-byte value, per
   * https://docs.solanapay.com/spec#reference. Included as a read-only,
   * non-signer account key in the user's transfer instruction. Validators
   * index transactions by these account keys, so the Helius webhook
   * filter pins on it and the parser uses it to resolve back to this
   * quote without needing the tx signature in advance.
   */
  reference: string;
  profileId: string;
  kind: PaymentKindPriced;
  token: PaymentToken;
  expectedUsd: number;
  /** Token-denominated amount locked at issue time. */
  expectedToken: number;
  /** USD/token rate used at issue time. */
  tokenUsdRate: number;
  issuedAt: string;
  expiresAt: string;
  status: QuoteStatus;
  consumedTxSignature?: string;
  metadata?: Record<string, unknown>;
}

const rows = new Map<string, QuoteRow>();
const byReference = new Map<string, string>(); // reference → quoteId

export interface IssueQuoteInput {
  profileId: string;
  kind: PaymentKindPriced;
  token: PaymentToken;
  /** Current token/USD rate (real: pulled from oracle; dev: stub). */
  tokenUsdRate: number;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export function issueQuote(input: IssueQuoteInput): QuoteRow {
  const now = input.now ?? new Date();
  const expectedUsd = priceFor(input.kind, input.token);
  const expectedToken = +(expectedUsd / input.tokenUsdRate).toFixed(6);
  const ttl = quoteTtlSec(input.token);
  const expires = new Date(now.getTime() + ttl * 1000);

  const reference = generateReferenceBase58();
  const row: QuoteRow = {
    id: crypto.randomUUID(),
    reference,
    profileId: input.profileId,
    kind: input.kind,
    token: input.token,
    expectedUsd,
    expectedToken,
    tokenUsdRate: input.tokenUsdRate,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: "open",
    metadata: input.metadata,
  };
  rows.set(row.id, row);
  byReference.set(reference, row.id);

  const mode = getStoreMode("quotes");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertQuote", quotesDb.insertQuote(row));
  }
  return row;
}

export function getQuote(id: string): QuoteRow | null {
  return rows.get(id) ?? null;
}

export function getQuoteByReference(reference: string): QuoteRow | null {
  const id = byReference.get(reference);
  return id ? (rows.get(id) ?? null) : null;
}

export function markQuoteConsumed(id: string, txSignature: string): QuoteRow | null {
  const row = rows.get(id);
  if (!row) return null;
  row.status = "consumed";
  row.consumedTxSignature = txSignature;

  const mode = getStoreMode("quotes");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("markConsumed", quotesDb.markConsumed(id, txSignature));
  }
  return row;
}

export function markQuoteExpired(id: string): void {
  const row = rows.get(id);
  if (row && row.status === "open") {
    row.status = "expired";
    const mode = getStoreMode("quotes");
    if (mode === "dual" || mode === "supabase") {
      fireAndForget("markExpired", quotesDb.markExpired(id));
    }
  }
}

/**
 * Sweep all open quotes whose TTL has elapsed and flip them to expired.
 * Returns the count flipped. Called by the subscription cron daily and
 * can also be called opportunistically. This is the belt-and-suspenders
 * counterpart to the lazy expiry check in tolerance.ts — tolerance
 * rejects a specific payment against an expired quote, but until the
 * sweep runs the quote row itself lies in the store as `open`.
 */
export function sweepExpiredQuotes(now: Date = new Date()): number {
  const cutoff = now.getTime();
  let flipped = 0;
  for (const row of rows.values()) {
    if (row.status === "open" && new Date(row.expiresAt).getTime() <= cutoff) {
      row.status = "expired";
      flipped++;
    }
  }
  const mode = getStoreMode("quotes");
  if (flipped > 0 && (mode === "dual" || mode === "supabase")) {
    fireAndForget("sweepExpired", quotesDb.sweepExpired(now.toISOString()));
  }
  return flipped;
}

export function listQuotes(profileId?: string): QuoteRow[] {
  const all = Array.from(rows.values());
  return profileId ? all.filter((r) => r.profileId === profileId) : all;
}

export function __resetQuotes(): void {
  rows.clear();
  byReference.clear();
}

export function hasOpenHandleChangeQuote(profileId: string, now: Date = new Date()): boolean {
  for (const r of rows.values()) {
    if (
      r.profileId === profileId &&
      r.kind === "handle_change" &&
      r.status === "open" &&
      new Date(r.expiresAt) > now
    ) {
      return true;
    }
  }
  return false;
}
