/**
 * Display-string cap helpers for chad UI.
 *
 * CSS ellipsis truncates by pixel width which gives inconsistent cut
 * points across viewports. Per FRONTEND-NOTES, chad tiles cap names
 * and handles in JS at render time so truncation is consistent
 * regardless of the column width. CSS ellipsis stays as the second
 * line of defense for unusually wide glyphs.
 */

const ELLIPSIS = "…";

export function capDisplayName(s: string | null | undefined): string {
  const value = (s ?? "").trim();
  if (!value) return "";
  if (value.length <= 24) return value;
  return value.slice(0, 23) + ELLIPSIS;
}

export function capHandle(s: string | null | undefined): string {
  const value = (s ?? "").trim();
  if (!value) return "";
  if (value.length <= 15) return value;
  return value.slice(0, 14) + ELLIPSIS;
}
