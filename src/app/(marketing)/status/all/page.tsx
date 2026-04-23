import type { Metadata } from "next";
import Link from "next/link";

import updatesData from "../../../../../data/updates.json";
import type { UpdateEntry, UpdatesFile } from "../types";
import "../status.css";

export const metadata: Metadata = {
  title: "All Updates -- LASTPROOF",
  description:
    "Full archive of every update shipped on LASTPROOF since launch. Grouped by month, reverse chronological.",
};

/**
 * /status/all -- full Updates archive.
 *
 * Groups all entries by YYYY-MM (newest group first, entries newest-first
 * within each group). Each group is a native <details> element so users
 * can collapse older months.
 *
 * Data source + commit convention: CLAUDE.md § Updates feed.
 */

const updates = updatesData as UpdatesFile;

const GRID_LAUNCH_ISO = "2026-05-08";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  return `${MONTH_SHORT[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
}

function categoryLabel(cat: UpdateEntry["category"]): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

interface MonthGroup {
  key: string;        // "2026-04"
  label: string;      // "April 2026"
  entries: UpdateEntry[];
  versionRange: string; // "V0.0.0 → V0.6.2"
}

/**
 * Group entries by YYYY-MM. Entries are already newest-first in the input,
 * so entries within each group stay newest-first. Groups themselves are
 * emitted newest-first too (sorted descending by key).
 */
function groupByMonth(entries: UpdateEntry[]): MonthGroup[] {
  const map = new Map<string, UpdateEntry[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7); // "2026-04"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  const keys = Array.from(map.keys()).sort().reverse();
  return keys.map((key) => {
    const groupEntries = map.get(key)!;
    const [y, m] = key.split("-").map((p) => parseInt(p, 10));
    const label = `${MONTH_LONG[m - 1]} ${y}`;
    // Version range within the month: newest first, so last is oldest
    const newest = groupEntries[0].version;
    const oldest = groupEntries[groupEntries.length - 1].version;
    const versionRange = newest === oldest ? `V${newest}` : `V${oldest} → V${newest}`;
    return { key, label, entries: groupEntries, versionRange };
  });
}

export default function StatusArchivePage() {
  const groups = groupByMonth(updates.entries);
  const total = updates.entries.length;

  return (
    <main className="status-page">
      {/* ═══════════════ BREADCRUMB ═══════════════ */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/status">Status</Link>
        <span className="sep">/</span>
        <span className="current">All Updates</span>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="archive-hero">
        <div className="status-hero-eyebrow">FULL ARCHIVE</div>
        <h1>Every update, ever shipped.</h1>
        <p className="body-text">
          Complete history of LAST<span className="orange">PROOF</span> since V0.0.0, grouped by month.
          New to LASTPROOF? Start at the bottom for the launch, scroll up for what&apos;s new.
        </p>
      </section>

      {/* ═══════════════ STATS STRIP ═══════════════ */}
      <section className="stats-strip">
        <div className="stat">
          <span className="stat-value">
            <span className="orange">{total}</span> updates
          </span>
          <span className="stat-label">Since V0.0.0</span>
        </div>
        <div className="stat">
          <span className="stat-value">V{updates.latest_version}</span>
          <span className="stat-label">Current Version</span>
        </div>
        <div className="stat">
          <span className="stat-value">V1.0.0</span>
          <span className="stat-label">Grid Launch · {GRID_LAUNCH_ISO}</span>
        </div>
      </section>

      {/* ═══════════════ MONTH GROUPS ═══════════════ */}
      {groups.map((group, idx) => (
        <details key={group.key} className="month-group" open={idx === 0}>
          <summary className="month-header">
            <div className="month-header-left">
              <span className="month-title">{group.label}</span>
              <span className="month-meta">
                <span className="orange">{group.entries.length}</span>
                {group.entries.length === 1 ? " update" : " updates"} · {group.versionRange}
              </span>
            </div>
            <span className="month-toggle">
              Collapse <span className="chevron"></span>
            </span>
          </summary>
          <div className="month-body">
            {group.entries.map((entry) => (
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
          </div>
        </details>
      ))}

      {/* ═══════════════ BACK CTA ═══════════════ */}
      <div className="back-cta">
        <Link href="/status">← Back to /status</Link>
      </div>
    </main>
  );
}
