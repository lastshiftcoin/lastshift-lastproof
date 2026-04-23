/**
 * URL normalization helpers — used by the public-profile projector and
 * anywhere else we touch operator-submitted URLs.
 *
 * Operators paste URLs in whatever shape feels natural to them:
 *   "lastshift.ai"
 *   "www.lastshift.ai"
 *   "https://lastshift.ai"
 *   "https://www.lastshift.ai/"
 *   "  https://Lastshift.ai  " (leading/trailing whitespace, mixed case)
 *
 * We standardize once at the projector so every consumer downstream
 * (ProfileHero render, JSON-LD sameAs, sitemap, etc.) can trust that
 * the stored value is a canonical absolute URL. Display code uses
 * `prettyWebsiteLabel()` to show the human-friendly form.
 *
 * Before this helper existed, `ProfileHero.tsx` was doing
 * `href={`https://${website}`}` unconditionally, which produced
 * `https://https://lastshift.ai` when the operator had pasted the
 * protocol themselves. Bug was caught 2026-04-21 while verifying
 * the new per-profile JSON-LD emission.
 */

/**
 * Returns a canonical `https://...` URL, or null if the input is
 * empty / unusable. Strips any existing `http://` or `https://`
 * (case-insensitive) before re-adding `https://` so we can't
 * double-stack protocols.
 */
export function normalizeWebsiteUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed.replace(/^https?:\/\//i, "");
  if (!stripped) return null;

  return `https://${stripped}`;
}

/**
 * Returns a human-friendly label from a canonical URL (or null if
 * empty). Strips the protocol, leading `www.`, and any trailing
 * slash so the chip shows `lastshift.ai` instead of
 * `https://www.lastshift.ai/`.
 */
export function prettyWebsiteLabel(
  canonicalUrl: string | null | undefined,
): string {
  if (!canonicalUrl) return "";
  return canonicalUrl
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
