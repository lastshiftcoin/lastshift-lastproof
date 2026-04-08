/**
 * Quotes store — in-memory + mode-dispatched Supabase.
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
 *
 * Dispatch modes (see `LASTPROOF_DB_QUOTES`):
 *   - memory    — RAM only
 *   - dual      — RAM authoritative, fire-and-forget to Supabase
 *   - supabase  — Supabase authoritative, RAM not consulted
 */

import type { PaymentKindPriced, PaymentToken } from "./pricing";
import { priceFor, quoteTtlSec } from "./pricing";
import { generateReferenceBase58 } from "./base58";
import { getStoreMode } from "./db/mode";
import * as quotesDb from "./db/quotes-adapter";

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
   * https://docs.solanapay.com/spec#reference.
   */
  reference: string;
  profileId: string;
  kind: PaymentKindPriced;
  token: PaymentToken;
  expectedUsd: number;
  expectedToken: number;
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

  const mode = getStoreMode("quotes");
  // Mirror into memory regardless — in supabase mode it's a harmless
  // cache that keeps the synchronous `issueQuote` shape; dependent
  // reads (`getQuote`, `getQuoteByReference`) go through the DB.
  rows.set(row.id, row);
  byReference.set(reference, row.id);

  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertQuote", quotesDb.insertQuote(row));
  }
  return row;
}

export async function getQuote(id: string): Promise<QuoteRow | null> {
  if (getStoreMode("quotes") === "supabase") {
    return quotesDb.getQuoteById(id);
  }
  return rows.get(id) ?? null;
}

export async function getQuoteByReference(
  reference: string,
): Promise<QuoteRow | null> {
  if (getStoreMode("quotes") === "supabase") {
    return quotesDb.getQuoteByReference(reference);
  }
  const id = byReference.get(reference);
  return id ? (rows.get(id) ?? null) : null;
}

export async function markQuoteConsumed(
  id: string,
  txSignature: string,
): Promise<QuoteRow | null> {
  const mode = getStoreMode("quotes");
  if (mode === "supabase") {
    const row = await quotesDb.getQuoteById(id);
    if (!row) return null;
    await quotesDb.markConsumed(id, txSignature);
    return { ...row, status: "consumed", consumedTxSignature: txSignature };
  }
  const row = rows.get(id);
  if (!row) return null;
  row.status = "consumed";
  row.consumedTxSignature = txSignature;
  if (mode === "dual") {
    fireAndForget("markConsumed", quotesDb.markConsumed(id, txSignature));
  }
  return row;
}

export async function markQuoteExpired(id: string): Promise<void> {
  const mode = getStoreMode("quotes");
  if (mode === "supabase") {
    await quotesDb.markExpired(id);
    return;
  }
  const row = rows.get(id);
  if (row && row.status === "open") {
    row.status = "expired";
    if (mode === "dual") {
      fireAndForget("markExpired", quotesDb.markExpired(id));
    }
  }
}

/**
 * Sweep all open quotes whose TTL has elapsed and flip them to expired.
 * Belt-and-suspenders to the lazy expiry check in tolerance.ts.
 */
export async function sweepExpiredQuotes(now: Date = new Date()): Promise<number> {
  const mode = getStoreMode("quotes");
  if (mode === "supabase") {
    return quotesDb.sweepExpired(now.toISOString());
  }
  const cutoff = now.getTime();
  let flipped = 0;
  for (const row of rows.values()) {
    if (row.status === "open" && new Date(row.expiresAt).getTime() <= cutoff) {
      row.status = "expired";
      flipped++;
    }
  }
  if (flipped > 0 && mode === "dual") {
    fireAndForget("sweepExpired", quotesDb.sweepExpired(now.toISOString()));
  }
  return flipped;
}

export async function listQuotes(profileId?: string): Promise<QuoteRow[]> {
  if (getStoreMode("quotes") === "supabase") {
    if (!profileId) {
      throw new Error("[quotes-store] listQuotes without profileId not supported in supabase mode");
    }
    return quotesDb.listByProfile(profileId);
  }
  const all = Array.from(rows.values());
  return profileId ? all.filter((r) => r.profileId === profileId) : all;
}

export function __resetQuotes(): void {
  rows.clear();
  byReference.clear();
}

export async function hasOpenHandleChangeQuote(
  profileId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (getStoreMode("quotes") === "supabase") {
    const all = await quotesDb.listByProfile(profileId);
    return all.some(
      (r) =>
        r.kind === "handle_change" &&
        r.status === "open" &&
        new Date(r.expiresAt) > now,
    );
  }
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
