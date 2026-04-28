import type { Metadata } from "next";
import { supabaseService } from "@/lib/db/client";
import {
  RATE_PER_REFERRAL_USD,
  computeAmountOwed,
  formatUsd,
} from "@/lib/ambassador-tiers";
import { AdminPayoutForm } from "./AdminPayoutForm";
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

  // Build stats for each ambassador — paid/unpaid splits, total earned
  const stats = await Promise.all(
    allAmbassadors.map(async (amb) => {
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

        {/* Mark-as-paid form */}
        <div className="rpt-section-title">MARK AS PAID</div>
        <AdminPayoutForm
          ambassadors={stats.map((a) => ({
            id: a.id,
            tgHandle: a.tgHandle,
            unpaidCount: a.unpaidCount,
            amountOwed: a.amountOwed,
          }))}
        />
      </div>
    </div>
  );
}
