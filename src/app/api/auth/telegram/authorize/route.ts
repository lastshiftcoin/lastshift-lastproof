/**
 * GET /api/auth/telegram/authorize
 *
 * Initiates Telegram Login Widget OAuth flow.
 * - Stores wallet address in HttpOnly cookie (session guard)
 * - Redirects to Telegram's OAuth page
 * - Requires active lp_session (user must be logged in)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_tg_oauth";
const COOKIE_TTL = 600; // 10 minutes

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.redirect(new URL("/manage", process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app"));
  }

  const botId = process.env.TG_BOT_ID;
  if (!botId) {
    console.error("[telegram/authorize] TG_BOT_ID not set");
    return NextResponse.json({ error: "oauth_not_configured" }, { status: 500 });
  }

  // Store wallet address in cookie so callback can verify session ownership
  const cookiePayload = JSON.stringify({
    walletAddress: session.walletAddress,
  });

  const jar = await cookies();
  jar.set(COOKIE_NAME, cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app";
  // Telegram returns data as a hash fragment (#tgAuthResult=BASE64), which
  // never reaches the server. Point return_to at the client-side handler page
  // that reads the fragment and forwards to the real API callback.
  const returnTo = `${siteUrl}/auth/telegram/callback`;

  const params = new URLSearchParams({
    bot_id: botId,
    origin: siteUrl,
    request_access: "write",
    return_to: returnTo,
  });

  return NextResponse.redirect(
    `https://oauth.telegram.org/auth?${params.toString()}`
  );
}
