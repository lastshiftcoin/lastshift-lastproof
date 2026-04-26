/**
 * Recent proofs for the LIVE ticker on /operators.
 *
 * Static-per-pageload. SSR fetches the last N confirmed proofs, the page
 * embeds them in the rendered HTML, and the CSS animation loops the static
 * list forever. Users refresh the page to see new proofs. No polling.
 *
 * Joins `proofs` → `profiles` → `work_items` so the ticker can render the
 * operator handle and project ticker per item.
 */

import { supabaseService } from "../db/client";

export interface TickerProof {
  /** Truncated payer wallet — "9xK…aZ2" form for the ticker chip. */
  shortWallet: string;
  /** Operator's @handle (no @). */
  operatorHandle: string;
  /** Project ticker, e.g. "$BONK". */
  projectTicker: string;
  /** True if this was a DEV verification proof. */
  isDev: boolean;
  /** Relative time since proof confirmed, e.g. "2m ago". */
  timeAgo: string;
}

interface RawRow {
  payer_wallet: string | null;
  kind: string;
  created_at: string;
  confirmed_at: string | null;
  profiles: { handle: string } | null;
  work_items: { ticker: string | null } | null;
}

/**
 * Fetch the last N confirmed proofs. Default 20 items — enough for the
 * ticker to feel "alive" without dominating the SSR payload.
 *
 * Empty array on DB error — page renders an empty ticker rather than
 * throwing. Errors are logged for ops debugging.
 */
export async function getRecentProofs(limit = 20): Promise<TickerProof[]> {
  const { data, error } = await supabaseService()
    .from("proofs")
    .select(
      `
      payer_wallet,
      kind,
      created_at,
      confirmed_at,
      profiles ( handle ),
      work_items ( ticker )
      `,
    )
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<RawRow[]>();

  if (error) {
    console.error("[recent-proofs] error:", error.message);
    return [];
  }

  const now = Date.now();
  return (data ?? [])
    .filter((r) => r.profiles && r.profiles.handle) // skip orphaned rows
    .map((r) => ({
      shortWallet: shortenWallet(r.payer_wallet),
      operatorHandle: r.profiles!.handle,
      projectTicker: formatTicker(r.work_items?.ticker),
      isDev: r.kind === "dev_verification",
      timeAgo: relativeTime(r.confirmed_at ?? r.created_at, now),
    }));
}

// ─── Helpers ─────────────────────────────────────────────────────────

function shortenWallet(wallet: string | null): string {
  if (!wallet) return "anon";
  if (wallet.length <= 8) return wallet;
  return `${wallet.slice(0, 3)}…${wallet.slice(-3)}`;
}

function formatTicker(ticker: string | null | undefined): string {
  if (!ticker) return "—";
  return ticker.startsWith("$") ? ticker.toUpperCase() : `$${ticker.toUpperCase()}`;
}

function relativeTime(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
