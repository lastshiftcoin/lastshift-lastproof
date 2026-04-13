/**
 * POST /api/payment/session-start
 *
 * Creates a payment session when the payment modal opens.
 * Returns { session_id, opened_at } for localStorage persistence.
 *
 * Session timestamp gates TX verification: only transactions
 * with blockTime >= session.opened_at are accepted.
 *
 * Requires active session (payments are profile-scoped, unlike proofs).
 */

import { supabaseService } from "@/lib/db/client";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_KINDS = new Set(["subscription", "mint", "handle_change"]);

export async function POST(req: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      kind?: string;
      profile_id?: string;
      ref_id?: string;
    };

    if (!body.kind || !VALID_KINDS.has(body.kind)) {
      return json({ ok: false, error: "invalid kind" }, 400);
    }

    const db = supabaseService();

    const { data: paymentSession, error } = await db
      .from("payment_sessions")
      .insert({
        kind: body.kind,
        profile_id: body.profile_id ?? null,
        ref_id: body.ref_id ?? null,
      })
      .select("id, opened_at")
      .single();

    if (error) {
      console.error("[payment/session-start] insert failed:", error.message);
      return json({ ok: false, error: "session_create_failed" }, 500);
    }

    return json({
      ok: true,
      session_id: paymentSession.id,
      opened_at: paymentSession.opened_at,
    });
  } catch (err) {
    console.error("[payment/session-start] unexpected error:", err);
    return json({ ok: false, error: "unknown" }, 500);
  }
}
