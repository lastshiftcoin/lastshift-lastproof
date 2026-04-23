/**
 * POST /api/proof/session-start
 *
 * Creates an anonymous proof session when the modal opens.
 * Returns { session_id, opened_at } for the frontend to persist
 * in localStorage (keyed by work_item_id).
 *
 * The session timestamp gates TX verification: only transactions
 * with blockTime >= session.opened_at are accepted. This kills
 * old-TX-reuse scams without exposing time windows to the user.
 *
 * No auth needed — sessions are anonymous (tied to work_item_id, not user).
 */

import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionLimiter = createRateLimiter({ window: 60_000, max: 10 });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const rl = sessionLimiter.check(getClientIp(req));
  if (!rl.ok) return json({ ok: false, error: "rate_limited" }, 429);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      work_item_id?: string;
    };

    if (!body.work_item_id) {
      return json({ ok: false, error: "missing work_item_id" }, 400);
    }

    // Validate UUID format
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(body.work_item_id)) {
      return json({ ok: false, error: "invalid work_item_id format" }, 400);
    }

    const db = supabaseService();

    const { data: session, error } = await db
      .from("proof_sessions")
      .insert({
        work_item_id: body.work_item_id,
      })
      .select("id, opened_at")
      .single();

    if (error) {
      console.error("[session-start] insert failed:", error.message);
      return json({ ok: false, error: "session_create_failed" }, 500);
    }

    return json({
      ok: true,
      session_id: session.id,
      opened_at: session.opened_at,
    });
  } catch (err) {
    console.error("[session-start] unexpected error:", err);
    return json({ ok: false, error: "unknown" }, 500);
  }
}
