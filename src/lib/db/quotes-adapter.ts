/**
 * Quotes — Supabase adapter.
 *
 * Mirrors the in-memory `quotes-store.ts` shape one-for-one. The store
 * file dispatches to memory / dual / supabase based on
 * `getStoreMode("quotes")`. Memory is the source of truth in `dual`
 * mode; Supabase writes are fire-and-forget so a flaky DB cannot break
 * the user-facing quote issue path.
 *
 * Reads in `supabase` mode go through the service-role client (server
 * routes only — quotes are never queried directly from the browser).
 */

import { supabaseService } from "./client";
import type { QuoteRow, QuoteStatus } from "../quotes-store";

const TABLE = "quotes";

function rowToDb(row: QuoteRow): Record<string, unknown> {
  return {
    id: row.id,
    reference: row.reference,
    profile_id: row.profileId,
    kind: row.kind,
    token: row.token,
    expected_usd: row.expectedUsd,
    expected_token: row.expectedToken,
    token_usd_rate: row.tokenUsdRate,
    metadata: row.metadata ?? null,
    status: row.status,
    consumed_tx_signature: row.consumedTxSignature ?? null,
    issued_at: row.issuedAt,
    expires_at: row.expiresAt,
  };
}

function rowFromDb(r: Record<string, unknown>): QuoteRow {
  return {
    id: r.id as string,
    reference: r.reference as string,
    profileId: r.profile_id as string,
    kind: r.kind as QuoteRow["kind"],
    token: r.token as QuoteRow["token"],
    expectedUsd: Number(r.expected_usd),
    expectedToken: Number(r.expected_token),
    tokenUsdRate: Number(r.token_usd_rate),
    issuedAt: r.issued_at as string,
    expiresAt: r.expires_at as string,
    status: r.status as QuoteStatus,
    consumedTxSignature: (r.consumed_tx_signature as string | null) ?? undefined,
    metadata: (r.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

/**
 * Insert a freshly issued quote. In `dual` mode this is fire-and-forget:
 * we log errors but never throw, so a Supabase outage cannot break the
 * user's pay flow during migration.
 */
export async function insertQuote(row: QuoteRow): Promise<void> {
  const { error } = await supabaseService().from(TABLE).insert(rowToDb(row));
  if (error) throw new Error(`[quotes-adapter] insert: ${error.message}`);
}

export async function getQuoteById(id: string): Promise<QuoteRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[quotes-adapter] getById: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function getQuoteByReference(
  reference: string,
): Promise<QuoteRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(`[quotes-adapter] getByReference: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function markConsumed(
  id: string,
  txSignature: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .update({ status: "consumed", consumed_tx_signature: txSignature })
    .eq("id", id);
  if (error) throw new Error(`[quotes-adapter] markConsumed: ${error.message}`);
}

export async function markExpired(id: string): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(`[quotes-adapter] markExpired: ${error.message}`);
}

export async function sweepExpired(nowIso: string): Promise<number> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .update({ status: "expired" })
    .eq("status", "open")
    .lte("expires_at", nowIso)
    .select("id");
  if (error) throw new Error(`[quotes-adapter] sweepExpired: ${error.message}`);
  return data?.length ?? 0;
}

export async function listByProfile(profileId: string): Promise<QuoteRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId);
  if (error) throw new Error(`[quotes-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Test-only: nuke all rows. Service role only. */
export async function __resetQuotesDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[quotes-adapter] reset: ${error.message}`);
}
