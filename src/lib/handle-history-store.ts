/**
 * Handle history — immutable audit trail of every handle a profile has
 * held. Supports the 90-day cooldown check. Memory | dual | supabase.
 */

export interface HandleHistoryRow {
  id: string;
  profileId: string;
  oldHandle: string;
  newHandle: string;
  txSignature: string | null;
  changedAt: string;
}

import { getStoreMode } from "./db/mode";
import * as handleHistoryDb from "./db/handle-history-adapter";

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[handle-history-store] dual-write ${label} failed:`, err);
  });
}

const rows: HandleHistoryRow[] = [];

export function recordHandleChange(input: {
  profileId: string;
  oldHandle: string;
  newHandle: string;
  txSignature: string | null;
}): HandleHistoryRow {
  const row: HandleHistoryRow = {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    oldHandle: input.oldHandle,
    newHandle: input.newHandle,
    txSignature: input.txSignature,
    changedAt: new Date().toISOString(),
  };
  rows.push(row);

  const mode = getStoreMode("handle_history");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertHandleChange", handleHistoryDb.insertHandleChangeRow(row));
  }
  return row;
}

export async function lastHandleChange(profileId: string): Promise<HandleHistoryRow | null> {
  if (getStoreMode("handle_history") === "supabase") {
    const all = await handleHistoryDb.listByProfile(profileId);
    return all.length > 0 ? all[all.length - 1] : null;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].profileId === profileId) return rows[i];
  }
  return null;
}

export async function listHandleHistory(profileId?: string): Promise<HandleHistoryRow[]> {
  if (getStoreMode("handle_history") === "supabase" && profileId) {
    return handleHistoryDb.listByProfile(profileId);
  }
  return profileId ? rows.filter((r) => r.profileId === profileId) : rows.slice();
}

export function __resetHandleHistory(): void {
  rows.length = 0;
}
