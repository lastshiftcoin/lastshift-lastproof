/**
 * POST /api/auth/telegram/callback
 *
 * Receives Telegram Login Widget auth data (JSON body from frontend).
 * The Login Widget runs on the page itself — no redirect flow, no domain
 * matching on return URLs. The widget calls `window.onTelegramAuth(user)`
 * with signed user data; the frontend POSTs that data here.
 *
 * Security:
 *   - HMAC-SHA256 verification: bot token → SHA256 → HMAC key
 *   - auth_date within 5 minutes (anti-replay)
 *   - Session required (readSession cookie)
 *   - Duplicate handle guard across profiles
 *   - Only Telegram-origin fields enter the HMAC — extra fields stripped
 */

import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { resolveProfileFromSession } from "@/lib/auth/resolve-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUTH_AGE_S = 300; // 5 minutes

/** Fields Telegram actually sends in the Login Widget callback. */
const TELEGRAM_FIELDS = new Set([
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
  "hash",
]);

/**
 * Verify Telegram Login Widget data per
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * CRITICAL: only Telegram-origin fields go into the check string.
 * Any extra fields the frontend added (e.g. a custom field) are
 * stripped before building the HMAC. This is the #1 cause of
 * "all users fail verification" — see telegram-auth-bot-implementation.md.
 */
function verifyTelegramHash(
  raw: Record<string, unknown>,
  botToken: string,
): boolean {
  const hash = raw.hash;
  if (typeof hash !== "string" || !hash) return false;

  // Build data-check-string from ONLY Telegram fields (minus hash)
  const dataCheckString = Object.keys(raw)
    .filter((k) => k !== "hash" && TELEGRAM_FIELDS.has(k))
    .sort()
    .map((k) => `${k}=${raw[k]}`)
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

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // Basic presence checks
  if (!body.hash || !body.id || !body.auth_date) {
    return NextResponse.json(
      { ok: false, error: "missing_params" },
      { status: 400 },
    );
  }

  // Verify HMAC hash
  const botToken = (process.env.TG_BOT_TOKEN ?? "").trim();
  if (!botToken) {
    console.error("[telegram/callback] TG_BOT_TOKEN not set");
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 500 },
    );
  }

  if (!verifyTelegramHash(body, botToken)) {
    console.error("[telegram/callback] HMAC verification failed");
    return NextResponse.json(
      { ok: false, error: "hash_mismatch" },
      { status: 401 },
    );
  }

  // Check auth_date is within 5 minutes (anti-replay)
  const authDate = Number(body.auth_date);
  if (
    Number.isNaN(authDate) ||
    Math.abs(Date.now() / 1000 - authDate) > MAX_AUTH_AGE_S
  ) {
    return NextResponse.json(
      { ok: false, error: "expired_auth" },
      { status: 401 },
    );
  }

  // Get username from Telegram — some users don't have one
  const username =
    typeof body.username === "string"
      ? body.username.toLowerCase().trim()
      : null;
  if (!username) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_username",
        message:
          "Your Telegram account has no username. Set one in Telegram Settings first.",
      },
      { status: 400 },
    );
  }

  // Resolve the current user's profile from session cookie
  const resolved = await resolveProfileFromSession();
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "no_session" },
      { status: 401 },
    );
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
    return NextResponse.json(
      { ok: false, error: "handle_taken" },
      { status: 409 },
    );
  }

  // Write verified handle to profiles table
  const { error: updateErr } = await sb
    .from("profiles")
    .update({ telegram_handle: username, telegram_verified: true })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("[telegram/callback] update error:", updateErr.message);
    return NextResponse.json(
      { ok: false, error: "db_error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, handle: username });
}
