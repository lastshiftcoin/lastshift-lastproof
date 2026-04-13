/**
 * Proofs — Supabase adapter.
 *
 * Mirrors `proofs-store.ts`. Note: 0002_proofs_dual_write.sql added
 * `profile_id` + `kind` columns and relaxed NOT NULLs on
 * voucher_wallet/token/amount_usd/work_item_id so the skeleton's
 * minimal ProofRow shape inserts cleanly. Once the full UI lands those
 * columns will be populated again.
 *
 * `dual` mode keeps memory authoritative.
 */

import { supabaseService } from "./client";
import type { ProofRow } from "../proofs-store";

const TABLE = "proofs";

function rowToDb(row: ProofRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    work_item_id: row.workItemId,
    kind: row.kind,
    tx_signature: row.txSignature,
    payer_wallet: row.payerWallet,
    note: row.note,
    created_at: row.createdAt,
    status: "confirmed",
  };
}

function rowFromDb(r: Record<string, unknown>): ProofRow {
  return {
    id: r.id as string,
    profileId: r.profile_id as string,
    workItemId: (r.work_item_id as string | null) ?? null,
    kind: r.kind as ProofRow["kind"],
    txSignature: r.tx_signature as string,
    payerWallet: (r.payer_wallet as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function insertProofRow(row: ProofRow): Promise<void> {
  const { error } = await supabaseService().from(TABLE).insert(rowToDb(row));
  if (error) {
    if (error.code === "23505") return; // duplicate tx_signature — idempotent
    throw new Error(`[proofs-adapter] insert: ${error.message}`);
  }
}

export async function listProofsByProfile(profileId: string): Promise<ProofRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[proofs-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

export async function countProofsByProfile(
  profileId: string,
  kind: ProofRow["kind"],
): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("kind", kind);
  if (error) throw new Error(`[proofs-adapter] count: ${error.message}`);
  return count ?? 0;
}

/** Test-only. */
export async function __resetProofsDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[proofs-adapter] reset: ${error.message}`);
}
