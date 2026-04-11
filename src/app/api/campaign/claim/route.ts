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
 */

import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { supabaseService } from "@/lib/db/client";
import { GRID_LAUNCH_DATE, EA_FREE_WINDOW_DAYS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLAIMS = 5000;

export async function POST() {
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

  // Compute subscription expiry:
  // Before grid launch: no expiry (null → effectively infinite until grid launch)
  // After grid launch: 30 days from grid launch date (for pre-launch claimants)
  //                    or 30 days from now (for post-launch claimants)
  const now = new Date();
  let subscriptionExpiresAt: string | null = null;

  if (now >= GRID_LAUNCH_DATE) {
    // Post grid launch — 30 days from now
    const expires = new Date(now.getTime() + EA_FREE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    subscriptionExpiresAt = expires.toISOString();
  }
  // Pre grid launch: null expiry (handled by grid launch cron later)

  // Assign sequential EA number: count of existing claimants + 1
  const eaNumber = (count ?? 0) + 1;

  // Activate: set is_paid, ea_claimed, ea_number, subscription_expires_at
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
    // Check if columns don't exist yet
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
