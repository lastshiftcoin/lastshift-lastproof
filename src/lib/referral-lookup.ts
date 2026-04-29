/**
 * Referral handle parsing + ambassador-handle lookup.
 *
 * As of 2026-04-28, ambassador attribution moved from cookie/URL to an
 * explicit "Referred by an operator?" field on the onboarding modal.
 * The user pastes a link, @handle, or bare handle. This module:
 *
 *   1. Normalizes the input → a bare handle string (lowercase a-z0-9_)
 *   2. Maps an ambassador profile handle → campaign_slug, when applicable
 *
 * `AMBASSADOR_PROFILE_HANDLES` MUST stay in sync with:
 *   - the `ambassadors` table rows in Supabase (`is_active = true`)
 *   - the actual profile handles those ambassadors own
 *
 * Adding a new ambassador: append to this map, insert ambassadors row,
 * and (eventually) verify the profile.handle resolves at /@handle.
 */

export const AMBASSADOR_PROFILE_HANDLES: Record<string, string> = {
  investor_zerix: "early-access-free",
  goldnodesupreme: "limited-free-upgrade",
  monochizzy: "first-5000-free",
  habilamar_ibn: "free-before-grid",
  joe_babs: "claim-before-launch",
  theleader: "free-early-access",
  mason5: "free-profile-5k-claim",
};

/**
 * Parse a referral input into a bare handle, or null if uninterpretable.
 *
 * Accepts (case-insensitive):
 *   - habilamar_ibn
 *   - @habilamar_ibn
 *   - lastproof.app/@habilamar_ibn
 *   - https://lastproof.app/@habilamar_ibn
 *   - https://lastproof.app/@habilamar_ibn?utm=...
 *   - http://www.lastproof.app/@habilamar_ibn/
 *
 * Rejects anything that doesn't reduce to a valid handle (a-z0-9_, 3–20 chars).
 */
export function parseReferralHandle(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;

  // Strip protocol
  s = s.replace(/^https?:\/\//, "");
  // Strip leading www.
  s = s.replace(/^www\./, "");
  // Strip lastproof.app/ host prefix (or any host before /@)
  const atIdx = s.indexOf("/@");
  if (atIdx >= 0) {
    s = s.slice(atIdx + 2);
  } else if (s.startsWith("@")) {
    s = s.slice(1);
  } else {
    // Maybe a bare URL like lastproof.app/<handle> — strip host
    const slash = s.indexOf("/");
    if (slash >= 0 && s.slice(0, slash).includes(".")) {
      s = s.slice(slash + 1);
    }
  }

  // Trim path/query: take only the first path segment
  s = s.split(/[/?#]/)[0];

  if (!/^[a-z0-9_]{3,20}$/.test(s)) return null;
  return s;
}

/**
 * If `handle` is an ambassador profile handle, return the campaign_slug
 * that should be stamped on profiles.referred_by. Otherwise null.
 */
export function ambassadorSlugForHandle(handle: string): string | null {
  return AMBASSADOR_PROFILE_HANDLES[handle] ?? null;
}
