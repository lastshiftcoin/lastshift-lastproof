/**
 * Payments — Supabase adapter.
 *
 * Mirrors `payments-store.ts` one-for-one. The unique constraint on
 * `tx_signature` in 0001_init.sql is what makes upsert idempotent at
 * the DB layer — even if two webhook deliveries race past the
 * in-memory check, only one row survives.
 *
 * In `dual` mode the in-memory store is the source of truth and
 * Supabase writes are fire-and-forget so a flaky DB cannot break the
 * webhook handler during migration.
 */

import { supabaseService } from "./client";
import type {
  PaymentRow,
  PaymentDraft,
  PaymentKind,
  PaymentStatus,
  PaymentToken,
} from "../payments-store";

const TABLE = "payments";

function rowToDb(row: PaymentRow): Record<string, unknown> {
  return {
    id: row.id,
    operator_id: row.operatorId,
    profile_id: row.profileId,
    quote_id: row.quoteId,
    kind: row.kind,
    ref_id: row.refId,
    payer_wallet: row.payerWallet,
    token: row.token,
    amount_usd: row.amountUsd,
    amount_token: row.amountToken,
    discount_applied: row.discountApplied,
    tx_signature: row.txSignature,
    status: row.status,
    created_at: row.createdAt,
    confirmed_at: row.confirmedAt,
  };
}

function rowFromDb(r: Record<string, unknown>): PaymentRow {
  return {
    id: r.id as string,
    kind: r.kind as PaymentKind,
    refId: (r.ref_id as string | null) ?? null,
    operatorId: (r.operator_id as string | null) ?? null,
    profileId: (r.profile_id as string | null) ?? null,
    payerWallet: r.payer_wallet as string,
    token: r.token as PaymentToken,
    amountUsd: Number(r.amount_usd),
    amountToken: Number(r.amount_token),
    discountApplied: Boolean(r.discount_applied),
    quoteId: (r.quote_id as string | null) ?? null,
    txSignature: r.tx_signature as string,
    status: r.status as PaymentStatus,
    createdAt: r.created_at as string,
    confirmedAt: (r.confirmed_at as string | null) ?? null,
  };
}

/**
 * Insert a fresh row. Idempotency is enforced by the `tx_signature`
 * UNIQUE constraint — on conflict we swallow the error and return,
 * because in `dual` mode the memory store has already accepted the
 * write and downstream effects have already fired.
 */
export async function insertPayment(row: PaymentRow): Promise<void> {
  const { error } = await supabaseService().from(TABLE).insert(rowToDb(row));
  if (error) {
    // 23505 = unique_violation. Expected on duplicate webhook delivery.
    if (error.code === "23505") return;
    throw new Error(`[payments-adapter] insert: ${error.message}`);
  }
}

export async function markPaymentConfirmed(
  txSignature: string,
  confirmedAtIso: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .update({ status: "confirmed", confirmed_at: confirmedAtIso })
    .eq("tx_signature", txSignature)
    .neq("status", "confirmed");
  if (error) throw new Error(`[payments-adapter] markConfirmed: ${error.message}`);
}

export async function getPaymentByTxSignature(
  txSignature: string,
): Promise<PaymentRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("tx_signature", txSignature)
    .maybeSingle();
  if (error) throw new Error(`[payments-adapter] getByTx: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function listAllPayments(): Promise<PaymentRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[payments-adapter] listAll: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Test-only. */
export async function __resetPaymentsDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[payments-adapter] reset: ${error.message}`);
}

// Re-export for callers that want a typed reference to the draft shape.
export type { PaymentDraft };
