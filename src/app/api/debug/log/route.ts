/**
 * POST /api/debug/log — fire-and-forget debug event logger.
 *
 * Accepts a single event or batch of events from the client-side
 * useDebugLog hook. Inserts into Supabase `debug_events` table.
 * No auth required — single-user debug tool.
 *
 * Body: { events: DebugEvent[] }
 * Each event: { session_id, category, event, payload?, user_agent?, wallet_env?, is_android? }
 */

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";

interface DebugEvent {
  session_id: string;
  category: string;
  event: string;
  payload?: Record<string, unknown>;
  user_agent?: string;
  wallet_env?: string;
  is_android?: boolean;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { events?: DebugEvent[] };
    const events = body.events;
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ ok: false, error: "no events" }, { status: 400 });
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 50).map((e) => ({
      session_id: String(e.session_id || "unknown"),
      category: String(e.category || "unknown"),
      event: String(e.event || "unknown"),
      payload: e.payload ?? {},
      user_agent: e.user_agent ?? null,
      wallet_env: e.wallet_env ?? null,
      is_android: Boolean(e.is_android),
    }));

    const { error } = await supabaseService()
      .from("debug_events")
      .insert(batch);

    if (error) {
      console.error("[debug/log] insert error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: batch.length });
  } catch (err) {
    console.error("[debug/log] unexpected:", err);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
