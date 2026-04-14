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
import { cookies, headers } from "next/headers";
import { resolveProfileFromSession } from "@/lib/auth/resolve-profile";
import { logXAuthEvent, newXAuthSessionId } from "@/lib/x-auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_x_oauth";
const DASHBOARD_URL = "/manage/profile";

function dashboardRedirect(query: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app";
  return NextResponse.redirect(new URL(`${DASHBOARD_URL}?${query}`, base));
}

export async function GET(request: NextRequest) {
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  // Read and delete the OAuth state cookie (may not exist if expired/dropped)
  const jar = await cookies();
  const rawCookie = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);

  // Try to pull the correlation ID from the cookie so authorize_start and
  // callback rows share a session_id. Fallback to a fresh one if cookie is
  // missing/corrupt — the row is still useful, just orphaned.
  let debugSessionId = newXAuthSessionId();
  let cookieData: {
    state: string;
    codeVerifier: string;
    walletAddress: string;
    debugSessionId?: string;
  } | null = null;
  if (rawCookie) {
    try {
      cookieData = JSON.parse(rawCookie);
      if (cookieData?.debugSessionId) debugSessionId = cookieData.debugSessionId;
    } catch {
      cookieData = null;
    }
  }

  // Log entry immediately so we know the callback ran at all.
  void logXAuthEvent({
    event: "callback_entry",
    sessionId: debugSessionId,
    userAgent,
    walletAddress: cookieData?.walletAddress ?? null,
    payload: {
      has_code: !!code,
      has_state: !!state,
      x_error_param: error,
      cookie_present: !!rawCookie,
      cookie_parseable: !!cookieData,
    },
  });

  // User denied or Twitter errored
  if (error || !code || !state) {
    void logXAuthEvent({
      event: "callback_missing_code",
      sessionId: debugSessionId,
      userAgent,
      payload: { x_error_param: error, has_code: !!code, has_state: !!state },
    });
    return dashboardRedirect("verify_error=x&reason=denied");
  }

  if (!rawCookie) {
    void logXAuthEvent({
      event: "callback_no_cookie",
      sessionId: debugSessionId,
      userAgent,
    });
    return dashboardRedirect("verify_error=x&reason=expired");
  }

  if (!cookieData) {
    void logXAuthEvent({
      event: "callback_corrupt_cookie",
      sessionId: debugSessionId,
      userAgent,
    });
    return dashboardRedirect("verify_error=x&reason=corrupt");
  }

  // Validate state (CSRF protection)
  if (cookieData.state !== state) {
    void logXAuthEvent({
      event: "callback_state_mismatch",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
    });
    return dashboardRedirect("verify_error=x&reason=state_mismatch");
  }

  // Exchange authorization code for access token
  const clientId = process.env.X_CLIENT_ID!.trim();
  const clientSecret = process.env.X_CLIENT_SECRET!.trim();
  const redirectUri = process.env.X_REDIRECT_URI!.trim();

  const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
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
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON response
    }
    console.error("[x/callback] token exchange failed", {
      http_status: tokenRes.status,
      x_error: parsed.error ?? null,
      x_error_description: parsed.error_description ?? null,
      raw_body: text.substring(0, 500),
      redirect_uri_sent: redirectUri,
      redirect_uri_length: redirectUri.length,
      client_id_length: clientId.length,
      client_secret_length: clientSecret.length,
    });
    void logXAuthEvent({
      event: "token_exchange_failed",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
      payload: {
        http_status: tokenRes.status,
        x_error: parsed.error ?? null,
        x_error_description: parsed.error_description ?? null,
        raw_body: text.substring(0, 500),
        redirect_uri_sent: redirectUri,
        redirect_uri_length: redirectUri.length,
        client_id_length: clientId.length,
        client_secret_length: clientSecret.length,
      },
    });
    const reason = parsed.error
      ? `token_exchange_${parsed.error}`
      : "token_exchange";
    return dashboardRedirect(`verify_error=x&reason=${encodeURIComponent(reason)}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  void logXAuthEvent({
    event: "token_exchange_ok",
    sessionId: debugSessionId,
    userAgent,
    walletAddress: cookieData.walletAddress,
  });

  // Fetch the real username from Twitter
  const userRes = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    const userErrText = await userRes.text().catch(() => "");
    console.error("[x/callback] user fetch failed", {
      http_status: userRes.status,
      raw_body: userErrText.substring(0, 500),
    });
    void logXAuthEvent({
      event: "user_fetch_failed",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
      payload: {
        http_status: userRes.status,
        raw_body: userErrText.substring(0, 500),
      },
    });
    return dashboardRedirect("verify_error=x&reason=user_fetch");
  }

  const userData = (await userRes.json()) as { data: { id: string; username: string; name: string } };
  const username = userData.data.username.toLowerCase();

  // Resolve the current user's profile
  const resolved = await resolveProfileFromSession();
  if (!resolved) {
    void logXAuthEvent({
      event: "no_session",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
      payload: { username },
    });
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
    void logXAuthEvent({
      event: "handle_taken",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
      payload: { username, taken_by_profile_id: existing.id },
    });
    return dashboardRedirect("verify_error=x&reason=handle_taken");
  }

  // Write verified handle to profiles table
  const { error: updateErr } = await sb
    .from("profiles")
    .update({ x_handle: username, x_verified: true })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("[x/callback] update error:", updateErr.message);
    void logXAuthEvent({
      event: "db_update_failed",
      sessionId: debugSessionId,
      userAgent,
      walletAddress: cookieData.walletAddress,
      payload: { username, db_error: updateErr.message },
    });
    return dashboardRedirect("verify_error=x&reason=db_error");
  }

  void logXAuthEvent({
    event: "success",
    sessionId: debugSessionId,
    userAgent,
    walletAddress: cookieData.walletAddress,
    payload: { username },
  });

  return dashboardRedirect("verified=x");
}
