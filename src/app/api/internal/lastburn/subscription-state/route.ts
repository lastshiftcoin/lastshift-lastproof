/**
 * GET /api/internal/lastburn/subscription-state
 *
 * LASTBURN ↔ LASTPROOF subscription-state probe. Returns whether a
 * wallet qualifies for the LASTBURN +1 free-entry bonus.
 *
 * ─── Contract (locked 2026-05-18, per LASTBURN architect spec §8.1) ─
 *
 *   GET /api/internal/lastburn/subscription-state?wallet=<base58>
 *   Authorization: Bearer ${LASTPROOF_LASTBURN_S2S_SECRET}
 *
 * Responses:
 *   200: {
 *     state: "active_paid" | "first_5000_ea" | "free",
 *     wallet: "<echo of request param>",
 *     checked_at: "<ISO8601 server clock>"
 *   }
 *   Headers: Cache-Control: private, no-cache, no-store, must-revalidate
 *
 *   400: { error: "invalid_wallet" }    // bad/missing wallet param
 *   401: { error: "unauthorized" }      // missing/wrong bearer
 *   429: { error: "rate_limited" }      // > 600 req/min on the shared bearer
 *
 * Notes:
 *   - 404 is intentionally NEVER returned. Unknown wallets map to
 *     state: "free" so LASTBURN can treat unknown == ineligible without
 *     special-case error handling.
 *   - Rate limit is per-bearer (effectively global since there's one
 *     consumer). If we add another consumer later, switch the key to
 *     `sha256(bearer).slice(0, 16)` for per-edge limits.
 *   - Caller (LASTBURN) calls once per session at login and caches
 *     for 12h in their lb_session cookie payload. Expected steady-
 *     state load: ~10 req/min at launch.
 *
 * ─── State derivation precedence (mirrors LASTBURN spec §8.1) ─────────
 *
 *   1. wallet not in operators                    → "free"
 *   2. operator exists but no profile             → "free"
 *   3. profile.is_early_adopter = true            → "first_5000_ea"
 *      (EA always also has is_paid=true + published_at set; checking
 *       the EA flag alone is sufficient and survives any future
 *       definition drift on the active_paid branch)
 *   4. is_paid = true AND published_at IS NOT NULL → "active_paid"
 *   5. anything else                              → "free"
 *
 * "defunct" is not a separate state on the wire — collapses to "free"
 * per spec (the 90-day-inactivity rule exists in wireframes/copy only,
 * not yet enforced by any cron).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseService } from "@/lib/db/client";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-bearer rate limit. Spec ceiling is 600/min (60x stated steady-state
// of ~10/min). Key is a fixed string today since there's a single bearer.
const rateLimiter = createRateLimiter({ window: 60_000, max: 600 });

/** Solana base58 pubkey, 32–44 chars, no 0/O/I/l (excluded from base58 alphabet). */
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type WireState = "active_paid" | "first_5000_ea" | "free";

interface SuccessPayload {
  state: WireState;
  wallet: string;
  checked_at: string;
}

/** No-cache headers on every response — content is per-wallet, edge caching is wrong. */
const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

/**
 * Constant-time bearer compare. Falls through to `false` if the env var
 * is unset (prevents accidental dev allow-all). Returns false on any
 * parse error so malformed inputs never short-circuit to allow.
 */
function bearerOk(req: NextRequest): boolean {
  const expected = process.env.LASTPROOF_LASTBURN_S2S_SECRET;
  if (!expected) return false;

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;

  const presented = auth.slice(7);
  // Length mismatch → constant-time compare would throw. Bail early.
  if (presented.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(presented),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  // ─── 1. Auth ───────────────────────────────────────────────────────
  if (!bearerOk(req)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  // ─── 2. Wallet param validation ────────────────────────────────────
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";
  if (!SOLANA_BASE58_RE.test(wallet)) {
    return NextResponse.json(
      { error: "invalid_wallet" },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // ─── 3. Rate limit (per-bearer, single key today) ──────────────────
  const rl = rateLimiter.check("lastburn");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: NO_CACHE_HEADERS },
    );
  }

  // ─── 4. DB lookup → state derivation ───────────────────────────────
  let state: WireState = "free";

  try {
    const sb = supabaseService();

    // (a) operators row by wallet
    const { data: operator } = await sb
      .from("operators")
      .select("id")
      .eq("terminal_wallet", wallet)
      .maybeSingle();

    if (operator) {
      // (b) profile row by operator_id
      const { data: profile } = await sb
        .from("profiles")
        .select("is_paid, is_early_adopter, published_at")
        .eq("operator_id", operator.id)
        .maybeSingle();

      if (profile) {
        // (c) EA wins precedence — EA always implies is_paid + published.
        if (profile.is_early_adopter) {
          state = "first_5000_ea";
        } else if (profile.is_paid && profile.published_at) {
          state = "active_paid";
        }
        // else: state stays "free" (unpublished or unpaid)
      }
      // else: no profile → "free"
    }
    // else: no operator → "free"
  } catch (err) {
    // Hard DB failure. Don't 500 — LASTBURN expects bool-ish on every
    // call and should fail-soft to free. Log it server-side; the
    // structured log below has `ok: false` on this path.
    const latencyMs = Date.now() - startedAt;
    console.error(
      `[lastburn/subscription-state] db_error wallet=${wallet} latency_ms=${latencyMs} err=${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  // ─── 5. Structured success log ─────────────────────────────────────
  const latencyMs = Date.now() - startedAt;
  console.log(
    `[lastburn/subscription-state] ok wallet=${wallet} state=${state} latency_ms=${latencyMs}`,
  );

  // ─── 6. Response ───────────────────────────────────────────────────
  const payload: SuccessPayload = {
    state,
    wallet,
    checked_at: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
