/**
 * GET /api/auth/telegram/callback
 *
 * Telegram Login Widget callback.
 * - Validates HMAC hash using bot token (prevents forgery)
 * - Validates auth_date is within 5 minutes (prevents replay)
 * - Checks for duplicate handle across other profiles
 * - Writes telegram_handle + telegram_verified = true
 * - Redirects to /manage/profile?verified=tg
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { resolveProfileFromSession } from "@/lib/auth/resolve-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "lp_tg_oauth";
const DASHBOARD_URL = "/manage/profile";
const MAX_AUTH_AGE_S = 300; // 5 minutes

function dashboardRedirect(query: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lastproof.app";
  return NextResponse.redirect(new URL(`${DASHBOARD_URL}?${query}`, base));
}

/**
 * Verify Telegram Login Widget data per
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramHash(
  params: Record<string, string>,
  botToken: string,
): boolean {
  const hash = params.hash;
  if (!hash) return false;

  // Build data-check-string: all params except hash, sorted, joined with \n
  const dataCheckString = Object.keys(params)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  // secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  // check_hash = HMAC-SHA256(secret_key, data_check_string)
  const checkHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(checkHash, "hex"),
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // Collect all Telegram callback params
  const tgParams: Record<string, string> = {};
  for (const [key, value] of sp.entries()) {
    tgParams[key] = value;
  }

  // Basic presence checks
  if (!tgParams.hash || !tgParams.id || !tgParams.auth_date) {
    return dashboardRedirect("verify_error=tg&reason=missing_params");
  }

  // Read and delete the OAuth guard cookie
  const jar = await cookies();
  const rawCookie = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);

  if (!rawCookie) {
    return dashboardRedirect("verify_error=tg&reason=expired");
  }

  // Verify HMAC hash
  const botToken = process.env.TG_BOT_TOKEN;
  if (!botToken) {
    console.error("[telegram/callback] TG_BOT_TOKEN not set");
    return dashboardRedirect("verify_error=tg&reason=not_configured");
  }

  if (!verifyTelegramHash(tgParams, botToken)) {
    console.error("[telegram/callback] HMAC verification failed");
    return dashboardRedirect("verify_error=tg&reason=hash_mismatch");
  }

  // Check auth_date is within 5 minutes (anti-replay)
  const authDate = parseInt(tgParams.auth_date, 10);
  if (Number.isNaN(authDate) || Math.abs(Date.now() / 1000 - authDate) > MAX_AUTH_AGE_S) {
    return dashboardRedirect("verify_error=tg&reason=expired_auth");
  }

  // Get username from Telegram — some users don't have one
  const username = tgParams.username?.toLowerCase();
  if (!username) {
    return dashboardRedirect("verify_error=tg&reason=no_username");
  }

  // Resolve the current user's profile
  const resolved = await resolveProfileFromSession();
  if (!resolved) {
    return dashboardRedirect("verify_error=tg&reason=no_session");
  }

  const { profile, sb } = resolved;

  // Duplicate guard: check if another profile already has this Telegram handle
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("telegram_handle", username)
    .eq("telegram_verified", true)
    .neq("id", profile.id)
    .maybeSingle();

  if (existing) {
    return dashboardRedirect("verify_error=tg&reason=handle_taken");
  }

  // Write verified handle to profiles table
  const { error: updateErr } = await sb
    .from("profiles")
    .update({ telegram_handle: username, telegram_verified: true })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("[telegram/callback] update error:", updateErr.message);
    return dashboardRedirect("verify_error=tg&reason=db_error");
  }

  return dashboardRedirect("verified=tg");
}
