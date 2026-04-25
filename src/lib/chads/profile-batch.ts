/**
 * Batch wallet → profile-summary resolver for the chad UI.
 *
 * Chad list views (public army page, dashboard chads page) render
 * tiles with handle, display name, avatar, and tier per chad. The
 * `chads` table only stores wallet addresses, so we batch-resolve
 * wallets to profile summaries here:
 *
 *   wallets → operators (by terminal_wallet) → profiles (by operator_id)
 *
 * Wallets without an operator row, or operators without a profile,
 * are silently dropped (they'd render nothing useful anyway).
 *
 * Inactive profiles (free / unpublished) are dropped too — per the
 * locked rule, free operators do not appear in anyone's visible
 * Chad Army on either side.
 */

import { supabaseService } from "@/lib/db/client";

export interface ChadProfileSummary {
  wallet: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: number;
}

interface OperatorProfileRow {
  terminal_wallet: string;
  profiles: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    tier: number | null;
    is_paid: boolean | null;
    published_at: string | null;
  } | null;
}

export async function resolveChadProfiles(
  wallets: string[],
): Promise<Map<string, ChadProfileSummary>> {
  const result = new Map<string, ChadProfileSummary>();
  if (wallets.length === 0) return result;
  const unique = Array.from(new Set(wallets));

  const { data, error } = await supabaseService()
    .from("operators")
    .select(
      "terminal_wallet, profiles!inner(handle, display_name, avatar_url, tier, is_paid, published_at)",
    )
    .in("terminal_wallet", unique)
    .returns<OperatorProfileRow[]>();
  if (error) return result;

  for (const row of data ?? []) {
    const p = row.profiles;
    if (!p) continue;
    // Active filter — free/unpublished profiles never appear in armies.
    if (!p.is_paid || !p.published_at) continue;
    result.set(row.terminal_wallet, {
      wallet: row.terminal_wallet,
      handle: p.handle,
      displayName: p.display_name ?? p.handle,
      avatarUrl: p.avatar_url,
      tier: p.tier ?? 1,
    });
  }
  return result;
}

/**
 * Order-preserving variant: takes wallets in display order, returns the
 * subset (in same order) that resolved to active profiles. Used when the
 * caller wants to render exactly the rows they fetched, in order, after
 * dropping wallets whose profiles aren't currently active.
 */
export async function resolveChadProfilesOrdered(
  wallets: string[],
): Promise<ChadProfileSummary[]> {
  const map = await resolveChadProfiles(wallets);
  return wallets.map((w) => map.get(w)).filter((p): p is ChadProfileSummary => Boolean(p));
}
