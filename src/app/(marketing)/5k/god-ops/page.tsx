import type { Metadata } from "next";
import { supabaseService } from "@/lib/db/client";
import { computePayoutTier } from "@/lib/ambassador-tiers";
import { AdminPayoutForm } from "./AdminPayoutForm";
import "../[reportSlug]/report.css";

/**
 * /5k/god-ops — Admin ambassador dashboard.
 *
 * Shows all ambassadors, individual + aggregate stats, and a form
 * to record payouts with Solscan tx signatures. noindex, admin-only.
 */

export const metadata: Metadata = {
  title: "GOD OPS — Ambassador Admin | LASTPROOF",
  robots: { index: false, follow: false },
};

export default async function AdminReportPage() {
  const sb = supabaseService();

  const { data: ambassadors } = await sb
    .from("ambassadors")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const allAmbassadors = ambassadors ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Build stats for each ambassador
  const stats = await Promise.all(
    allAmbassadors.map(async (amb) => {
      const { data: referrals } = await sb
        .from("profiles")
        .select("handle, ea_number, ea_claimed_at")
        .eq("referred_by", amb.campaign_slug)
        .order("ea_claimed_at", { ascending: false });

      const all = referrals ?? [];
      const last7d = all.filter(
        (r) => r.ea_claimed_at && r.ea_claimed_at >= sevenDaysAgo,
      );

      const { data: payouts } = await sb
        .from("ambassador_payouts")
        .select("*")
        .eq("ambassador_id", amb.id)
        .order("period_end", { ascending: false });

      const totalPaid = (payouts ?? [])
        .filter((p) => p.paid_at)
        .reduce((sum, p) => sum + Number(p.payout_usd), 0);

      const tier = computePayoutTier(last7d.length);

      return {
        id: amb.id,
        tgHandle: amb.tg_handle,
        campaignSlug: amb.campaign_slug,
        reportSlug: amb.report_slug,
        referrals7d: last7d.length,
        referralsAllTime: all.length,
        tier,
        totalPaid,
      };
    }),
  );

  // Aggregates
  const total7d = stats.reduce((s, a) => s + a.referrals7d, 0);
  const totalAllTime = stats.reduce((s, a) => s + a.referralsAllTime, 0);
  const totalLiability = stats.reduce((s, a) => s + a.tier.payoutUsd, 0);
  const totalPaidYtd = stats.reduce((s, a) => s + a.totalPaid, 0);

  return (
    <div className="rpt-page">
      <div className="rpt-container">
        <div className="rpt-header">
          <div className="rpt-eyebrow">&gt; GOD MODE</div>
          <h1 className="rpt-title">Ambassador Admin</h1>
          <p className="rpt-sub">All ambassadors. Real-time stats. Mark payouts.</p>
        </div>

        {/* Aggregate stats */}
        <div className="rpt-stats">
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{total7d}</div>
            <div className="rpt-stat-label">TOTAL REFERRALS (7D)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{totalAllTime}</div>
            <div className="rpt-stat-label">TOTAL REFERRALS (ALL)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">${totalLiability}</div>
            <div className="rpt-stat-label">PAYOUT LIABILITY (THIS PERIOD)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">${totalPaidYtd.toFixed(2)}</div>
            <div className="rpt-stat-label">TOTAL PAID (YTD)</div>
          </div>
        </div>

        {/* Per-ambassador table */}
        <div className="rpt-section-title">AMBASSADORS</div>
        <table className="rpt-table">
          <thead>
            <tr>
              <th>HANDLE</th>
              <th>CAMPAIGN</th>
              <th>7D</th>
              <th>ALL</th>
              <th>TIER</th>
              <th>EARNINGS</th>
              <th>PAID YTD</th>
              <th>REPORT</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((a) => (
              <tr key={a.id}>
                <td>{a.tgHandle}</td>
                <td style={{ fontSize: 10 }}>/{a.campaignSlug}</td>
                <td style={{ color: a.referrals7d > 0 ? "#ff9100" : undefined }}>{a.referrals7d}</td>
                <td>{a.referralsAllTime}</td>
                <td>{a.tier.label}</td>
                <td>${a.tier.payoutUsd}</td>
                <td className="rpt-paid">${a.totalPaid.toFixed(2)}</td>
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

        {/* Payout form */}
        <div className="rpt-section-title">RECORD PAYOUT</div>
        <AdminPayoutForm
          ambassadors={stats.map((a) => ({
            id: a.id,
            tgHandle: a.tgHandle,
            referrals7d: a.referrals7d,
            payoutUsd: a.tier.payoutUsd,
          }))}
        />
      </div>
    </div>
  );
}
