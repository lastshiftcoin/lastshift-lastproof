/**
 * GET /api/ambassador/stats?slug=campaign_slug
 *
 * Returns ambassador referral stats. If slug is provided, returns stats
 * for that ambassador only. If omitted, returns all ambassadors (admin view).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { computePayoutTier } from "@/lib/ambassador-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AmbassadorStats {
  id: string;
  tgHandle: string;
  campaignSlug: string;
  reportSlug: string;
  referrals7d: number;
  referralsAllTime: number;
  currentTier: ReturnType<typeof computePayoutTier>;
  totalPaidUsd: number;
  referrals: Array<{
    handle: string;
    eaNumber: number | null;
    claimedAt: string;
  }>;
  payouts: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    referralCount: number;
    payoutUsd: number;
    txSignature: string | null;
    paidAt: string | null;
  }>;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const sb = supabaseService();

  // Fetch ambassadors
  let ambassadorQuery = sb
    .from("ambassadors")
    .select("*")
    .eq("is_active", true);

  if (slug) {
    ambassadorQuery = ambassadorQuery.eq("campaign_slug", slug);
  }

  const { data: ambassadors, error: ambErr } = await ambassadorQuery;
  if (ambErr) {
    return NextResponse.json({ ok: false, reason: ambErr.message }, { status: 500 });
  }
  if (!ambassadors || ambassadors.length === 0) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const results: AmbassadorStats[] = [];

  for (const amb of ambassadors) {
    // Count all-time referrals
    const { data: allReferrals } = await sb
      .from("profiles")
      .select("handle, ea_number, ea_claimed_at")
      .eq("referred_by", amb.campaign_slug)
      .order("ea_claimed_at", { ascending: false });

    const referralsAllTime = allReferrals?.length ?? 0;

    // Count 7-day referrals
    const referrals7d = (allReferrals ?? []).filter(
      (r) => r.ea_claimed_at && r.ea_claimed_at >= sevenDaysAgo,
    ).length;

    // Fetch payouts
    const { data: payouts } = await sb
      .from("ambassador_payouts")
      .select("*")
      .eq("ambassador_id", amb.id)
      .order("period_end", { ascending: false });

    const totalPaidUsd = (payouts ?? [])
      .filter((p) => p.paid_at)
      .reduce((sum, p) => sum + Number(p.payout_usd), 0);

    results.push({
      id: amb.id,
      tgHandle: amb.tg_handle,
      campaignSlug: amb.campaign_slug,
      reportSlug: amb.report_slug,
      referrals7d,
      referralsAllTime,
      currentTier: computePayoutTier(referrals7d),
      totalPaidUsd,
      referrals: (allReferrals ?? []).map((r) => ({
        handle: r.handle,
        eaNumber: r.ea_number,
        claimedAt: r.ea_claimed_at,
      })),
      payouts: (payouts ?? []).map((p) => ({
        id: p.id,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        referralCount: p.referral_count,
        payoutUsd: Number(p.payout_usd),
        txSignature: p.tx_signature,
        paidAt: p.paid_at,
      })),
    });
  }

  return NextResponse.json({ ok: true, ambassadors: results });
}
