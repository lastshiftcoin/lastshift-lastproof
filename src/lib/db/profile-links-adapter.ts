/**
 * Profile links — Supabase adapter.
 *
 * Each link is a social/website entry attached to a profile, ordered by
 * position. The public profile renders these in the "LINKS" section with
 * platform-specific icons and pinned/unpinned grouping.
 *
 * NOTE: The DB schema stores only (label, url, position). Platform detection
 * (tg/x/web/dc) and isPinned are derived at the projector layer from the URL
 * pattern and position ordering, since the wireframe pins the first N links
 * by position. If the dashboard needs explicit pin control, add `is_pinned`
 * and `platform` columns via a future migration.
 */

import { supabaseService } from "./client";

const TABLE = "profile_links";

// ─── DB shape ──────────────────────────────────────────────────────────────

export interface DbProfileLink {
  id: string;
  profile_id: string;
  label: string;
  url: string;
  platform: string;
  pinned: boolean;
  position: number;
}

// ─── App shape ─────────────────────────────────────────────────────────────

export interface ProfileLinkRow {
  id: string;
  profileId: string;
  label: string;
  url: string;
  platform: string;
  pinned: boolean;
  position: number;
}

// ─── Converters ────────────────────────────────────────────────────────────

function rowFromDb(r: DbProfileLink): ProfileLinkRow {
  return {
    id: r.id,
    profileId: r.profile_id,
    label: r.label,
    url: r.url,
    platform: r.platform ?? "web",
    pinned: r.pinned ?? false,
    position: r.position,
  };
}

function rowToDb(row: ProfileLinkRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    label: row.label,
    url: row.url,
    platform: row.platform,
    pinned: row.pinned,
    position: row.position,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function upsertProfileLink(row: ProfileLinkRow): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .upsert(rowToDb(row), { onConflict: "id" });
  if (error) throw new Error(`[profile-links-adapter] upsert: ${error.message}`);
}

export async function deleteProfileLink(id: string): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`[profile-links-adapter] delete: ${error.message}`);
}

export async function listProfileLinksByProfile(profileId: string): Promise<ProfileLinkRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("position", { ascending: true })
    .returns<DbProfileLink[]>();
  if (error) throw new Error(`[profile-links-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Test-only. */
export async function __resetProfileLinksDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[profile-links-adapter] reset: ${error.message}`);
}
