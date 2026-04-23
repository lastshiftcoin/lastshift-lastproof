/**
 * X OAuth debug logger — writes every X auth attempt (start + outcome) to
 * the shared `debug_events` table so we can diagnose user-reported failures
 * asynchronously.
 *
 * Fire-and-forget: never throws, never awaits caller-critical. If the DB
 * write fails, we fall back to console.error and let the OAuth flow
 * proceed normally.
 *
 * Query later with:
 *   SELECT created_at, event, payload, user_agent
 *   FROM debug_events
 *   WHERE category = 'x_auth'
 *   ORDER BY created_at DESC
 *   LIMIT 100;
 */

import { supabaseService } from "@/lib/db/client";

type XAuthEvent =
  | "authorize_start"
  | "callback_entry"
  | "callback_missing_code"
  | "callback_no_cookie"
  | "callback_corrupt_cookie"
  | "callback_state_mismatch"
  | "token_exchange_failed"
  | "token_exchange_ok"
  | "user_fetch_failed"
  | "no_session"
  | "handle_taken"
  | "db_update_failed"
  | "success";

export interface XAuthLogInput {
  event: XAuthEvent;
  sessionId: string; // random per-attempt ID, lets us chain authorize→callback
  userAgent?: string | null;
  walletAddress?: string | null;
  payload?: Record<string, unknown>;
}

export async function logXAuthEvent(input: XAuthLogInput): Promise<void> {
  try {
    const sb = supabaseService();
    await sb.from("debug_events").insert({
      session_id: input.sessionId,
      category: "x_auth",
      event: input.event,
      payload: {
        ...(input.walletAddress ? { wallet_address: input.walletAddress } : {}),
        ...(input.payload ?? {}),
      },
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    // Never break OAuth because logging failed.
    console.error("[x-auth-debug] log write failed:", err);
  }
}

/**
 * Generate a short random session ID for correlating authorize → callback.
 * Stored in the OAuth state cookie alongside state + codeVerifier so the
 * callback can reuse the same ID.
 */
export function newXAuthSessionId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}
