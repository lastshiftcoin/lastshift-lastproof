/**
 * ChadAvatar — single avatar tile shared across the public army strip,
 * the public army page, and the dashboard chads page.
 *
 * Renders the chad's profile photo when avatarUrl is present, otherwise
 * a neutral dark gradient with initials. Per FRONTEND-NOTES the per-slot
 * vibrant gradient palette from Cowork's wireframe is NOT used in
 * production — that pattern dilutes tier color reservations.
 */

interface Props {
  avatarUrl: string | null;
  initials: string;
  handle: string;
  /** Pixel size; defaults to 54 (the public army strip avatar size). */
  size?: number;
}

export function ChadAvatar({ avatarUrl, initials, handle, size = 54 }: Props) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="chad-av chad-av-img"
        src={avatarUrl}
        alt={`@${handle}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="chad-av"
      style={{ width: size, height: size }}
      aria-label={`@${handle}`}
    >
      {initials}
    </div>
  );
}

/** Deterministic initials from a handle — first 2 chars uppercased, no
 *  separator. Stable across renders for cache-friendliness. */
export function initialsForHandle(handleOrName: string): string {
  const trimmed = handleOrName.trim();
  if (!trimmed) return "?";
  // Display name with multiple words → first letter of first two words.
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
