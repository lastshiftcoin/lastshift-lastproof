/**
 * Storage helpers — barrel export.
 *
 * Dashboard usage:
 *   import { uploadAvatar, getAvatarUrl } from "@/lib/storage";
 *   import { uploadScreenshot, uploadScreenshotPreview } from "@/lib/storage";
 */

export {
  uploadAvatar,
  deleteAvatar,
  getAvatarUrl,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
} from "./avatars";

export {
  uploadScreenshot,
  uploadScreenshotPreview,
  deleteScreenshot,
  deleteAllScreenshots,
  getScreenshotUrl,
  getScreenshotPreviewUrl,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_ALLOWED_TYPES,
} from "./screenshots";
