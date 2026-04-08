/**
 * Notifications store — in-memory stub mirroring `notifications` table.
 * Swap to Supabase later without touching callers.
 */

export type NotificationKind =
  | "subscription_warning"
  | "subscription_expired"
  | "subscription_reactivated"
  | "proof_received"
  | "dev_badge_earned";

export interface NotificationRow {
  id: string;
  profileId: string;
  kind: NotificationKind;
  body: string;
  readAt: string | null;
  createdAt: string;
}

import { getStoreMode } from "./db/mode";
import * as notificationsDb from "./db/notifications-adapter";

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[notifications-store] dual-write ${label} failed:`, err);
  });
}

const rows: NotificationRow[] = [];

export function insertNotification(input: {
  profileId: string;
  kind: NotificationKind;
  body: string;
}): NotificationRow {
  const row: NotificationRow = {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    kind: input.kind,
    body: input.body,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  rows.push(row);

  const mode = getStoreMode("notifications");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertNotification", notificationsDb.insertNotificationRow(row));
  }
  return row;
}

export function listNotifications(profileId?: string): NotificationRow[] {
  return profileId ? rows.filter((r) => r.profileId === profileId) : rows.slice();
}

export function __resetNotifications(): void {
  rows.length = 0;
}
