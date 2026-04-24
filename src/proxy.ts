/**
 * Ambassador referral attribution — cookie-based first-touch capture.
 *
 * (Next.js 16 renamed `middleware.ts` → `proxy.ts`; function name is
 * `proxy`. Defaults to Node.js runtime. `NextResponse.cookies.set()`
 * semantics unchanged from the middleware era.)
 *
 * Two attribution surfaces run through this proxy:
 *
 *   1. Campaign landing pages — `/free-before-grid`, `/early-access-free`,
 *      etc. (the 6 canonical ambassador campaign slugs). Primary
 *      attribution path; ambassadors are supposed to share these URLs.
 *
 *   2. Ambassador profile pages — `/@habilamar_ibn`, `/@investor_zerix`,
 *      etc. Fallback path that catches the real-world pattern of
 *      ambassadors sharing their profile URL directly in DMs instead
 *      of the campaign slug. Added 2026-04-24 after @yuan came in
 *      through `/@habilamar_ibn` with zero attribution signal — the
 *      original proxy only matched campaign slugs, so profile-link
 *      shares silently dropped.
 *
 * Both surfaces set the same HttpOnly `lp_ref` cookie (30-day TTL)
 * that survives ANY subsequent path the user takes on lastproof.app —
 * direct `/manage` visits, tab close, mobile wallet deep-link returns
 * that strip query params.
 *
 * Attribution chain composition:
 *   1. URL ?ref=<slug>          — still highest priority
 *   2. localStorage lp_ref_slug — client-side fallback
 *   3. lp_ref cookie (THIS)     — server-side fallback, survives tab close
 *
 * First-touch wins: if `lp_ref` is already set, we don't overwrite
 * from either surface. A later ambassador (or a self-view by the
 * ambassador themselves) doesn't steal credit from the first one.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Active ambassador campaign slugs. Must match
 * `ambassadors.campaign_slug` values where `is_active = true`.
 */
const AMBASSADOR_SLUGS = [
  "early-access-free",
  "limited-free-upgrade",
  "first-5000-free",
  "free-before-grid",
  "claim-before-launch",
  "free-early-access",
];

/**
 * Maps ambassador profile handle → the ambassador's campaign slug.
 * When a visitor hits `/@<handle>` for a handle in this map, we stamp
 * the cookie with the mapped slug (as if they'd visited the campaign
 * URL). The profile page itself renders normally.
 *
 * Must be kept in sync with (a) `AMBASSADOR_SLUGS` above and (b) the
 * actual profile handles in Supabase. Handles verified via HTTP 200
 * against lastproof.app/@<handle> at the time this was added.
 *
 * If we add or rotate an ambassador, update THREE places atomically:
 *   1. ambassadors table row in Supabase
 *   2. AMBASSADOR_SLUGS above
 *   3. AMBASSADOR_PROFILE_HANDLES here
 *   4. matcher config at the bottom (add the new slug AND the new @handle)
 */
const AMBASSADOR_PROFILE_HANDLES: Record<string, string> = {
  investor_zerix: "early-access-free",
  goldnodesupreme: "limited-free-upgrade",
  monochizzy: "first-5000-free",
  habilamar_ibn: "free-before-grid",
  joe_babs: "claim-before-launch",
  theleader: "free-early-access",
};

const COOKIE_NAME = "lp_ref";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Resolve the campaign slug to attribute for a given incoming pathname,
 * or null if the path doesn't match an attribution surface.
 *
 * Accepts either `/<campaign-slug>` (campaign page) or `/@<handle>`
 * (ambassador profile page). Next.js rewrites `/@handle` internally
 * to `/profile/handle` (see `next.config.ts`); proxy sees the request
 * BEFORE the rewrite, so we match against the public-facing `/@handle`
 * shape here.
 */
function resolveSlugForPath(pathname: string): string | null {
  // Campaign slug: `/early-access-free`, etc.
  const campaignSlug = pathname.slice(1); // strip leading /
  if (AMBASSADOR_SLUGS.includes(campaignSlug)) {
    return campaignSlug;
  }

  // Ambassador profile: `/@habilamar_ibn`, etc.
  if (pathname.startsWith("/@")) {
    const handle = pathname.slice(2); // strip `/@`
    const slug = AMBASSADOR_PROFILE_HANDLES[handle];
    if (slug) return slug;
  }

  return null;
}

export function proxy(request: NextRequest) {
  const slug = resolveSlugForPath(request.nextUrl.pathname);

  // Safety fall-through — matcher config limits which paths reach us,
  // but if it broadens and a non-attribution path slips in, do nothing.
  if (!slug) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // First-touch wins. If the user already has `lp_ref` from any prior
  // surface (campaign or profile), we don't overwrite.
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing) {
    return response;
  }

  response.cookies.set(COOKIE_NAME, slug, {
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: [
    // Campaign landing pages
    "/early-access-free",
    "/limited-free-upgrade",
    "/first-5000-free",
    "/free-before-grid",
    "/claim-before-launch",
    "/free-early-access",

    // Ambassador profile pages (the `/@handle` public URL shape, pre-rewrite)
    "/@investor_zerix",
    "/@goldnodesupreme",
    "/@monochizzy",
    "/@habilamar_ibn",
    "/@joe_babs",
    "/@theleader",
  ],
};
