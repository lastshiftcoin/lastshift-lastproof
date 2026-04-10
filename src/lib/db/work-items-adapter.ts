/**
 * Work items — Supabase adapter.
 *
 * Each work item is a project an operator has worked on (ticker, role,
 * dates). Work items are the anchor for proofs — each proof references
 * a work_item_id. The public profile renders these as the "PROOF OF WORK"
 * section with VERIFY THIS WORK buttons.
 */

import { supabaseService } from "./client";

const TABLE = "work_items";

// ─── DB shape ──────────────────────────────────────────────────────────────

export interface DbWorkItem {
  id: string;
  profile_id: string;
  ticker: string | null;
  role: string;
  description: string | null;
  started_at: string | null;
  ended_at: string | null;
  minted: boolean;
  is_dev: boolean;
  position: number;
}

// ─── App shape ─────────────────────────────────────────────────────────────

export interface WorkItemRow {
  id: string;
  profileId: string;
  ticker: string | null;
  role: string;
  description: string | null;
  startedAt: string | null;
  endedAt: string | null;
  minted: boolean;
  isDev: boolean;
  position: number;
}

// ─── Converters ────────────────────────────────────────────────────────────

function rowFromDb(r: DbWorkItem): WorkItemRow {
  return {
    id: r.id,
    profileId: r.profile_id,
    ticker: r.ticker,
    role: r.role,
    description: r.description,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    minted: r.minted ?? false,
    isDev: r.is_dev ?? false,
    position: r.position,
  };
}

function rowToDb(row: WorkItemRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    ticker: row.ticker,
    role: row.role,
    description: row.description,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    minted: row.minted,
    is_dev: row.isDev,
    position: row.position,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function upsertWorkItem(row: WorkItemRow): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .upsert(rowToDb(row), { onConflict: "id" });
  if (error) throw new Error(`[work-items-adapter] upsert: ${error.message}`);
}

export async function deleteWorkItem(id: string): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`[work-items-adapter] delete: ${error.message}`);
}

export async function getWorkItemById(id: string): Promise<WorkItemRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle<DbWorkItem>();
  if (error) throw new Error(`[work-items-adapter] getById: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function listWorkItemsByProfile(profileId: string): Promise<WorkItemRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("position", { ascending: true })
    .returns<DbWorkItem[]>();
  if (error) throw new Error(`[work-items-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/**
 * Count confirmed proofs per work item. Used by the projector to populate
 * `WorkItem.proofCount` on the public profile view.
 */
export async function countProofsByWorkItem(
  workItemId: string,
): Promise<number> {
  const { count, error } = await supabaseService()
    .from("proofs")
    .select("*", { count: "exact", head: true })
    .eq("work_item_id", workItemId)
    .eq("status", "confirmed");
  if (error) throw new Error(`[work-items-adapter] countProofs: ${error.message}`);
  return count ?? 0;
}

/** Test-only. */
export async function __resetWorkItemsDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[work-items-adapter] reset: ${error.message}`);
}
