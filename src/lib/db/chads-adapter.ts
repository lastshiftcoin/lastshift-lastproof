/**
 * Chads — Supabase adapter (supabase-direct, no memory/dual layer).
 *
 * Wallet-keyed friend graph, **directional one-way** semantics
 * (Instagram-private style — see COWORK-BRIEF.md § Relationship model).
 * One row per `requester_wallet → target_wallet` direction. The reverse
 * direction is a separate, independent row with its own state.
 *
 *   pending  — requester asked, target hasn't responded
 *   accepted — target accepted; target is now in requester's army
 *   deny     — hard row delete (caller's responsibility; this adapter
 *              just exposes the delete helper)
 *   ignore   — no row mutation; row sits pending until acted on
 *
 * The adapter only enforces uniqueness per direction, status enum, and
 * self-chad blocks via DB constraints. Higher-level rules (lapses,
 * eligibility branching) live in src/lib/chads/resolve-phase.ts.
 *
 * "My army" semantics: my army = chads I've successfully added =
 * rows where requester_wallet=me AND status=accepted. Their target
 * wallets are the operators in my army. The reverse query (rows
 * where target_wallet=me AND status=accepted — operators who have
 * me in THEIR army) is not surfaced by any current product
 * surface; if needed in the future, add a separate helper.
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

/** Lookup the row (if any) in the requester→target direction only.
 *  The reverse direction is a separate row and not consulted here. */
export async function findChadInDirection(
  requesterWallet: string,
  targetWallet: string,
): Promise<ChadRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("requester_wallet", requesterWallet)
    .eq("target_wallet", targetWallet)
    .limit(1)
    .returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] findInDirection: ${error.message}`);
  const r = (data ?? [])[0];
  return r ? rowFromDb(r) : null;
}

/** Pending asks targeting a wallet (the dashboard pending-asks queue). */
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

/** Accepted chad rows where the given wallet is the requester.
 *  These are the chads the wallet has successfully added — i.e. the
 *  operator's army. Returns the rows; caller pulls target_wallet to
 *  identify the actual chad operators. */
export async function listAcceptedByRequester(
  requesterWallet: string,
  cursor?: number,
  limit = 48,
): Promise<ChadRow[]> {
  let q = supabaseService()
    .from(TABLE)
    .select("*")
    .eq("requester_wallet", requesterWallet)
    .eq("status", "accepted")
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("id", cursor);
  const { data, error } = await q.returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] listAcceptedByRequester: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Total pending-asks count for a wallet (dashboard badge). */
export async function countPendingForTarget(targetWallet: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("target_wallet", targetWallet)
    .eq("status", "pending");
  if (error) throw new Error(`[chads-adapter] countPending: ${error.message}`);
  return count ?? 0;
}

/** Total accepted-chad count where wallet is the requester (= army size).
 *  Used for the public army count that appears on /@<handle> and the
 *  modal target preview — accepted only. The dashboard's "Your Chad
 *  Army" count uses countOutgoingByRequester instead, which includes
 *  pending asks the user has sent. */
export async function countAcceptedByRequester(requesterWallet: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("requester_wallet", requesterWallet)
    .eq("status", "accepted");
  if (error) throw new Error(`[chads-adapter] countAcceptedByRequester: ${error.message}`);
  return count ?? 0;
}

/** Outgoing chad rows (pending + accepted) where the wallet is the
 *  requester. Used for the dashboard's "Your Chad Army" view, which
 *  shows the user's full outgoing list — accepted chads + asks they
 *  haven't received a response on yet. Pending rows render with the
 *  ASK PENDING caption; accepted rows render with the Remove button. */
export async function listOutgoingByRequester(
  requesterWallet: string,
  cursor?: number,
  limit = 48,
): Promise<ChadRow[]> {
  let q = supabaseService()
    .from(TABLE)
    .select("*")
    .eq("requester_wallet", requesterWallet)
    .in("status", ["pending", "accepted"])
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("id", cursor);
  const { data, error } = await q.returns<DbChad[]>();
  if (error) throw new Error(`[chads-adapter] listOutgoingByRequester: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Outgoing chad count (pending + accepted) where wallet is the
 *  requester. Powers the dashboard's "Your Chad Army (Y)" count line.
 *  Public surfaces still use countAcceptedByRequester (accepted only)
 *  so visitors don't see pending/private state from the operator's
 *  outgoing list. */
export async function countOutgoingByRequester(requesterWallet: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("requester_wallet", requesterWallet)
    .in("status", ["pending", "accepted"]);
  if (error) throw new Error(`[chads-adapter] countOutgoingByRequester: ${error.message}`);
  return count ?? 0;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Insert a pending ask. Throws on uniqueness/check violations. */
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

/** Hard-delete the row in the requester→target direction.
 *  Used by:
 *  - the deny path (target denying an ask) — caller uses
 *    (requester=asker, target=session) to delete the asker's row
 *  - the remove path (operator removing a chad from their army) —
 *    caller uses (requester=session, target=removed-chad) to delete
 *    only their own row. The reverse-direction row (if any) is
 *    untouched.
 */
export async function deleteChadshipDirected(
  requesterWallet: string,
  targetWallet: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .eq("requester_wallet", requesterWallet)
    .eq("target_wallet", targetWallet);
  if (error) throw new Error(`[chads-adapter] delete: ${error.message}`);
}

/** Test-only. */
export async function __resetChadsDb(): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().gt("id", 0);
  if (error) throw new Error(`[chads-adapter] reset: ${error.message}`);
}
