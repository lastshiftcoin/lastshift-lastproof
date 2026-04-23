/**
 * Handle history — Supabase adapter. Schema 1:1 with memory shape.
 */

import { supabaseService } from "./client";
import type { HandleHistoryRow } from "../handle-history-store";

const TABLE = "handle_history";

function rowToDb(row: HandleHistoryRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    old_handle: row.oldHandle,
    new_handle: row.newHandle,
    tx_signature: row.txSignature,
    changed_at: row.changedAt,
  };
}

function rowFromDb(r: Record<string, unknown>): HandleHistoryRow {
  return {
    id: r.id as string,
    profileId: r.profile_id as string,
    oldHandle: r.old_handle as string,
    newHandle: r.new_handle as string,
    txSignature: (r.tx_signature as string | null) ?? null,
    changedAt: r.changed_at as string,
  };
}

export async function insertHandleChangeRow(row: HandleHistoryRow): Promise<void> {
  const { error } = await supabaseService().from(TABLE).insert(rowToDb(row));
  if (error) throw new Error(`[handle-history-adapter] insert: ${error.message}`);
}

export async function listByProfile(profileId: string): Promise<HandleHistoryRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("changed_at", { ascending: true });
  if (error) throw new Error(`[handle-history-adapter] list: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

export async function __resetHandleHistoryDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[handle-history-adapter] reset: ${error.message}`);
}
