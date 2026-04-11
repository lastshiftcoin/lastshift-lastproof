import type { Metadata } from "next";
import Link from "next/link";
import { StatsCopyLink } from "./StatsCopyLink";
import "../affiliate.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Ambassador Stats — ${slug} | LASTPROOF` };
}

export default async function AmbassadorStatsPage({ params }: PageProps) {
  const { slug } = await params;

  // Placeholder stats — in production, fetch from backend via ref tracking
  const stats = {
    terminalIds: 47,
    profilesCompleted: 31,
    conversionRate: 65.9,
  };

  return (
    <div className="af-page">
      {/* ═══ TOP BAR ═══ */}
      <div className="af-topbar">
        <div className="af-topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="af-topbar-logo" style={{ width: 24, height: 24 }} />
          <span className="af-topbar-text">LASTSHIFT</span>
        </div>
        <Link href={`/lastproof/${slug}`} className="af-topbar-back">
          &larr; Landing Page
        </Link>
      </div>

      <div className="af-stats-container">
        {/* ═══ HEADER ═══ */}
        <div className="af-stats-header">
          <div className="af-stats-label">Ambassador Stats</div>
          <h1 className="af-stats-title">{slug}</h1>
          <Link href={`/lastproof/${slug}`} className="af-stats-link">
            lastproof.app/{slug}
          </Link>
        </div>

        {/* ═══ STAT CARDS ═══ */}
        <div className="af-stats-grid">
          <div className="af-stat-card">
            <span className="af-stat-label">Terminal IDs Created</span>
            <span className="af-stat-value">{stats.terminalIds}</span>
          </div>
          <div className="af-stat-card">
            <span className="af-stat-label">LASTPROOF Profiles Completed</span>
            <span className="af-stat-value accent">{stats.profilesCompleted}</span>
          </div>
          <div className="af-stat-card">
            <span className="af-stat-label">Conversion Rate</span>
            <span className="af-stat-value green">{stats.conversionRate}%</span>
          </div>
        </div>

        {/* ═══ REFERRAL LINK ═══ */}
        <StatsCopyLink slug={slug} />

        {/* ═══ LAST UPDATED ═══ */}
        <div className="af-stats-updated">
          Last updated: {new Date().toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer className="af-footer" style={{ marginTop: 40 }}>
          <div className="af-footer-brand">
            <Link href="https://lastshift.ai" className="af-footer-link">
              lastshift.ai — a company of vibe coders
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
