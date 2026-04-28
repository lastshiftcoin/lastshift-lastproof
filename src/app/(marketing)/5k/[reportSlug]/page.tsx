import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/db/client";
import {
  RATE_PER_REFERRAL_USD,
  computeAmountOwed,
  formatUsd,
  formatSolscanLink,
} from "@/lib/ambassador-tiers";
import "./report.css";

/**
 * /5k/[reportSlug] — Ambassador report page.
 *
 * Private, noindex. Each ambassador bookmarks their own report URL
 * (e.g. lastproof.app/5k/zerix-ops) to see referral stats and payouts.
 *
 * Payout model (as of 2026-04-26):
 *   - Flat $0.50 per confirmed referral
 *   - Each referral has a paid/unpaid status (`profiles.ambassador_paid_at`)
 *   - Admin marks unpaid referrals as paid in bulk via /5k/god-ops
 *   - "Amount Owed" = unpaid count × $0.50
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

  // Fetch referred profiles (newest first) including paid status
  const { data: referrals } = await sb
    .from("profiles")
    .select("handle, ea_number, ea_claimed_at, ambassador_paid_at, ambassador_payout_id")
    .eq("referred_by", amb.campaign_slug)
    .order("ea_claimed_at", { ascending: false });

  const allReferrals = referrals ?? [];
  const unpaidReferrals = allReferrals.filter((r) => !r.ambassador_paid_at);
  const paidReferrals = allReferrals.filter((r) => r.ambassador_paid_at);

  const amountOwed = computeAmountOwed(unpaidReferrals.length);

  // Fetch payouts (history table)
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
            Earnings are <strong>{formatUsd(RATE_PER_REFERRAL_USD)} per confirmed referral</strong>,
            paid weekly every Monday.
          </p>
        </div>

        {/* Campaign link */}
        <div className="rpt-link-box">
          <div className="rpt-link-label">YOUR CAMPAIGN LINK</div>
          {campaignUrl}
        </div>

        {/* Amount owed (this period) */}
        <div className={`rpt-tier ${amountOwed > 0 ? "rpt-tier-active" : "rpt-tier-zero"}`}>
          AMOUNT OWED: {formatUsd(amountOwed)}
          {unpaidReferrals.length > 0 && (
            <>
              {" "}&middot; {unpaidReferrals.length} unpaid referral
              {unpaidReferrals.length === 1 ? "" : "s"}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="rpt-stats">
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{unpaidReferrals.length}</div>
            <div className="rpt-stat-label">UNPAID</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{paidReferrals.length}</div>
            <div className="rpt-stat-label">PAID</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{allReferrals.length}</div>
            <div className="rpt-stat-label">REFERRALS (ALL TIME)</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">{formatUsd(totalPaidUsd)}</div>
            <div className="rpt-stat-label">TOTAL EARNED</div>
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
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {allReferrals.map((r, i) => (
                <tr key={i}>
                  <td>@{r.handle}</td>
                  <td>{r.ea_number ?? "—"}</td>
                  <td>{r.ea_claimed_at ? new Date(r.ea_claimed_at).toLocaleDateString() : "—"}</td>
                  <td>
                    {r.ambassador_paid_at ? (
                      <span className="rpt-paid">✓ PAID</span>
                    ) : (
                      <span className="rpt-unpaid">⏳ PENDING</span>
                    )}
                  </td>
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
              {allPayouts.map((p) => {
                const txUrl = formatSolscanLink(p.tx_signature);
                return (
                  <tr key={p.id}>
                    <td>
                      {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                    </td>
                    <td>{p.referral_count}</td>
                    <td>{formatUsd(Number(p.payout_usd))}</td>
                    <td>
                      {p.paid_at ? (
                        <span className="rpt-paid">PAID</span>
                      ) : (
                        <span className="rpt-unpaid">PENDING</span>
                      )}
                    </td>
                    <td>
                      {txUrl ? (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rpt-tx-link"
                        >
                          view on solscan
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
