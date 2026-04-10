/**
 * Screenshots — Supabase adapter.
 *
 * Each screenshot is an image attached to a profile, ordered by position.
 * The public profile renders these in the "SCREENSHOTS" grid section.
 */

import { supabaseService } from "./client";

const TABLE = "screenshots";

// ─── DB shape ──────────────────────────────────────────────────────────────

export interface DbScreenshot {
  id: string;
  profile_id: string;
  image_url: string;
  preview_url: string;
  aspect_ratio: number | null;
  linked_url: string | null;
  caption: string | null;
  position: number;
}

// ─── App shape ─────────────────────────────────────────────────────────────

export interface ScreenshotRow {
  id: string;
  profileId: string;
  imageUrl: string;
  previewUrl: string;
  aspectRatio: number | null;
  linkedUrl: string | null;
  caption: string | null;
  position: number;
}

// ─── Converters ────────────────────────────────────────────────────────────

function rowFromDb(r: DbScreenshot): ScreenshotRow {
  return {
    id: r.id,
    profileId: r.profile_id,
    imageUrl: r.image_url,
    previewUrl: r.preview_url,
    aspectRatio: r.aspect_ratio,
    linkedUrl: r.linked_url,
    caption: r.caption,
    position: r.position,
  };
}

function rowToDb(row: ScreenshotRow): Record<string, unknown> {
  return {
    id: row.id,
    profile_id: row.profileId,
    image_url: row.imageUrl,
    preview_url: row.previewUrl,
    aspect_ratio: row.aspectRatio,
    linked_url: row.linkedUrl,
    caption: row.caption,
    position: row.position,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function upsertScreenshot(row: ScreenshotRow): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .upsert(rowToDb(row), { onConflict: "id" });
  if (error) throw new Error(`[screenshots-adapter] upsert: ${error.message}`);
}

export async function deleteScreenshot(id: string): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`[screenshots-adapter] delete: ${error.message}`);
}

export async function listScreenshotsByProfile(profileId: string): Promise<ScreenshotRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select("*")
    .eq("profile_id", profileId)
    .order("position", { ascending: true })
    .returns<DbScreenshot[]>();
  if (error) throw new Error(`[screenshots-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Test-only. */
export async function __resetScreenshotsDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[screenshots-adapter] reset: ${error.message}`);
}
