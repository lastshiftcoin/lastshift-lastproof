import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import {
  upsertProfileByOperator,
  updateProfile,
  getProfileByOperatorId,
} from "@/lib/profiles-store";
import { isPaidNow } from "@/lib/subscription";
import { recalcProfileTier } from "@/lib/tier-recalc";
import { enqueueAffiliateConfirm } from "@/lib/affiliate-queue";
import { tryAddDefaultChad } from "@/lib/chads/default-chad";

/**
 * POST /api/profile/publish
 * Body: { handle }
 *
 * Skeleton publish flow:
 *   1. Require session (cookie from skeleton #1).
 *   2. Upsert profile keyed by operatorId (== session.walletAddress for now —
 *      operator id gets a real UUID when Supabase is wired).
 *   3. If firstFiveThousand AND profile has never been published → grant
 *      EA "free forever" status (subscriptionExpiresAt = null, isPaid = true).
 *      No payment required, no expiry.
 *   4. Set publishedAt = now, is_paid derived from expiry (or kept true for EA).
 *   5. Affiliate confirm callback is NOT called here — that lands in
 *      skeleton #8 (queue + retry).
 *
 * When a real profiles table arrives, this stays the same; the store swap
 * is transparent.
 */

interface Body {
  handle?: string;
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const handle = (body.handle || "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{2,32}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "handle_invalid" }, { status: 400 });
  }

  // v1: operator id == wallet. Real id comes from the operators table.
  const operatorId = session.walletAddress;

  const alreadyExisting = await getProfileByOperatorId(operatorId);
  const firstPublish = !alreadyExisting?.publishedAt;

  const profile = await upsertProfileByOperator({
    operatorId,
    terminalWallet: session.walletAddress,
    handle,
    displayName: session.displayName,
    isEarlyAdopter: session.firstFiveThousand,
  });

  const now = new Date();
  const patch: Parameters<typeof updateProfile>[1] = {
    publishedAt: now.toISOString(),
  };

  // EA "free forever" gift — only on first publish, only if EA.
  // 2026-04-30: First-5,000 program shifted from a 30-day window to no
  // expiry at all. We explicitly write null here. The cron's
  // isEaWithNoExpiry guard (subscription/cron/route.ts:51) keeps these
  // rows from being downgraded. Terminal only provides the
  // firstFiveThousand boolean — LASTPROOF owns the EA grant policy.
  if (firstPublish && session.firstFiveThousand) {
    patch.subscriptionExpiresAt = null;
    patch.subscriptionStartedAt = now.toISOString();
    patch.lastPaymentAt = null; // charge-free, no expiry
    patch.isPaid = true;        // explicit — null expiry can't derive isPaid
  }

  const updated = (await updateProfile(profile.id, patch))!;
  // Derived isPaid after patch. Keep isPaid=true if already set (EA claim),
  // otherwise derive from subscription expiry.
  const derivedPaid = updated.isPaid || isPaidNow({ expiresAt: updated.subscriptionExpiresAt, now });
  if (derivedPaid !== updated.isPaid) {
    await updateProfile(profile.id, { isPaid: derivedPaid });
  }

  await recalcProfileTier(profile.id, now);

  // Enqueue affiliate confirm on FIRST publish only. Worker drains the
  // queue with retries + dead-letter; we never block publish on S2S.
  if (firstPublish) {
    enqueueAffiliateConfirm({
      profileId: profile.id,
      operatorWallet: session.walletAddress,
      terminalId: session.terminalId,
      profileUrl: `https://lastproof.app/${handle}`,
    });

    // Tom-from-MySpace: seed @lastshiftfounder into the new operator's
    // Chad Army on first paid+published publish so they encounter the
    // CHAD MANAGEMENT section as a populated surface. User can Remove
    // anytime via /manage/chads. Fire-and-forget; never fail publish.
    if (derivedPaid) {
      tryAddDefaultChad(session.walletAddress).catch(() => {});
    }
  }

  const final = (await updateProfile(profile.id, {}))!;

  return NextResponse.json({
    ok: true,
    profile: {
      id: final.id,
      handle: final.handle,
      isPaid: final.isPaid,
      isEarlyAdopter: final.isEarlyAdopter,
      subscriptionExpiresAt: final.subscriptionExpiresAt,
      lastPaymentAt: final.lastPaymentAt,
      publishedAt: final.publishedAt,
      tier: final.tier,
    },
    grantedEaWindow: firstPublish && session.firstFiveThousand,
  });
}
