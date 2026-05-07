"use client";

/**
 * AnnouncementsBoard — dashboard announcements strip.
 *
 * Wireframe: wireframes/lastproof-dashboard-message-center.html (v0.3)
 * Lives directly under StatusBar on the dashboard.
 *
 * V1 (this file): hardcoded ANNOUNCEMENTS array — edit the file to
 *   add/remove messages. Dismiss state persists per-wallet in
 *   localStorage. When all messages are dismissed, the whole card
 *   hides (no empty-state UI).
 *
 * V2 (later): promote to a `dashboard_announcements` Supabase table
 *   with audience targeting + admin UI. The Announcement type and
 *   layout below are stable so the migration is mechanical.
 */

import { useEffect, useState } from "react";

type AnnouncementColor = "default" | "green" | "gold" | "red" | "purple";

interface Announcement {
  /** Stable ID — used for per-wallet dismiss tracking. Never rename. */
  id: string;
  color: AnnouncementColor;
  tag: string;
  title: string;
  sub: string;
}

/* ═══ ANNOUNCEMENTS POOL ═══════════════════════════════════════════════
   Edit this array to add/remove messages. Order = display order.
   Pick a stable `id` and never change it (changing breaks dismiss
   tracking — users who dismissed it would see it again). */
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "proofs-tier-up-2026-05",
    color: "green",
    tag: "PROOFS",
    title: "10 proofs to TIER 2. Start with one.",
    sub:
      "Stack proofs to climb the Grid. Past collaborators drop $1 standard proofs. " +
      "Past project devs drop $5 DEV proofs. Devs hire from the top down — climb.",
  },
  {
    id: "flywheel-hold-invite-2026-05",
    color: "gold",
    tag: "FLYWHEEL",
    title: "More profiles. More proofs. More holders. Everyone wins.",
    sub:
      "Hold $LASTSHFT. Bring your web3 crew in before the 5,000 cap closes. " +
      "Every profile pumps proof volume. Every proof feeds the burn. " +
      "Every holder strengthens the floor. The flywheel only spins if we all push.",
  },
];

interface Props {
  /** Wallet address — used to scope dismiss state per-wallet within
   *  the same browser. Required so a user with two wallets sees fresh
   *  announcements on each one. */
  walletAddress: string;
}

const STORAGE_KEY_PREFIX = "lp_dismissed_announcements:";

function readDismissed(wallet: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + wallet);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(wallet: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + wallet,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // localStorage quota / disabled — silent failure is fine, message
    // just shows again next visit.
  }
}

export function AnnouncementsBoard({ walletAddress }: Props) {
  // Hydration safety: render nothing on first paint, then fill in
  // after we know what's been dismissed. Prevents a flash of a
  // dismissed announcement before localStorage is read.
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed(walletAddress));
    setHydrated(true);
  }, [walletAddress]);

  const visible = hydrated
    ? ANNOUNCEMENTS.filter((a) => !dismissed.has(a.id))
    : [];

  // Hide the entire card when there's nothing to show — keeps the
  // dashboard clean for users who dismissed everything.
  if (!hydrated || visible.length === 0) return null;

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(walletAddress, next);
  }

  return (
    <div className="ann-board">
      <div className="ann-header">
        <span className="ann-header-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="13" y2="17" />
          </svg>
        </span>
        <span className="ann-header-title">LASTPROOF ANNOUNCEMENTS</span>
      </div>
      <div className="ann-list">
        {visible.map((a) => (
          <div key={a.id} className={`ann-msg ann-color-${a.color}`}>
            <div className="ann-msg-body">
              <div className="ann-msg-meta">
                <span className="ann-msg-tag">{a.tag}</span>
              </div>
              <h3 className="ann-msg-title">{a.title}</h3>
              <p className="ann-msg-sub">{a.sub}</p>
            </div>
            <button
              type="button"
              className="ann-msg-dismiss"
              title="Dismiss"
              aria-label={`Dismiss announcement: ${a.title}`}
              onClick={() => dismiss(a.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
