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
import type { NextRequest, NextFetchEvent } from "next/server";
import { logReferralEvent } from "@/lib/referral-events";

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

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const existingRefInUrl = request.nextUrl.searchParams.get("ref");

  // ─── /manage: reflect lp_ref cookie into the URL ───────────────────────
  //
  // If the user arrived on /manage already carrying an ambassador cookie
  // from a prior ambassador-surface visit (e.g. /@habilamar_ibn earlier
  // in this session), redirect to /manage?ref=<cookie-value> so the
  // address bar shows the attribution.
  //
  // Critical for the in-app-browser → external-browser flow: users get
  // stuck on /manage because wallet-connect is blocked in-app, then copy
  // the URL from the address bar to paste in Chrome/Safari. Without this
  // reflection, the copied URL is just `/manage` with no ambassador
  // context — attribution evaporates at the browser-jar boundary.
  //
  // Runs regardless of UA — we don't need to detect in-app browsers
  // because cookie existence is a deterministic server-side check.
  //
  // Idempotent: if URL already has `?ref=`, skip. If no cookie, skip.
  if (pathname === "/manage") {
    if (existingRefInUrl) {
      return NextResponse.next();
    }
    const cookieRef = request.cookies.get(COOKIE_NAME)?.value;
    if (!cookieRef) {
      return NextResponse.next();
    }

    const redirectUrl = new URL(request.nextUrl);
    redirectUrl.searchParams.set("ref", cookieRef);

    event.waitUntil(
      logReferralEvent({
        type: "proxy_touch",
        campaignSlug: cookieRef,
        source: "cookie",
        outcome: "already_stamped",
        metadata: {
          surface: "manage_reflection",
          path: pathname,
          user_agent: request.headers.get("user-agent") ?? null,
          referer: request.headers.get("referer") ?? null,
        },
      }),
    );

    return NextResponse.redirect(redirectUrl, 307);
  }

  // ─── Ambassador surfaces: campaign slug or profile handle ───────────
  const slug = resolveSlugForPath(pathname);

  // Safety fall-through — matcher config limits which paths reach us,
  // but if it broadens and a non-attribution path slips in, do nothing.
  if (!slug) {
    return NextResponse.next();
  }

  // ─── URL reflection: 307-redirect to the canonical `?ref=<slug>` form ──
  //
  // When a user lands on an ambassador surface without the ref in the URL,
  // we redirect to the same path with `?ref=<slug>` appended. The browser
  // follows, and now the address bar shows the attributed URL for the
  // rest of the user's session.
  //
  // This is the critical cross-browser bridge. When a user is stuck in
  // an in-app browser (Telegram, X, Discord — where wallet-connect is
  // blocked) and decides to copy the URL from the address bar to paste
  // into Chrome/Safari, that copy now includes the ambassador ref. The
  // cookie doesn't cross cookie jars, but the URL does.
  //
  // Runs regardless of UA detection — no dependency on recognizing the
  // in-app browser. Cookie existence is a deterministic server check.
  //
  // Idempotent: second pass (with `?ref=` already in URL) short-circuits
  // this branch and proceeds to cookie + observability.
  //
  // If the URL already has a `?ref=` (any value — possibly user-typed or
  // from a prior share that propagated), we respect it. The URL param is
  // the explicit attribution signal; don't overwrite. register_tid will
  // validate the slug against the ambassadors table and reject invalid.
  if (!existingRefInUrl) {
    const redirectUrl = new URL(request.nextUrl);
    redirectUrl.searchParams.set("ref", slug);
    return NextResponse.redirect(redirectUrl, 307);
  }

  // ─── Past the redirect: URL now has `?ref=`. Continue normally. ───────

  const response = NextResponse.next();

  // First-touch wins. If the user already has `lp_ref` from any prior
  // surface (campaign or profile), we don't overwrite.
  const existingCookie = request.cookies.get(COOKIE_NAME)?.value;
  const didSet = !existingCookie;

  if (didSet) {
    response.cookies.set(COOKIE_NAME, slug, {
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // ─── Observability ────────────────────────────────────────────────────
  const surface: "campaign_page" | "profile_page" = pathname.startsWith("/@")
    ? "profile_page"
    : "campaign_page";

  event.waitUntil(
    logReferralEvent({
      type: "proxy_touch",
      campaignSlug: slug,
      source: existingCookie ? "cookie" : "url",
      outcome: didSet ? "stamped" : "already_stamped",
      metadata: {
        surface,
        path: pathname,
        url_ref: existingRefInUrl,
        url_ref_matches_slug: existingRefInUrl === slug,
        already_had_cookie: !!existingCookie,
        existing_cookie_value: existingCookie ?? null,
        user_agent: request.headers.get("user-agent") ?? null,
        referer: request.headers.get("referer") ?? null,
        accept_language: request.headers.get("accept-language") ?? null,
      },
    }),
  );

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

    // /manage — cookie→URL reflection for cross-browser survival
    "/manage",
  ],
};
