import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/db/client";
import {
  RATE_PER_REFERRAL_USD,
  computeAmountOwed,
  formatUsd,
  formatSolscanLink,
} from "@/lib/ambassador-tiers";
import {
  getCurrentWeekWindowPT,
  formatInTz,
  tzOffsetLabel,
} from "@/lib/weekly-window";
import "./report.css";

/**
 * /5k/[reportSlug] — Ambassador report page.
 *
 * Private, noindex. Two distinct views, keyed off `ambassadors.payout_model`:
 *
 *   - `per_referral` (default, 6 of 7 ambassadors):
 *       Flat $0.50 per confirmed referral, paid weekly. AMOUNT OWED panel,
 *       per-referral PAID/PENDING status, payout history with $ amounts.
 *
 *   - `weekly_flat` (Habilamar — $80/mo retainer, 250-referral weekly quota):
 *       Sunday-8pm-PT week boundary, big FOMO progress bar, clickable
 *       referral list (no $ status), payout history (no $ amounts).
 *       Display times rendered in `ambassadors.display_timezone`
 *       (Habilamar → Europe/Istanbul, UTC+3).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type Referral = {
  handle: string;
  ea_number: number | null;
  ea_claimed_at: string | null;
  ambassador_paid_at: string | null;
  ambassador_payout_id: string | null;
};
type Payout = {
  id: string;
  period_start: string;
  period_end: string;
  referral_count: number;
  payout_usd: number | string;
  paid_at: string | null;
  tx_signature: string | null;
};
type Amb = {
  id: string;
  campaign_slug: string;
  report_slug: string;
  tg_handle: string;
  weekly_referral_target?: number | null;
  display_timezone?: string | null;
  weekly_program_started_at?: string | null;
};

export default async function AmbassadorReportPage({ params }: PageProps) {
  const { reportSlug } = await params;
  const sb = supabaseService();

  const { data: amb } = await sb
    .from("ambassadors")
    .select("*")
    .eq("report_slug", reportSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!amb) notFound();

  const payoutModel = (amb.payout_model ?? "per_referral") as
    | "per_referral"
    | "weekly_flat";

  const { data: referrals } = await sb
    .from("profiles")
    .select("handle, ea_number, ea_claimed_at, ambassador_paid_at, ambassador_payout_id")
    .eq("referred_by", amb.campaign_slug)
    .order("ea_claimed_at", { ascending: false });
  const allReferrals: Referral[] = referrals ?? [];

  const { data: payouts } = await sb
    .from("ambassador_payouts")
    .select("*")
    .eq("ambassador_id", amb.id)
    .order("period_end", { ascending: false });
  const allPayouts: Payout[] = payouts ?? [];

  if (payoutModel === "weekly_flat") {
    return (
      <WeeklyFlatReport
        amb={amb}
        allReferrals={allReferrals}
        allPayouts={allPayouts}
      />
    );
  }

  return (
    <PerReferralReport
      amb={amb}
      allReferrals={allReferrals}
      allPayouts={allPayouts}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// PER-REFERRAL VIEW (original report layout, now with clickable handles)
// ───────────────────────────────────────────────────────────────────────────

function PerReferralReport({
  amb,
  allReferrals,
  allPayouts,
}: {
  amb: Amb;
  allReferrals: Referral[];
  allPayouts: Payout[];
}) {
  const unpaidReferrals = allReferrals.filter((r) => !r.ambassador_paid_at);
  const paidReferrals = allReferrals.filter((r) => r.ambassador_paid_at);
  const amountOwed = computeAmountOwed(unpaidReferrals.length);
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

        <div className="rpt-link-box">
          <div className="rpt-link-label">YOUR CAMPAIGN LINK</div>
          {campaignUrl}
        </div>

        <div className={`rpt-tier ${amountOwed > 0 ? "rpt-tier-active" : "rpt-tier-zero"}`}>
          AMOUNT OWED: {formatUsd(amountOwed)}
          {unpaidReferrals.length > 0 && (
            <>
              {" "}&middot; {unpaidReferrals.length} unpaid referral
              {unpaidReferrals.length === 1 ? "" : "s"}
            </>
          )}
        </div>

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
                  <td>
                    <a
                      href={`/@${r.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rpt-tx-link"
                    >
                      @{r.handle}
                    </a>
                  </td>
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

// ───────────────────────────────────────────────────────────────────────────
// WEEKLY-FLAT VIEW (Habilamar — 250/wk quota, Istanbul-time display)
// ───────────────────────────────────────────────────────────────────────────

function WeeklyFlatReport({
  amb,
  allReferrals,
  allPayouts,
}: {
  amb: Amb;
  allReferrals: Referral[];
  allPayouts: Payout[];
}) {
  const tz = amb.display_timezone ?? "America/Los_Angeles";
  const target = amb.weekly_referral_target ?? 250;
  const { start, end } = getCurrentWeekWindowPT();

  // Floor the count at the program start date so historical EA claims
  // from before the new weekly model launched don't pre-fill the bar.
  const programStartMs = amb.weekly_program_started_at
    ? new Date(amb.weekly_program_started_at).getTime()
    : 0;
  const effectiveStartMs = Math.max(start.getTime(), programStartMs);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const weekReferrals = allReferrals.filter((r) => {
    if (!r.ea_claimed_at) return false;
    const t = new Date(r.ea_claimed_at).getTime();
    return t >= effectiveStartMs && t <= endMs;
  });

  const pct = Math.min(100, Math.round((weekReferrals.length / target) * 100));
  const remaining = Math.max(0, target - weekReferrals.length);
  const hitTarget = weekReferrals.length >= target;

  const tzLabel = tzOffsetLabel(tz);
  const startLabel = formatInTz(start, tz);
  const endLabel = formatInTz(end, tz);

  const campaignUrl = `https://lastproof.app/${amb.campaign_slug}`;

  return (
    <div className="rpt-page">
      <div className="rpt-container">
        <div className="rpt-header">
          <div className="rpt-eyebrow">&gt; AMBASSADOR REPORT · WEEKLY</div>
          <h1 className="rpt-title">Hi {amb.tg_handle}</h1>
          <p className="rpt-sub">
            Your weekly goal: <strong>{target} confirmed referrals</strong>. The
            week resets every Sunday at 8:00 PM Pacific. Every paid week shows
            below as a Solscan receipt.
          </p>
        </div>

        <div className="rpt-link-box">
          <div className="rpt-link-label">YOUR CAMPAIGN LINK</div>
          {campaignUrl}
        </div>

        {/* ─── Weekly progress bar (FOMO) ─── */}
        <div className="rpt-week-window">
          THIS WEEK · {startLabel} → {endLabel} ({tzLabel})
        </div>
        <div className={`rpt-progress-card ${hitTarget ? "hit" : "active"}`}>
          <div className="rpt-progress-head">
            <span className="rpt-progress-count">
              {weekReferrals.length}
              <span className="rpt-progress-of">/ {target}</span>
            </span>
            <span className="rpt-progress-pct">{pct}%</span>
          </div>
          <div className="rpt-progress-track">
            <div className="rpt-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="rpt-progress-foot">
            {hitTarget ? (
              <span className="rpt-progress-hit">✓ TARGET HIT — KEEP GOING</span>
            ) : (
              <span>{remaining} more to hit your weekly target</span>
            )}
          </div>
        </div>

        {/* ─── Lifetime stats ─── */}
        <div className="rpt-stats">
          <div className="rpt-stat">
            <div className="rpt-stat-num accent">{weekReferrals.length}</div>
            <div className="rpt-stat-label">THIS WEEK</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{target}</div>
            <div className="rpt-stat-label">WEEKLY TARGET</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num">{allReferrals.length}</div>
            <div className="rpt-stat-label">ALL TIME</div>
          </div>
          <div className="rpt-stat">
            <div className="rpt-stat-num green">
              {allPayouts.filter((p) => p.paid_at).length}
            </div>
            <div className="rpt-stat-label">WEEKS PAID</div>
          </div>
        </div>

        {/* ─── Full referral list, clickable handles ─── */}
        <div className="rpt-section-title">REFERRED PROFILES</div>
        {allReferrals.length === 0 ? (
          <div className="rpt-empty">No referrals yet. Share your campaign link to get started.</div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>HANDLE</th>
                <th>EA #</th>
                <th>CLAIMED ({tzLabel})</th>
                <th>WEEK</th>
              </tr>
            </thead>
            <tbody>
              {allReferrals.map((r, i) => {
                const claimed = r.ea_claimed_at ? new Date(r.ea_claimed_at) : null;
                const inThisWeek = claimed
                  ? claimed.getTime() >= effectiveStartMs && claimed.getTime() <= endMs
                  : false;
                return (
                  <tr key={i}>
                    <td>
                      <a
                        href={`/@${r.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rpt-tx-link"
                      >
                        @{r.handle}
                      </a>
                    </td>
                    <td>{r.ea_number ?? "—"}</td>
                    <td>{claimed ? formatInTz(claimed, tz) : "—"}</td>
                    <td>
                      {inThisWeek ? (
                        <span className="rpt-paid">THIS WEEK</span>
                      ) : (
                        <span style={{ color: "#5a5e73" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ─── Weekly payout history (Solscan receipts, no $) ─── */}
        <div className="rpt-section-title">WEEKLY PAYOUT RECEIPTS</div>
        {allPayouts.length === 0 ? (
          <div className="rpt-empty">No weekly payouts recorded yet.</div>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>WEEK ({tzLabel})</th>
                <th>REFERRALS</th>
                <th>PAID ON</th>
                <th>TX</th>
              </tr>
            </thead>
            <tbody>
              {allPayouts.map((p) => {
                const txUrl = formatSolscanLink(p.tx_signature);
                return (
                  <tr key={p.id}>
                    <td>
                      {formatInTz(new Date(p.period_start), tz, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      –{" "}
                      {formatInTz(new Date(p.period_end), tz, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{p.referral_count}</td>
                    <td>
                      {p.paid_at ? (
                        formatInTz(new Date(p.paid_at), tz)
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
