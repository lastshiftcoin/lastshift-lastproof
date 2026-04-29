/**
 * POST /api/campaign/claim
 *
 * Instantly activates the free premium upgrade for the first 5,000 operators.
 * No payment required — this is the early access campaign.
 *
 * Rules (see memory: project_5000_campaign.md):
 *   - Counts profiles that CLAIMED the free upgrade (ea_claimed = true)
 *   - When 5,000 are claimed, returns { ok: false, reason: "sold_out" }
 *   - 30-day timer does NOT start until GRID_LAUNCH_DATE (2026-05-08)
 *   - Pre-launch: profile becomes paid with no expiration until grid launch
 *   - At grid launch: 30-day countdown begins for all free-claimed profiles
 *   - Idempotent: re-claiming when already claimed is a no-op success
 *
 * Attribution note (2026-04-28): no longer touches referred_by. The
 * onboarding modal now captures it explicitly via the "Referred by" field
 * and writes it directly to profiles.referred_by at onboarding time —
 * before the user ever reaches this endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { supabaseService } from "@/lib/db/client";
import { GRID_LAUNCH_DATE, EA_FREE_WINDOW_DAYS } from "@/lib/constants";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const claimLimiter = createRateLimiter({ window: 60_000, max: 3 });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLAIMS = 5000;

export async function POST(req: NextRequest) {
  const rl = claimLimiter.check(getClientIp(req));
  if (!rl.ok) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const sb = supabaseService();

  // Look up operator by wallet, then profile by operator ID
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  if (!operator) {
    return NextResponse.json(
      { ok: false, reason: "profile_not_found" },
      { status: 404 },
    );
  }

  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("id, is_paid, ea_claimed")
    .eq("operator_id", operator.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json(
      { ok: false, reason: "profile_not_found" },
      { status: 404 },
    );
  }

  // Idempotent — already claimed
  if (profile.ea_claimed) {
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }

  // Check how many have already claimed
  const { count, error: countErr } = await sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("ea_claimed", true);

  if (countErr) {
    console.error("[campaign/claim] count error:", countErr.message);
    return NextResponse.json(
      { ok: false, reason: "server_error" },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= MAX_CLAIMS) {
    return NextResponse.json({ ok: false, reason: "sold_out" });
  }

  // Compute subscription expiry
  const now = new Date();
  let subscriptionExpiresAt: string | null = null;

  if (now >= GRID_LAUNCH_DATE) {
    const expires = new Date(now.getTime() + EA_FREE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    subscriptionExpiresAt = expires.toISOString();
  }

  const eaNumber = (count ?? 0) + 1;

  const { error: updateErr } = await sb
    .from("profiles")
    .update({
      is_paid: true,
      ea_claimed: true,
      ea_claimed_at: now.toISOString(),
      ea_number: eaNumber,
      subscription_expires_at: subscriptionExpiresAt,
      is_early_adopter: true,
      tier: 1,
      published_at: now.toISOString(),
    })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("[campaign/claim] update error:", updateErr.message);
    if (updateErr.message.includes("ea_claimed")) {
      return NextResponse.json(
        { ok: false, reason: "migration_needed", message: "ea_claimed column not found — run migration" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: false, reason: "server_error" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyClaimed: false,
    eaNumber,
    subscriptionExpiresAt,
  });
}
