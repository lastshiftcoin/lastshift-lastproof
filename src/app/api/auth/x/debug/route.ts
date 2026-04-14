/**
 * POST /api/auth/x/debug
 *
 * Diagnostic replay of the X OAuth 2.0 token exchange without any session,
 * cookies, or PKCE state machinery. Lets you paste a fresh auth code +
 * code_verifier and see exactly what X returns, plus a sanity check of
 * the env vars being used.
 *
 * Usage:
 *   1. Generate a code_verifier + code_challenge locally, manually hit
 *      https://x.com/i/oauth2/authorize in a browser with the challenge.
 *   2. X redirects to our callback with ?code=... — copy that code.
 *   3. POST to this endpoint with the code + verifier:
 *        curl -X POST https://lastproof.app/api/auth/x/debug \
 *          -H "Authorization: Bearer $DEBUG_SECRET" \
 *          -H "Content-Type: application/json" \
 *          -d '{"code":"...","code_verifier":"..."}'
 *
 * Returns a full dump of:
 *   - env_check (lengths, whitespace detection, byte-level hex)
 *   - request (URL, method, headers, body — secret redacted)
 *   - response (status, body from X, raw text if not JSON)
 *
 * Gated by DEBUG_SECRET env var. If not set, endpoint is disabled.
 */

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const debugSecret = process.env.DEBUG_SECRET;
  if (!debugSecret) {
    return NextResponse.json(
      { error: "debug_not_configured", hint: "set DEBUG_SECRET on Vercel" },
      { status: 403 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${debugSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { code?: string; code_verifier?: string };
  try {
    body = (await request.json()) as { code?: string; code_verifier?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.code || !body.code_verifier) {
    return NextResponse.json(
      { error: "code_and_verifier_required" },
      { status: 400 },
    );
  }

  const rawClientId = process.env.X_CLIENT_ID;
  const rawClientSecret = process.env.X_CLIENT_SECRET;
  const rawRedirectUri = process.env.X_REDIRECT_URI;

  const clientId = rawClientId?.trim();
  const clientSecret = rawClientSecret?.trim();
  const redirectUri = rawRedirectUri?.trim();

  const envCheck = {
    X_CLIENT_ID_length_raw: rawClientId?.length ?? null,
    X_CLIENT_ID_length_trimmed: clientId?.length ?? null,
    X_CLIENT_ID_whitespace_diff:
      (rawClientId?.length ?? 0) - (clientId?.length ?? 0),
    X_CLIENT_SECRET_length_raw: rawClientSecret?.length ?? null,
    X_CLIENT_SECRET_length_trimmed: clientSecret?.length ?? null,
    X_CLIENT_SECRET_whitespace_diff:
      (rawClientSecret?.length ?? 0) - (clientSecret?.length ?? 0),
    X_REDIRECT_URI_raw: rawRedirectUri,
    X_REDIRECT_URI_trimmed: redirectUri,
    X_REDIRECT_URI_hex: rawRedirectUri
      ? Buffer.from(rawRedirectUri).toString("hex")
      : null,
  };

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "missing_env_vars", env_check: envCheck },
      { status: 500 },
    );
  }

  const url = "https://api.x.com/2/oauth2/token";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const formBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: body.code,
    redirect_uri: redirectUri,
    code_verifier: body.code_verifier,
  });

  const tokenRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: formBody,
  });

  const responseText = await tokenRes.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = null;
  }

  return NextResponse.json({
    env_check: envCheck,
    request: {
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic [${basicAuth.length} chars, redacted]`,
      },
      body: {
        grant_type: "authorization_code",
        code: body.code,
        redirect_uri: redirectUri,
        code_verifier: body.code_verifier,
      },
    },
    response: {
      status: tokenRes.status,
      statusText: tokenRes.statusText,
      body: parsed ?? { raw: responseText },
    },
  });
}
