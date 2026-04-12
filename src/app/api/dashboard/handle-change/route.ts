import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";
import { checkHandleCooldown } from "@/lib/handle-cooldown";
import { BASE_PRICES_USD, LASTSHFT_DISCOUNT, HANDLE_CHANGE_COOLDOWN_DAYS } from "@/lib/pricing";

/**
 * GET  /api/dashboard/handle-change — check cooldown eligibility + pricing
 * POST /api/dashboard/handle-change — validate handle (format, availability, cooldown)
 *
 * POST is validate-only. It does NOT execute the handle change — that
 * happens in the payment dispatcher (handleHandleChange in payment-events.ts)
 * after the webhook confirms the on-chain payment. The client flow:
 *   1. POST here to validate → { ok: true }
 *   2. POST /api/quote with { kind: "handle_change", metadata: { refId: newHandle } }
 *   3. Generic payment pipeline (build-tx → sign → broadcast → confirm)
 *   4. Webhook fires → dispatcher writes the change
 */

async function getProfileAndSb(session: { walletAddress: string }) {
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();
  if (!operator) return { profile: null, sb };
  const profile = await getProfileByOperatorId(operator.id);
  return { profile, sb };
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile } = await getProfileAndSb(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const cooldown = await checkHandleCooldown(profile.id);

  return NextResponse.json({
    currentHandle: profile.handle,
    cooldown,
    pricing: {
      baseUsd: BASE_PRICES_USD.handle_change,
      lastshftUsd: +(BASE_PRICES_USD.handle_change * (1 - LASTSHFT_DISCOUNT)).toFixed(2),
      cooldownDays: HANDLE_CHANGE_COOLDOWN_DAYS,
    },
  });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfileAndSb(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { newHandle } = body;

  if (!newHandle || typeof newHandle !== "string") {
    return NextResponse.json({ error: "missing_handle" }, { status: 400 });
  }

  const clean = newHandle.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  if (clean === profile.handle.toLowerCase()) {
    return NextResponse.json({ error: "same_handle" }, { status: 400 });
  }

  // Cooldown check
  const cooldown = await checkHandleCooldown(profile.id);
  if (!cooldown.eligible) {
    return NextResponse.json({
      error: "cooldown_active",
      daysRemaining: cooldown.daysRemaining,
    }, { status: 429 });
  }

  // Availability check
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .ilike("handle", clean)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  // Validation passed — client should now issue a quote and pay via
  // the generic payment pipeline. The dispatcher handles the actual
  // handle change on payment confirmation.
  return NextResponse.json({ ok: true, validatedHandle: clean });
}
