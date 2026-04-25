/**
 * Chads — Supabase adapter (supabase-direct, no memory/dual layer).
 *
 * Wallet-keyed friend graph. One row per directional pair. See
 * supabase/migrations/0021_chads.sql for the schema and
 * docs/features/chad/COWORK-BRIEF.md for the locked mechanics:
 *
 *   - status `pending` — requester sent, target hasn't responded
 *   - status `accepted` — target accepted; both are chads
 *   - deny == hard row delete (re-request automatic on re-ask)
 *   - ignore == no row mutation (sits forever, requester locked out)
 *   - remove == hard row delete on either side
 *
 * The adapter only enforces uniqueness, status enum, and self-chad
 * blocks via DB constraints. Higher-level rules (lapses, eligibility
 * branching) live in src/lib/chads/resolve-phase.ts.
 */

import { supabaseService } from "./client";

const TABLE = "chads";

export type ChadStatus = "pending" | "accepted";

// ─── DB shape ───────────────────────────────────────────────────────────────

interface DbChad {
  id: number;
  requester_wallet: string;
  target_wallet: string;
  status: ChadStatus;
  created_at: string;
  accepted_at: string | null;
}

// ─── App shape ──────────────────────────────────────────────────────────────

export interface ChadRow {
  id: number;
  requesterWallet: string;
  targetWallet: string;
  status: ChadStatus;
  createdAt: string;
  acceptedAt: string | null;
}

function rowFromDb(r: DbChad): ChadRow {
  return {
    id: r.id,
    requesterWallet: r.requester_wallet,
    targetWallet: r.target_wallet,
    status: r.status,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Lookup the row (if any) representing a pending or accepted relationship
 *  in either direction. Symmetric: chads are bidirectional once accepted, so
 *  callers checking "are these two chads?" want either direction. */
export async function findChadshipBetween(
  walletA: string,
  walletB: string,
): Promise<ChadRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .or(
      `and(requester_wallet.eq.${walletA},target_wallet.eq.${walletB}),and(requester_wallet.eq.${walletB},target_wallet.eq.${walletA})`,
    )
    .limit(1)
    .returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] findBetween: ${error.message}`);
  const r = (data ?? [])[0];
  return r ? rowFromDb(r) : null;
}

/** Pending requests targeting a wallet (the dashboard pending queue). */
export async function listPendingForTarget(
  targetWallet: string,
  cursor?: number,
  limit = 24,
): Promise<ChadRow[]> {
  let q = supabaseService()
    .from(TABLE)
    .select("*")
    .eq("target_wallet", targetWallet)
    .eq("status", "pending")
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("id", cursor);
  const { data, error } = await q.returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] listPending: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Accepted chadships in either direction for a wallet. */
export async function listAcceptedForWallet(
  wallet: string,
  cursor?: number,
  limit = 48,
): Promise<ChadRow[]> {
  let q = supabaseService()
    .from(TABLE)
    .select("*")
    .or(`requester_wallet.eq.${wallet},target_wallet.eq.${wallet}`)
    .eq("status", "accepted")
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("id", cursor);
  const { data, error } = await q.returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] listAccepted: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Total pending count for a wallet (dashboard badge). */
export async function countPendingForTarget(targetWallet: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("target_wallet", targetWallet)
    .eq("status", "pending");
  if (error) throw new Error(`[chads-adapter] countPending: ${error.message}`);
  return count ?? 0;
}

/** Total accepted-chadship count in either direction for a wallet. */
export async function countAcceptedForWallet(wallet: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .or(`requester_wallet.eq.${wallet},target_wallet.eq.${wallet}`)
    .eq("status", "accepted");
  if (error) throw new Error(`[chads-adapter] countAccepted: ${error.message}`);
  return count ?? 0;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Insert a pending request. Throws on uniqueness/check violations. */
export async function insertPendingRequest(
  requesterWallet: string,
  targetWallet: string,
): Promise<ChadRow> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .insert({
      requester_wallet: requesterWallet,
      target_wallet: targetWallet,
      status: "pending",
    })
    .select("*")
    .single<DbChad>();
  if (error) throw new Error(`[chads-adapter] insertPending: ${error.message}`);
  return rowFromDb(data);
}

/** Flip a pending row to accepted. Caller must verify the target wallet
 *  matches the session — this method does NOT enforce that. */
export async function acceptPending(
  requesterWallet: string,
  targetWallet: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("requester_wallet", requesterWallet)
    .eq("target_wallet", targetWallet)
    .eq("status", "pending");
  if (error) throw new Error(`[chads-adapter] accept: ${error.message}`);
}

/** Hard-delete a pending row (deny path) or accepted row (remove path).
 *  Symmetric on accepted: matches either direction so Remove works from
 *  whichever side initiates. */
export async function deleteChadship(walletA: string, walletB: string): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .or(
      `and(requester_wallet.eq.${walletA},target_wallet.eq.${walletB}),and(requester_wallet.eq.${walletB},target_wallet.eq.${walletA})`,
    );
  if (error) throw new Error(`[chads-adapter] delete: ${error.message}`);
}

/** Test-only. */
export async function __resetChadsDb(): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().gt("id", 0);
  if (error) throw new Error(`[chads-adapter] reset: ${error.message}`);
}
