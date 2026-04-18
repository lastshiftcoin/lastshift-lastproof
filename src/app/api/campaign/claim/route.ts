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
 * Referral attribution (server-side primary + legacy fallbacks):
 *   Primary: reads `operators.referred_by` stamped at wallet-gate/register-tid
 *            time, when the URL was still /manage?ref=<slug>. This is the
 *            reliable path — immune to client-side URL drops.
 *   Fallback A: reads `ref` from POST body (URL param still in client URL)
 *   Fallback B: reads `lp_ref` cookie (broken under Next 16 Server Component
 *               set() but kept as a harmless read for any legacy cookie)
 *   Any source → validates against ambassadors table → writes profiles.referred_by
 *   First-touch wins: never overwrites an existing non-null referred_by.
 */

import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { supabaseService } from "@/lib/db/client";
import { GRID_LAUNCH_DATE, EA_FREE_WINDOW_DAYS } from "@/lib/constants";
import { cookies } from "next/headers";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logReferralEvent } from "@/lib/referral-events";

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
    .select("id, referred_by")
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

  // ─── Referral attribution ──────────────────────────────────────────
  // Primary: operators.referred_by, stamped server-side at wallet-gate /
  // register-tid time. This is the canonical source.
  let validatedSlug: string | null = operator.referred_by ?? null;
  let attributionSource: "operator" | "body" | "cookie" | null =
    validatedSlug ? "operator" : null;

  // Fallback: if operator wasn't stamped (e.g. pre-fix account), try the
  // legacy URL/cookie paths one last time. Validate against ambassadors.
  if (!validatedSlug) {
    const body = await req.json().catch(() => ({}));
    const bodyRef = (body as { ref?: string }).ref ?? null;

    const cookieStore = await cookies();
    const cookieRef = cookieStore.get("lp_ref")?.value ?? null;

    const rawSlug = bodyRef || cookieRef;

    if (rawSlug) {
      const { data: ambassador } = await sb
        .from("ambassadors")
        .select("campaign_slug")
        .eq("campaign_slug", rawSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (ambassador) {
        validatedSlug = ambassador.campaign_slug;
        attributionSource = bodyRef ? "body" : "cookie";

        // Backfill operator row so subsequent calls stay consistent.
        await sb
          .from("operators")
          .update({ referred_by: validatedSlug })
          .eq("id", operator.id)
          .is("referred_by", null);
      }

      // Consume the cookie regardless (one-time capture)
      cookieStore.delete("lp_ref");
    }
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
      ...(validatedSlug ? { referred_by: validatedSlug } : {}),
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

  if (validatedSlug) {
    console.log(`[campaign/claim] referral attributed — profile=${profile.id} slug=${validatedSlug} source=${attributionSource}`);
  }

  logReferralEvent({
    type: "campaign_claim",
    walletAddress: session.walletAddress,
    operatorId: operator.id,
    campaignSlug: validatedSlug,
    source: attributionSource ?? "none",
    outcome: validatedSlug ? "stamped" : "no_ref",
    metadata: {
      profileId: profile.id,
      eaNumber,
      // Tracks whether the fallback paths ever fire in prod. If these
      // stay at 0 long-term, we can rip out the legacy cookie read.
      fallbackUsed: attributionSource === "body" || attributionSource === "cookie",
    },
  });

  return NextResponse.json({
    ok: true,
    alreadyClaimed: false,
    eaNumber,
    subscriptionExpiresAt,
  });
}
