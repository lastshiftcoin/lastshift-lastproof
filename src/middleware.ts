import { NextResponse, type NextRequest } from "next/server";

/**
 * Maintenance gate middleware.
 *
 * When MAINTENANCE_MODE=true (Vercel env var), all requests show
 * the maintenance page EXCEPT:
 *   - /maintenance (the page itself)
 *   - /_next/* (static assets, JS bundles)
 *   - /api/* (webhooks, crons must keep running)
 *   - favicon.ico, robots.txt, sitemap.xml
 *   - Requests with ?bypass={MAINTENANCE_BYPASS_KEY} cookie set
 *
 * Bypass: visit any page with ?bypass={key} once → sets a cookie →
 * all subsequent requests pass through. Key is MAINTENANCE_BYPASS_KEY
 * env var (defaults to "lastshift-god-mode" if not set).
 */

export function middleware(request: NextRequest) {
  const maintenance = process.env.MAINTENANCE_MODE === "true";
  if (!maintenance) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;

  // Always allow these paths
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/tokens/") ||
    pathname.startsWith("/avatars/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // Bypass via URL param — sets cookie for future requests.
  // MAINTENANCE_BYPASS_KEY must be set in Vercel env vars. No default — if
  // not set, bypass is completely disabled and no one can get through.
  const bypassKey = process.env.MAINTENANCE_BYPASS_KEY;
  if (bypassKey && searchParams.get("bypass") === bypassKey) {
    const response = NextResponse.next();
    response.cookies.set("maintenance_bypass", bypassKey, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
    return response;
  }

  // Bypass via cookie (already authenticated)
  if (bypassKey && request.cookies.get("maintenance_bypass")?.value === bypassKey) {
    return NextResponse.next();
  }

  // Redirect to maintenance page
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image).*)",
  ],
};
