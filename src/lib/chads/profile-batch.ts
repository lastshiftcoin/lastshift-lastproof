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
 *
 * Two-step query (operators → profiles) instead of a single
 * reverse-relationship select. PostgREST's reverse-FK auto-discovery
 * via `profiles!inner(...)` from the operators side returned empty
 * results in production even when the underlying rows existed; the
 * explicit two-step is more forgiving of relationship-name
 * ambiguity and easier to debug.
 */

import { supabaseService } from "@/lib/db/client";

export interface ChadProfileSummary {
  wallet: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: number;
}

interface OperatorRow {
  id: string;
  terminal_wallet: string;
}

interface ProfileRow {
  operator_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: number | null;
  is_paid: boolean | null;
  published_at: string | null;
}

export async function resolveChadProfiles(
  wallets: string[],
): Promise<Map<string, ChadProfileSummary>> {
  const result = new Map<string, ChadProfileSummary>();
  if (wallets.length === 0) return result;
  const unique = Array.from(new Set(wallets));

  // 1. Look up operators by wallet.
  const { data: operators, error: opErr } = await supabaseService()
    .from("operators")
    .select("id, terminal_wallet")
    .in("terminal_wallet", unique)
    .returns<OperatorRow[]>();
  if (opErr || !operators || operators.length === 0) return result;

  const operatorIdToWallet = new Map<string, string>();
  for (const op of operators) {
    operatorIdToWallet.set(op.id, op.terminal_wallet);
  }

  // 2. Look up active profiles by operator_id. Active filter applied at
  //    the DB layer — only paid AND published rows come back.
  const operatorIds = operators.map((o) => o.id);
  const { data: profiles, error: profErr } = await supabaseService()
    .from("profiles")
    .select(
      "operator_id, handle, display_name, avatar_url, tier, is_paid, published_at",
    )
    .in("operator_id", operatorIds)
    .eq("is_paid", true)
    .not("published_at", "is", null)
    .returns<ProfileRow[]>();
  if (profErr || !profiles) return result;

  for (const p of profiles) {
    const wallet = operatorIdToWallet.get(p.operator_id);
    if (!wallet) continue;
    result.set(wallet, {
      wallet,
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
