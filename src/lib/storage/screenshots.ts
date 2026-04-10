/**
 * Screenshot storage — upload / delete / get URL helpers.
 *
 * Bucket: `screenshots` (public-read, created by 0002_storage_buckets.sql).
 * File path convention: `{profileId}/{screenshotId}.jpg`
 *                       `{profileId}/{screenshotId}_preview.jpg`
 *
 * Two files per screenshot:
 *   - Full-size image (used in lightbox / detail view)
 *   - Preview / thumbnail (used in the grid on the profile page)
 *
 * All uploads go through the service-role client so RLS doesn't block
 * server-side writes from API routes / dashboard actions.
 */

import { supabaseService } from "../db/client";

const BUCKET = "screenshots";

/** Max screenshot file size: 5 MB. */
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types for screenshot uploads. */
export const SCREENSHOT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Upload the full-size screenshot image.
 *
 * @param profileId     The profile UUID — used as the folder.
 * @param screenshotId  The screenshot UUID — used as the filename.
 * @param file          A Blob / File / Buffer with the image data.
 * @param contentType   MIME type (default: image/jpeg).
 * @returns The public URL for the uploaded screenshot.
 */
export async function uploadScreenshot(
  profileId: string,
  screenshotId: string,
  file: Blob | Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const path = `${profileId}/${screenshotId}.jpg`;

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`[storage/screenshots] upload failed: ${error.message}`);
  }

  return getScreenshotUrl(profileId, screenshotId);
}

/**
 * Upload the preview/thumbnail for a screenshot.
 *
 * @param profileId     The profile UUID — used as the folder.
 * @param screenshotId  The screenshot UUID — used as the filename.
 * @param file          A Blob / File / Buffer with the preview image data.
 * @param contentType   MIME type (default: image/jpeg).
 * @returns The public URL for the uploaded preview.
 */
export async function uploadScreenshotPreview(
  profileId: string,
  screenshotId: string,
  file: Blob | Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const path = `${profileId}/${screenshotId}_preview.jpg`;

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(
      `[storage/screenshots] preview upload failed: ${error.message}`,
    );
  }

  return getScreenshotPreviewUrl(profileId, screenshotId);
}

/**
 * Delete a screenshot and its preview.
 */
export async function deleteScreenshot(
  profileId: string,
  screenshotId: string,
): Promise<void> {
  const paths = [
    `${profileId}/${screenshotId}.jpg`,
    `${profileId}/${screenshotId}_preview.jpg`,
  ];

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(`[storage/screenshots] delete failed: ${error.message}`);
  }
}

/**
 * Delete ALL screenshots for a profile (e.g. on profile deletion).
 */
export async function deleteAllScreenshots(
  profileId: string,
): Promise<void> {
  const { data: files, error: listError } = await supabaseService()
    .storage.from(BUCKET)
    .list(profileId);

  if (listError) {
    throw new Error(
      `[storage/screenshots] list failed: ${listError.message}`,
    );
  }

  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${profileId}/${f.name}`);

  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(
      `[storage/screenshots] bulk delete failed: ${error.message}`,
    );
  }
}

/**
 * Get the public URL for a full-size screenshot.
 */
export function getScreenshotUrl(
  profileId: string,
  screenshotId: string,
): string {
  const { data } = supabaseService()
    .storage.from(BUCKET)
    .getPublicUrl(`${profileId}/${screenshotId}.jpg`);

  return data.publicUrl;
}

/**
 * Get the public URL for a screenshot preview/thumbnail.
 */
export function getScreenshotPreviewUrl(
  profileId: string,
  screenshotId: string,
): string {
  const { data } = supabaseService()
    .storage.from(BUCKET)
    .getPublicUrl(`${profileId}/${screenshotId}_preview.jpg`);

  return data.publicUrl;
}
