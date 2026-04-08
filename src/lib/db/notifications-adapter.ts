/**
 * Notifications — Supabase adapter. Schema matches in-memory shape 1:1.
 */

import { supabaseService } from "./client";
import type { NotificationRow, NotificationKind } from "../notifications-store";

const TABLE = "notifications";

function rowToDb(row: NotificationRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    kind: row.kind,
    body: row.body,
    read_at: row.readAt,
    created_at: row.createdAt,
  };
}

function rowFromDb(r: Record<string, unknown>): NotificationRow {
  return {
    id: r.id as string,
    profileId: r.profile_id as string,
    kind: r.kind as NotificationKind,
    body: r.body as string,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function insertNotificationRow(row: NotificationRow): Promise<void> {
  const { error } = await supabaseService().from(TABLE).insert(rowToDb(row));
  if (error) throw new Error(`[notifications-adapter] insert: ${error.message}`);
}

export async function listNotificationsByProfile(
  profileId: string,
): Promise<NotificationRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[notifications-adapter] list: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

export async function __resetNotificationsDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[notifications-adapter] reset: ${error.message}`);
}
