/**
 * GET /api/auth/x/authorize
 *
 * Initiates Twitter/X OAuth 2.0 with PKCE.
 * - Generates state + code_verifier, stores in HttpOnly cookie
 * - Redirects to Twitter's authorization endpoint
 * - Requires active lp_session (user must be logged in)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_x_oauth";
const COOKIE_TTL = 600; // 10 minutes

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.redirect(new URL("/manage", process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app"));
  }

  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    console.error("[x/authorize] X_CLIENT_ID or X_REDIRECT_URI not set");
    return NextResponse.json({ error: "oauth_not_configured" }, { status: 500 });
  }

  // Generate PKCE values
  const state = crypto.randomBytes(32).toString("hex");
  const codeVerifier = crypto.randomBytes(48).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store state + verifier in short-lived HttpOnly cookie
  const cookiePayload = JSON.stringify({
    state,
    codeVerifier,
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

  // Build Twitter OAuth URL
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  );
}
