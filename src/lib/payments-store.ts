/**
 * Payments store — typed stub mirroring the `payments` Supabase table.
 *
 * v1 is an in-memory Map keyed by tx_signature. Swap for Supabase by
 * reimplementing `upsertByTxSignature` / `getByTxSignature` / `listAll` with
 * a service-role client — the public API stays identical, callers don't move.
 *
 * IDEMPOTENCY IS THE WHOLE POINT. Helius can deliver the same webhook more
 * than once (retries, at-least-once semantics). Upsert by tx_signature is
 * the single gate that makes every downstream side effect safe to fire at
 * most once per on-chain payment.
 */

export type PaymentKind =
  | "subscription"
  | "proof"
  | "dev_verification"
  | "handle_change";
export type PaymentStatus = "pending" | "confirmed" | "failed";
export type PaymentToken = "LASTSHFT" | "SOL" | "USDT";

export interface PaymentRow {
  id: string;
  kind: PaymentKind;
  /** FK into profiles / work_items / etc. depending on kind. Null for unlinked webhooks we later backfill. */
  refId: string | null;
  operatorId: string | null;
  profileId: string | null;
  payerWallet: string;
  token: PaymentToken;
  amountUsd: number;
  amountToken: number;
  discountApplied: boolean;
  quoteId: string | null;
  txSignature: string;
  status: PaymentStatus;
  createdAt: string; // ISO
  confirmedAt: string | null;
}

export type PaymentDraft = Omit<PaymentRow, "id" | "createdAt">;

/** Result of an upsert. `created` distinguishes "this is new" from "we've seen it." */
export interface UpsertResult {
  created: boolean;
  row: PaymentRow;
}

// ─── In-memory store ────────────────────────────────────────────────────────

import { getStoreMode } from "./db/mode";
import * as paymentsDb from "./db/payments-adapter";

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[payments-store] dual-write ${label} failed:`, err);
  });
}

const byTxSignature = new Map<string, PaymentRow>();

function newId(): string {
  // Crypto-random UUID v4 without a dep. Swap for DB default on Supabase cutover.
  return crypto.randomUUID();
}

/**
 * Contract for profileId / operatorId by `kind`:
 *   - subscription       → profileId REQUIRED, operatorId auto-filled from profile
 *   - proof              → profileId REQUIRED (proof target, not payer)
 *   - dev_verification   → profileId REQUIRED (badge recipient)
 *   - handle_change      → profileId REQUIRED
 *
 * The payer wallet is always in `payerWallet`, never conflated with
 * profileId. If a future kind needs a payer-owned operator, add it
 * explicitly in the draft rather than piggy-backing on operatorId.
 */
export async function upsertByTxSignature(draft: PaymentDraft): Promise<UpsertResult> {
  // Normalize operatorId: if caller left it null but profileId is set,
  // backfill from the profiles store. Profile store is async (supports
  // dual / supabase modes), so we await. Dynamic import breaks the
  // circular import with profiles-store.
  let operatorId = draft.operatorId;
  if (!operatorId && draft.profileId) {
    const { getProfileById } = await import("./profiles-store");
    const profile = await getProfileById(draft.profileId);
    if (profile) operatorId = profile.operatorId;
  }
  const normalizedDraft: PaymentDraft = { ...draft, operatorId };

  const mode = getStoreMode("payments");

  if (mode === "supabase") {
    // Supabase is authoritative. Check for existing row first.
    const existing = await paymentsDb.getPaymentByTxSignature(draft.txSignature);
    if (existing) return { created: false, row: existing };

    const row: PaymentRow = {
      id: newId(),
      createdAt: new Date().toISOString(),
      ...normalizedDraft,
    };
    await paymentsDb.insertPayment(row);
    return { created: true, row };
  }

  // memory + dual paths — memory is source of truth.
  const existing = byTxSignature.get(draft.txSignature);
  if (existing) {
    return { created: false, row: existing };
  }

  const row: PaymentRow = {
    id: newId(),
    createdAt: new Date().toISOString(),
    ...normalizedDraft,
  };
  byTxSignature.set(row.txSignature, row);

  if (mode === "dual") {
    fireAndForget("insertPayment", paymentsDb.insertPayment(row));
  }
  return { created: true, row };
}

export async function markConfirmed(
  txSignature: string,
  confirmedAt = new Date().toISOString(),
): Promise<PaymentRow | null> {
  const mode = getStoreMode("payments");

  if (mode === "supabase") {
    const row = await paymentsDb.getPaymentByTxSignature(txSignature);
    if (!row) return null;
    if (row.status === "confirmed") return row;
    await paymentsDb.markPaymentConfirmed(txSignature, confirmedAt);
    return { ...row, status: "confirmed", confirmedAt };
  }

  const row = byTxSignature.get(txSignature);
  if (!row) return null;
  if (row.status === "confirmed") return row;
  row.status = "confirmed";
  row.confirmedAt = confirmedAt;

  if (mode === "dual") {
    fireAndForget(
      "markConfirmed",
      paymentsDb.markPaymentConfirmed(txSignature, confirmedAt),
    );
  }
  return row;
}

export async function getByTxSignature(txSignature: string): Promise<PaymentRow | null> {
  if (getStoreMode("payments") === "supabase") {
    return paymentsDb.getPaymentByTxSignature(txSignature);
  }
  return byTxSignature.get(txSignature) || null;
}

export async function listAll(): Promise<PaymentRow[]> {
  if (getStoreMode("payments") === "supabase") {
    return paymentsDb.listAllPayments();
  }
  return Array.from(byTxSignature.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Dev-only — used by tests and the _debug route to reset between runs. */
export function __resetStore(): void {
  byTxSignature.clear();
}
