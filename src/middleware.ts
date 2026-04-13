import { NextResponse, type NextRequest } from "next/server";

/**
 * Maintenance gate.
 *
 * NEXT_PUBLIC_MAINTENANCE_MODE=true → all public pages show maintenance.html.
 * APIs, webhooks, crons, and static assets always pass through.
 *
 * Uses NEXT_PUBLIC_ prefix so it's inlined at build time — guaranteed
 * available in middleware (regular env vars are NOT available at the edge).
 *
 * Bypass: NEXT_PUBLIC_MAINTENANCE_BYPASS env var as a cookie.
 * Visit any page with ?bypass={key} to set the cookie for 24h.
 *
 * To enable:  set NEXT_PUBLIC_MAINTENANCE_MODE=true in Vercel → redeploy
 * To disable: set to false or delete → redeploy
 */

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;

  // Always pass through
  if (
    pathname === "/maintenance.html" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/tokens/") ||
    pathname.startsWith("/avatars/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Bypass
  const bypassKey = process.env.NEXT_PUBLIC_MAINTENANCE_BYPASS;
  if (bypassKey) {
    if (searchParams.get("bypass") === bypassKey) {
      const response = NextResponse.next();
      response.cookies.set("maintenance_bypass", bypassKey, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return response;
    }
    if (request.cookies.get("maintenance_bypass")?.value === bypassKey) {
      return NextResponse.next();
    }
  }

  // Serve static maintenance page
  return NextResponse.rewrite(new URL("/maintenance.html", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
