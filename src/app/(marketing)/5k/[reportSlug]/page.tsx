import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/db/client";
import { computePayoutTier } from "@/lib/ambassador-tiers";
import "./report.css";

/**
 * /5k/[reportSlug] — Ambassador report page.
 *
 * Private, noindex. Each ambassador bookmarks their own report URL
 * (e.g. lastproof.app/5k/zerix-ops) to see referral stats and payouts.
 */

interface PageProps {
  params: Promise<{ reportSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reportSlug } = await params;
  return {
    title: `${reportSlug} — Ambassador Report | LASTPROOF`,
    robots: { index: false, follow: false },
  };
}

export default async function AmbassadorReportPage({ params }: PageProps) {
  const { reportSlug } = await params;
  const sb = supabaseService();

  // Look up ambassador by report_slug
  const { data: amb } = await sb
    .from("ambassadors")
    .select("*")
    .eq("report_slug", reportSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!amb) notFound();

  // Fetch referred profiles
  const { data: referrals } = await sb
    .from("profiles")
    .select("handle, ea_number, ea_claimed_at")
    .eq("referred_by", amb.campaign_slug)
    .order("ea_claimed_at", { ascending: false });

  const allReferrals = referrals ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const referrals7d = allReferrals.filter(
    (r) => r.ea_claimed_at && r.ea_claimed_at >= sevenDaysAgo,
  );

  const tier = computePayoutTier(referrals7d.length);

  // Fetch payouts
  const { data: payouts } = await sb
    .from("ambassador_payouts")
    .select("*")
    .eq("ambassador_id", amb.id)
    .order("period_end", { ascending: false });

  const allPayouts = payouts ?? [];
  const totalPaidUsd = allPayouts
    .filter((p) => p.paid_at)
    .reduce((sum, p) => sum + Number(p.payout_usd), 0);

  const campaignUrl = `https://lastproof.app/${amb.campaign_slug}`;

  return (
    <div className="rpt-page">
      <div className="rpt-container">
        <div className="rpt-header">
          <div className="rpt-eyebrow">&gt; AMBASSADOR REPORT</div>
          <h1 className="rpt-title">Hi {amb.tg_handle}</h1>
          <p className="rpt-sub">
            Below is your affiliate referral analytics report.
          </p>
        </div>

        {/* Campaign link */}
        <div className="rpt-link-box">
          <div className="rpt-link-label">YOUR CAMPAIGN LINK</div>
          {campaignUrl}
        </div>

        {/* Payout tier */}
        <div className={`rpt-tier ${tier.payoutUsd > 0 ? "rpt-tier-active" : "rpt-tier-zero"}`}>
          TIER: {tier.label} &middot; ${tier.payoutUsd}/week
        </div>

        {/* Stats */}
        <div className="rpt-stats">
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{referrals7d.length}</div>
            <div className="rpt-stat-label">REFERRALS (7 DAYS)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{allReferrals.length}</div>
            <div className="rpt-stat-label">REFERRALS (ALL TIME)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">${tier.payoutUsd}</div>
            <div className="rpt-stat-label">EARNINGS THIS PERIOD</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">${totalPaidUsd.toFixed(2)}</div>
            <div className="rpt-stat-label">TOTAL EARNED (YTD)</div>
          </div>
        </div>

        {/* Referred profiles */}
        <div className="rpt-section-title">REFERRED PROFILES</div>
        {allReferrals.length === 0 ? (
          <div className="rpt-empty">No referrals yet. Share your campaign link to get started.</div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>HANDLE</th>
                <th>EA #</th>
                <th>CLAIMED</th>
              </tr>
            </thead>
            <tbody>
              {allReferrals.map((r, i) => (
                <tr key={i}>
                  <td>@{r.handle}</td>
                  <td>{r.ea_number ?? "—"}</td>
                  <td>{r.ea_claimed_at ? new Date(r.ea_claimed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Payout history */}
        <div className="rpt-section-title">PAYOUT HISTORY</div>
        {allPayouts.length === 0 ? (
          <div className="rpt-empty">No payouts recorded yet.</div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>PERIOD</th>
                <th>REFERRALS</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>TX</th>
              </tr>
            </thead>
            <tbody>
              {allPayouts.map((p) => (
                <tr key={p.id}>
                  <td>
                    {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                  </td>
                  <td>{p.referral_count}</td>
                  <td>${Number(p.payout_usd).toFixed(2)}</td>
                  <td>
                    {p.paid_at ? (
                      <span className="rpt-paid">PAID</span>
                    ) : (
                      <span className="rpt-unpaid">PENDING</span>
                    )}
                  </td>
                  <td>
                    {p.tx_signature ? (
                      <a
                        href={`https://solscan.io/tx/${p.tx_signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rpt-tx-link"
                      >
                        {p.tx_signature.slice(0, 8)}&hellip;
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
