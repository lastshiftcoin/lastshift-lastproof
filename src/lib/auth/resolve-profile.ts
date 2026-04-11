/**
 * Shared helper: resolve the current operator's profile from the session cookie.
 *
 * Used by OAuth callback routes and the verify API to avoid duplicating
 * the session → operator → profile lookup chain.
 */

import { readSession } from "@/lib/session";
import { supabaseService } from "@/lib/db/client";
import { getProfileByOperatorId } from "@/lib/profiles-store";
import type { ProfileRow } from "@/lib/profiles-store";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedProfile {
  profile: ProfileRow;
  sb: SupabaseClient;
  walletAddress: string;
}

/**
 * Returns the authenticated user's profile, supabase client, and wallet.
 * Returns null if session is missing, operator not found, or profile not found.
 */
export async function resolveProfileFromSession(): Promise<ResolvedProfile | null> {
  const session = await readSession();
  if (!session) return null;

  const sb = supabaseService();
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  if (!operator) return null;

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) return null;

  return { profile, sb, walletAddress: session.walletAddress };
}
