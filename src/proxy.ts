/**
 * Ambassador referral attribution — cookie-based first-touch capture.
 *
 * (Next.js 16 renamed `middleware.ts` → `proxy.ts`; function name is
 * `proxy`. Defaults to Node.js runtime. `NextResponse.cookies.set()`
 * semantics unchanged from the middleware era.)
 *
 * When a user visits an ambassador campaign landing page
 * (e.g. /free-early-access), this proxy stashes the slug in an
 * HttpOnly cookie (`lp_ref`) that survives ANY subsequent path the user
 * takes on lastproof.app — including direct navigations to /manage,
 * closing and reopening the tab, and mobile wallet deep-link returns
 * that strip query params.
 *
 * Before this existed, attribution was lost whenever a user visited a
 * campaign landing page and then navigated to /manage without clicking
 * the page's CTA (which carries `?ref=<slug>`). That edge case bit
 * @TheLeadOps referral @namesake01 on 2026-04-22 — user visited
 * /free-early-access four times, landed on /manage with no ?ref=,
 * attribution was lost. See WORKLOG 2026-04-22 entry for the full trail.
 *
 * How the fix composes with the existing attribution chain:
 *   1. URL ?ref=<slug>          — unchanged, still takes priority
 *   2. localStorage lp_ref_slug — unchanged, client-side fallback
 *   3. lp_ref cookie (THIS)     — server-side fallback, survives tab close
 *
 * First-touch wins: if `lp_ref` is already set, we don't overwrite it —
 * a later ambassador's link doesn't steal credit from the first one.
 *
 * We only run this proxy on the exact set of ambassador campaign
 * paths (see `matcher` config below). No runtime cost on any other
 * request. Adding a new ambassador requires adding the slug both here
 * and to the ambassadors table.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The set of active ambassador campaign slugs. Must match
 * `ambassadors.campaign_slug` values where `is_active = true`. Keep
 * in sync with that table.
 */
const AMBASSADOR_SLUGS = [
  "early-access-free",
  "limited-free-upgrade",
  "first-5000-free",
  "free-before-grid",
  "claim-before-launch",
  "free-early-access",
];

const COOKIE_NAME = "lp_ref";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.slice(1); // strip leading /

  // Safety check — the matcher config limits which paths reach us,
  // but belt-and-suspenders in case the matcher ever broadens.
  if (!AMBASSADOR_SLUGS.includes(slug)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // First-touch wins. If the user already has a `lp_ref` from a prior
  // campaign visit, don't overwrite. They get credited to the first
  // ambassador they encountered.
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
    "/early-access-free",
    "/limited-free-upgrade",
    "/first-5000-free",
    "/free-before-grid",
    "/claim-before-launch",
    "/free-early-access",
  ],
};
