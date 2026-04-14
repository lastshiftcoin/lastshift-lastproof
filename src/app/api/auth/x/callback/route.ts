/**
 * GET /api/auth/x/callback
 *
 * Twitter/X OAuth 2.0 callback.
 * - Validates state against cookie (CSRF protection)
 * - Exchanges authorization code for access token (PKCE)
 * - Fetches the real username from Twitter API
 * - Checks for duplicate handle across other profiles
 * - Writes x_handle + x_verified = true to profiles table
 * - Redirects to /manage/profile?verified=x
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { resolveProfileFromSession } from "@/lib/auth/resolve-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_x_oauth";
const DASHBOARD_URL = "/manage/profile";

function dashboardRedirect(query: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app";
  return NextResponse.redirect(new URL(`${DASHBOARD_URL}?${query}`, base));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  // User denied or Twitter errored
  if (error || !code || !state) {
    return dashboardRedirect("verify_error=x&reason=denied");
  }

  // Read and delete the OAuth state cookie
  const jar = await cookies();
  const rawCookie = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);

  if (!rawCookie) {
    return dashboardRedirect("verify_error=x&reason=expired");
  }

  let cookieData: { state: string; codeVerifier: string; walletAddress: string };
  try {
    cookieData = JSON.parse(rawCookie);
  } catch {
    return dashboardRedirect("verify_error=x&reason=corrupt");
  }

  // Validate state (CSRF protection)
  if (cookieData.state !== state) {
    return dashboardRedirect("verify_error=x&reason=state_mismatch");
  }

  // Exchange authorization code for access token
  const clientId = process.env.X_CLIENT_ID!.trim();
  const clientSecret = process.env.X_CLIENT_SECRET!.trim();
  const redirectUri = process.env.X_REDIRECT_URI!.trim();

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: cookieData.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[x/callback] token exchange failed:", tokenRes.status, text);
    return dashboardRedirect("verify_error=x&reason=token_exchange");
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Fetch the real username from Twitter
  const userRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    console.error("[x/callback] user fetch failed:", userRes.status);
    return dashboardRedirect("verify_error=x&reason=user_fetch");
  }

  const userData = (await userRes.json()) as { data: { id: string; username: string; name: string } };
  const username = userData.data.username.toLowerCase();

  // Resolve the current user's profile
  const resolved = await resolveProfileFromSession();
  if (!resolved) {
    return dashboardRedirect("verify_error=x&reason=no_session");
  }

  const { profile, sb } = resolved;

  // Duplicate guard: check if another profile already has this X handle
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("x_handle", username)
    .eq("x_verified", true)
    .neq("id", profile.id)
    .maybeSingle();

  if (existing) {
    return dashboardRedirect("verify_error=x&reason=handle_taken");
  }

  // Write verified handle to profiles table
  const { error: updateErr } = await sb
    .from("profiles")
    .update({ x_handle: username, x_verified: true })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("[x/callback] update error:", updateErr.message);
    return dashboardRedirect("verify_error=x&reason=db_error");
  }

  return dashboardRedirect("verified=x");
}
