/**
 * Telegram auth debug logger — mirrors x-auth-debug.ts but writes to
 * category='tg_auth' in the shared debug_events table.
 *
 * Fire-and-forget: never throws, never blocks the OAuth flow.
 *
 * Query later with:
 *   SELECT created_at, event, payload, user_agent
 *   FROM debug_events
 *   WHERE category = 'tg_auth'
 *   ORDER BY created_at DESC
 *   LIMIT 100;
 *
 * Note: unlike the X flow (authorize → callback chain), Telegram is a
 * single POST from the widget callback page. Each attempt is its own
 * session_id — no correlation chain to maintain.
 */

import { supabaseService } from "@/lib/db/client";

type TgAuthEvent =
  | "callback_entry"
  | "invalid_json"
  | "missing_params"
  | "not_configured"
  | "hash_mismatch"
  | "expired_auth"
  | "no_username"
  | "no_session"
  | "handle_taken"
  | "db_update_failed"
  | "success";

export interface TgAuthLogInput {
  event: TgAuthEvent;
  sessionId: string;
  userAgent?: string | null;
  walletAddress?: string | null;
  payload?: Record<string, unknown>;
}

export async function logTgAuthEvent(input: TgAuthLogInput): Promise<void> {
  try {
    const sb = supabaseService();
    await sb.from("debug_events").insert({
      session_id: input.sessionId,
      category: "tg_auth",
      event: input.event,
      payload: {
        ...(input.walletAddress ? { wallet_address: input.walletAddress } : {}),
        ...(input.payload ?? {}),
      },
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("[tg-auth-debug] log write failed:", err);
  }
}

export function newTgAuthSessionId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}
