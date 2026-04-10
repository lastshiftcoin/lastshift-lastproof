/**
 * Avatar storage — upload / delete / get URL helpers.
 *
 * Bucket: `avatars` (public-read, created by 0002_storage_buckets.sql).
 * File path convention: `{profileId}.jpg`
 *
 * All uploads go through the service-role client so RLS doesn't block
 * server-side writes from API routes / dashboard actions.
 */

import { supabaseService } from "../db/client";

const BUCKET = "avatars";

/** Max avatar file size: 2 MB. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Allowed MIME types for avatar uploads. */
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload (or overwrite) the avatar for a profile.
 *
 * @param profileId  The profile UUID — used as the filename.
 * @param file       A Blob / File / Buffer with the image data.
 * @param contentType  MIME type (default: image/jpeg).
 * @returns The public URL for the uploaded avatar.
 */
export async function uploadAvatar(
  profileId: string,
  file: Blob | Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const path = `${profileId}.jpg`;

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: true, // overwrite existing
      cacheControl: "3600", // 1 hour browser cache
    });

  if (error) {
    throw new Error(`[storage/avatars] upload failed: ${error.message}`);
  }

  return getAvatarUrl(profileId);
}

/**
 * Delete the avatar for a profile.
 */
export async function deleteAvatar(profileId: string): Promise<void> {
  const path = `${profileId}.jpg`;

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`[storage/avatars] delete failed: ${error.message}`);
  }
}

/**
 * Get the public URL for a profile's avatar.
 * Does NOT check if the file exists — returns the URL regardless.
 */
export function getAvatarUrl(profileId: string): string {
  const { data } = supabaseService()
    .storage.from(BUCKET)
    .getPublicUrl(`${profileId}.jpg`);

  return data.publicUrl;
}
