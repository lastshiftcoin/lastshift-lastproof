import type { Metadata } from "next";
import { supabaseService } from "@/lib/db/client";
import {
  RATE_PER_REFERRAL_USD,
  computeAmountOwed,
  formatUsd,
} from "@/lib/ambassador-tiers";
import { AdminPayoutForm } from "./AdminPayoutForm";
import { AdminWeeklyPayoutForm } from "./AdminWeeklyPayoutForm";
import { getCurrentWeekWindowPT, formatInTz, tzOffsetLabel } from "@/lib/weekly-window";
import "../[reportSlug]/report.css";

/**
 * /5k/god-ops — Admin ambassador dashboard.
 *
 * Shows all ambassadors, individual + aggregate stats, and a form
 * to mark all unpaid referrals as paid in a single atomic
 * operation. noindex, admin-only.
 *
 * Payout model (as of 2026-04-26): flat $0.50 per confirmed
 * referral. Each referral has a paid/unpaid status. Admin marks
 * unpaid referrals as paid in bulk per ambassador, supplying a
 * Solscan link as the on-chain receipt for transparency.
 */

export const metadata: Metadata = {
  title: "GOD OPS — Ambassador Admin | LASTPROOF",
  robots: { index: false, follow: false },
};

// Force fresh render on every request. Without this, Next.js caches
// the page (static path, no dynamic params) and the unpaid counts /
// amount-owed values get stuck on whatever was rendered at build time
// or first hit. Server Action's revalidatePath handles the post-payout
// case, but doesn't reliably catch every visit. force-dynamic kills the
// ambiguity — this page always reads live from Supabase.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReportPage() {
  const sb = supabaseService();

  const { data: ambassadors } = await sb
    .from("ambassadors")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const allAmbassadors = ambassadors ?? [];

  // Split by payout model — weekly_flat ambassadors render in a
  // separate panel with weekly-quota math instead of $0.50 math.
  const perReferralAmbs = allAmbassadors.filter(
    (a) => (a.payout_model ?? "per_referral") === "per_referral",
  );
  const weeklyFlatAmbs = allAmbassadors.filter(
    (a) => a.payout_model === "weekly_flat",
  );

  // Build stats for each ambassador — paid/unpaid splits, total earned
  const stats = await Promise.all(
    perReferralAmbs.map(async (amb) => {
      const { data: referrals } = await sb
        .from("profiles")
        .select("ambassador_paid_at")
        .eq("referred_by", amb.campaign_slug);

      const all = referrals ?? [];
      const unpaid = all.filter((r) => !r.ambassador_paid_at).length;
      const paid = all.length - unpaid;
      const amountOwed = computeAmountOwed(unpaid);

      const { data: payouts } = await sb
        .from("ambassador_payouts")
        .select("payout_usd, paid_at")
        .eq("ambassador_id", amb.id);

      const totalPaid = (payouts ?? [])
        .filter((p) => p.paid_at)
        .reduce((sum, p) => sum + Number(p.payout_usd), 0);

      return {
        id: amb.id,
        tgHandle: amb.tg_handle,
        campaignSlug: amb.campaign_slug,
        reportSlug: amb.report_slug,
        unpaidCount: unpaid,
        paidCount: paid,
        referralsAllTime: all.length,
        amountOwed,
        totalPaid,
      };
    }),
  );

  // Weekly-flat stats — count referrals in the current Sun-8pm-PT window
  const weekWindow = getCurrentWeekWindowPT();
  const weeklyStats = await Promise.all(
    weeklyFlatAmbs.map(async (amb) => {
      // Floor the count at the program start date so backlog claims
      // don't pre-fill the bar (see migration 0030).
      const programStart = amb.weekly_program_started_at
        ? new Date(amb.weekly_program_started_at)
        : null;
      const effectiveStart =
        programStart && programStart > weekWindow.start
          ? programStart
          : weekWindow.start;

      const { count: weekCount } = await sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", amb.campaign_slug)
        .gte("ea_claimed_at", effectiveStart.toISOString())
        .lte("ea_claimed_at", weekWindow.end.toISOString());

      const { count: allTime } = await sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", amb.campaign_slug);

      const { data: paidThisWeek } = await sb
        .from("ambassador_payouts")
        .select("id")
        .eq("ambassador_id", amb.id)
        .eq("period_start", weekWindow.start.toISOString())
        .maybeSingle();

      const tz = amb.display_timezone ?? "America/Los_Angeles";
      const weekWindowLabel =
        `${formatInTz(weekWindow.start, tz)} → ` +
        `${formatInTz(weekWindow.end, tz)} (${tzOffsetLabel(tz)})`;

      return {
        id: amb.id,
        tgHandle: amb.tg_handle,
        campaignSlug: amb.campaign_slug,
        reportSlug: amb.report_slug,
        weeklyTarget: amb.weekly_referral_target ?? 0,
        weekReferrals: weekCount ?? 0,
        referralsAllTime: allTime ?? 0,
        alreadyPaidThisWeek: !!paidThisWeek,
        weekWindowLabel,
      };
    }),
  );

  // Aggregates
  const totalUnpaid = stats.reduce((s, a) => s + a.unpaidCount, 0);
  const totalAllTime = stats.reduce((s, a) => s + a.referralsAllTime, 0);
  const totalLiability = stats.reduce((s, a) => s + a.amountOwed, 0);
  const totalPaidYtd = stats.reduce((s, a) => s + a.totalPaid, 0);

  return (
    <div className="rpt-page">
      <div className="rpt-container">
        <div className="rpt-header">
          <div className="rpt-eyebrow">&gt; GOD MODE</div>
          <h1 className="rpt-title">Ambassador Admin</h1>
          <p className="rpt-sub">
            All ambassadors. {formatUsd(RATE_PER_REFERRAL_USD)} per referral.
            Mark all unpaid referrals as paid in one click.
          </p>
        </div>

        {/* Aggregate stats */}
        <div className="rpt-stats">
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{totalUnpaid}</div>
            <div className="rpt-stat-label">UNPAID REFERRALS</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{totalAllTime}</div>
            <div className="rpt-stat-label">TOTAL REFERRALS (ALL)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{formatUsd(totalLiability)}</div>
            <div className="rpt-stat-label">TOTAL LIABILITY (UNPAID)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">{formatUsd(totalPaidYtd)}</div>
            <div className="rpt-stat-label">TOTAL PAID</div>
          </div>
        </div>

        {/* Per-ambassador table */}
        <div className="rpt-section-title">AMBASSADORS</div>
        <table className="rpt-table">
          <thead>
            <tr>
              <th>HANDLE</th>
              <th>CAMPAIGN</th>
              <th>UNPAID</th>
              <th>PAID</th>
              <th>ALL</th>
              <th>OWED</th>
              <th>TOTAL PAID</th>
              <th>REPORT</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((a) => (
              <tr key={a.id}>
                <td>{a.tgHandle}</td>
                <td style={{ fontSize: 10 }}>/{a.campaignSlug}</td>
                <td
                  style={{
                    color: a.unpaidCount > 0 ? "#ff9100" : undefined,
                    fontWeight: a.unpaidCount > 0 ? 700 : undefined,
                  }}
                >
                  {a.unpaidCount}
                </td>
                <td className="rpt-paid">{a.paidCount}</td>
                <td>{a.referralsAllTime}</td>
                <td
                  style={{
                    color: a.amountOwed > 0 ? "#ff9100" : undefined,
                    fontWeight: a.amountOwed > 0 ? 700 : undefined,
                  }}
                >
                  {formatUsd(a.amountOwed)}
                </td>
                <td className="rpt-paid">{formatUsd(a.totalPaid)}</td>
                <td>
                  <a
                    href={`/5k/${a.reportSlug}`}
                    className="rpt-tx-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    view &rarr;
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mark-as-paid form (per-referral $0.50 model) */}
        <div className="rpt-section-title">MARK AS PAID (PER-REFERRAL)</div>
        <AdminPayoutForm
          ambassadors={stats.map((a) => ({
            id: a.id,
            tgHandle: a.tgHandle,
            unpaidCount: a.unpaidCount,
            amountOwed: a.amountOwed,
          }))}
        />

        {/* Weekly-flat ambassadors (e.g. Habilamar — $80/mo retainer, 250/wk quota) */}
        {weeklyStats.length > 0 && (
          <>
            <div className="rpt-section-title" style={{ marginTop: 32 }}>
              WEEKLY RETAINER AMBASSADORS
            </div>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>HANDLE</th>
                  <th>CAMPAIGN</th>
                  <th>THIS WEEK</th>
                  <th>TARGET</th>
                  <th>ALL-TIME</th>
                  <th>PAID THIS WEEK?</th>
                  <th>REPORT</th>
                </tr>
              </thead>
              <tbody>
                {weeklyStats.map((a) => {
                  const pct = a.weeklyTarget
                    ? Math.min(100, Math.round((a.weekReferrals / a.weeklyTarget) * 100))
                    : 0;
                  return (
                    <tr key={a.id}>
                      <td>{a.tgHandle}</td>
                      <td style={{ fontSize: 10 }}>/{a.campaignSlug}</td>
                      <td
                        style={{
                          color: a.weekReferrals >= a.weeklyTarget ? "#00e676" : "#ff9100",
                          fontWeight: 700,
                        }}
                      >
                        {a.weekReferrals} ({pct}%)
                      </td>
                      <td>{a.weeklyTarget}</td>
                      <td>{a.referralsAllTime}</td>
                      <td>
                        {a.alreadyPaidThisWeek ? (
                          <span className="rpt-paid">✓ PAID</span>
                        ) : (
                          <span className="rpt-unpaid">⏳ PENDING</span>
                        )}
                      </td>
                      <td>
                        <a
                          href={`/5k/${a.reportSlug}`}
                          className="rpt-tx-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          view &rarr;
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="rpt-section-title" style={{ marginTop: 16 }}>
              RECORD WEEKLY PAYOUT
            </div>
            <AdminWeeklyPayoutForm ambassadors={weeklyStats} />
          </>
        )}
      </div>
    </div>
  );
}
