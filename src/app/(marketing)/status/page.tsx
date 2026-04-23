import type { Metadata } from "next";
import Link from "next/link";

import updatesData from "../../../../data/updates.json";
import type { UpdateEntry, UpdatesFile, SystemStatus } from "./types";
import "./status.css";

export const metadata: Metadata = {
  title: "Updates -- LASTPROOF",
  description:
    "System status and every update we ship on LASTPROOF. Built in public, shipped in the open.",
};

/**
 * /status -- Updates feed landing page.
 *
 * Layout: hero + system-status bar + latest-update hero card + recent 10
 * feed + "View all updates" CTA + Telegram subscribe strip. Topbar and
 * footer come from (marketing)/layout.tsx.
 *
 * Data source: data/updates.json (schema locked in CLAUDE.md § Updates
 * feed). Commit convention in the same section.
 *
 * System status is currently hardcoded to "operational." Switching to
 * "degraded" or "outage" is a code edit + redeploy -- there is no admin
 * toggle yet by design (low-stakes, rare).
 */

const updates = updatesData as UpdatesFile;

const SYSTEM_STATUS: SystemStatus = "operational";

const STATUS_LABEL: Record<SystemStatus, string> = {
  operational: "All Systems Operational",
  degraded: "Degraded Performance",
  outage: "Service Outage",
};

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-04-18" -> "April 18, 2026" */
function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  return `${MONTH_LONG[m - 1]} ${d}, ${y}`;
}

/** "2026-04-18" -> "Apr 18, 2026" */
function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  return `${MONTH_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

function categoryLabel(cat: UpdateEntry["category"]): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** Last-checked timestamp for the system-status bar. Regenerated at build time. */
function formatLastChecked(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `Last checked: ${y}-${m}-${d} · ${hh}:${mm}`;
}

export default function StatusPage() {
  const latest = updates.entries[0];
  const recent = updates.entries.slice(1, 11);

  return (
    <main className="status-page">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="status-hero">
        <div className="status-hero-eyebrow">STATUS · UPDATES</div>
        <h1>
          What&apos;s new on LAST<span className="orange">PROOF</span>.
        </h1>
        <p className="body-text">
          System status and every update we ship. Built in public, shipped in the open.
        </p>
      </section>

      {/* ═══════════════ SYSTEM STATUS BAR ═══════════════ */}
      <section className={`sys-status ${SYSTEM_STATUS === "operational" ? "" : SYSTEM_STATUS}`} aria-live="polite">
        <div className="sys-status-left">
          <span className="sys-dot" aria-hidden="true"></span>
          <span className="sys-label">{STATUS_LABEL[SYSTEM_STATUS]}</span>
        </div>
        <span className="sys-sub">{formatLastChecked()}</span>
      </section>

      {/* ═══════════════ LATEST UPDATE ═══════════════ */}
      <div className="latest-eyebrow">Latest Update</div>
      <article className="latest-card">
        <div className="latest-meta">
          <span className="latest-version">V{latest.version}</span>
          <span className="latest-date">{formatDateLong(latest.date)}</span>
          <span className={`update-tag ${latest.category}`}>{categoryLabel(latest.category)}</span>
        </div>
        <h2 className="latest-headline">{latest.headline}</h2>
        <p className="latest-copy">{latest.copy}</p>
      </article>

      {/* ═══════════════ RECENT UPDATES FEED ═══════════════ */}
      <div className="feed-header">
        <h2 className="feed-title">Recent Updates</h2>
      </div>

      <section className="feed">
        {recent.map((entry) => (
          <article key={entry.version} className="update">
            <div className="update-side">
              <div className="update-version">V{entry.version}</div>
              <div className="update-date">{formatDateShort(entry.date)}</div>
            </div>
            <div className="update-body">
              <span className={`update-tag ${entry.category}`}>{categoryLabel(entry.category)}</span>
              <p className="update-copy">{entry.copy}</p>
            </div>
          </article>
        ))}
      </section>

      {/* ═══════════════ VIEW ALL CTA ═══════════════ */}
      <div className="view-all">
        <Link href="/status/all">View All Updates →</Link>
        <span className="view-all-sub">
          Full archive grouped by month · {updates.entries.length} entries since V0.0.0
        </span>
      </div>

      {/* ═══════════════ SUBSCRIBE STRIP ═══════════════ */}
      <aside className="subscribe">
        <div className="subscribe-text">
          <span className="subscribe-head">Get updates as they ship</span>
          <span className="subscribe-sub">
            We post every update to the LASTSHIFT Break Room on Telegram.
          </span>
        </div>
        <a href="https://t.me/lastshiftcoinbreakroom" target="_blank" rel="noopener noreferrer">
          Join Telegram →
        </a>
      </aside>
    </main>
  );
}
