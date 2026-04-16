/**
 * GET /api/admin/metrics
 *
 * Internal admin endpoint — bearer token gated.
 * Returns aggregate counts for the admin dashboard:
 *   - All-time: profiles (total/free/upgraded), proofs (total/dev), minted projects
 *   - By-range (Today, Last 7d, Last 30d, MTD, YTD): new profiles, new proofs,
 *     new dev proofs, new mints, revenue USD
 *
 * Auth: `Authorization: Bearer ${ADMIN_API_SECRET}` (env var, set in Vercel)
 *
 * Read-only — never mutates anything.
 */

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RangeMetrics {
  newProfiles: number;
  newProofs: number;
  newDevProofs: number;
  newMints: number;
  revenueUsd: number;
}

interface MetricsResponse {
  generatedAt: string;
  profiles: { total: number; free: number; upgraded: number };
  proofs: { total: number; dev: number };
  mintedProjects: number;
  byRange: {
    today: RangeMetrics;
    last7d: RangeMetrics;
    last30d: RangeMetrics;
    mtd: RangeMetrics;
    ytd: RangeMetrics;
  };
}

function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

async function sumPaymentsSince(startIso: string): Promise<number> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("payments")
    .select("amount_usd")
    .eq("status", "confirmed")
    .gte("confirmed_at", startIso);
  if (error) {
    console.error("[admin/metrics] sum payments error:", error.message);
    return 0;
  }
  let total = 0;
  for (const row of data ?? []) {
    const v = (row as { amount_usd: number | string }).amount_usd;
    total += typeof v === "number" ? v : parseFloat(String(v)) || 0;
  }
  return Math.round(total * 100) / 100;
}

async function countForRange(startIso: string): Promise<RangeMetrics> {
  const sb = supabaseService();

  // work_items has no minted_at column; we use payments(kind=mint) confirmed
  // in the range as the signal for "minted in this period" since minting
  // always goes through a payment.
  const [
    newProfilesRes,
    newProofsRes,
    newDevProofsRes,
    newMintsRes,
    revenueUsd,
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startIso),
    sb
      .from("proofs")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("kind", "proof")
      .gte("confirmed_at", startIso),
    sb
      .from("proofs")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("kind", "dev_verification")
      .gte("confirmed_at", startIso),
    sb
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("kind", "mint")
      .gte("confirmed_at", startIso),
    sumPaymentsSince(startIso),
  ]);

  return {
    newProfiles: newProfilesRes.count ?? 0,
    newProofs: newProofsRes.count ?? 0,
    newDevProofs: newDevProofsRes.count ?? 0,
    newMints: newMintsRes.count ?? 0,
    revenueUsd,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return forbidden();

  try {
    const sb = supabaseService();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    // ─── All-time totals ──────────────────────────────────────────────
    const nowIso = now.toISOString();

    const [
      totalProfilesRes,
      upgradedProfilesRes,
      totalProofsRes,
      totalDevProofsRes,
      mintedProjectsRes,
      todayMetrics,
      last7dMetrics,
      last30dMetrics,
      mtdMetrics,
      ytdMetrics,
    ] = await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }),
      // Upgraded = is_paid AND subscription_expires_at > now
      sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_paid", true)
        .gt("subscription_expires_at", nowIso),
      sb
        .from("proofs")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("kind", "proof"),
      sb
        .from("proofs")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("kind", "dev_verification"),
      sb.from("work_items").select("*", { count: "exact", head: true }).eq("minted", true),
      countForRange(todayStart.toISOString()),
      countForRange(last7dStart.toISOString()),
      countForRange(last30dStart.toISOString()),
      countForRange(mtdStart.toISOString()),
      countForRange(ytdStart.toISOString()),
    ]);

    const totalProfiles = totalProfilesRes.count ?? 0;
    const upgradedProfiles = upgradedProfilesRes.count ?? 0;
    const freeProfiles = Math.max(0, totalProfiles - upgradedProfiles);
    const totalProofs = totalProofsRes.count ?? 0;
    const totalDevProofs = totalDevProofsRes.count ?? 0;
    const mintedProjects = mintedProjectsRes.count ?? 0;

    const body: MetricsResponse = {
      generatedAt: now.toISOString(),
      profiles: { total: totalProfiles, free: freeProfiles, upgraded: upgradedProfiles },
      proofs: { total: totalProofs, dev: totalDevProofs },
      mintedProjects,
      byRange: {
        today: todayMetrics,
        last7d: last7dMetrics,
        last30d: last30dMetrics,
        mtd: mtdMetrics,
        ytd: ytdMetrics,
      },
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error("[admin/metrics] unexpected error:", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
