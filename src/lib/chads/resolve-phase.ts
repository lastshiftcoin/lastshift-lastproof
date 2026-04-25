/**
 * Chad eligibility resolver — given a viewer wallet + target handle,
 * returns one of the steady-state phases the modal renders.
 *
 * Six steady-state phases come from this resolver:
 *
 *   eligible    — viewer is paid+published, target is paid+published, no
 *                 relationship in the DB. Modal shows "Join Chad Army Request".
 *   already     — accepted chadship row exists between the two wallets.
 *                 Modal shows the view-state.
 *   pending     — pending row exists between the two wallets in either
 *                 direction. Modal shows "Request Pending".
 *   free        — viewer's wallet has a profile, but profile is free
 *                 (not paid OR not published). Modal shows the purple
 *                 upgrade nudge.
 *   no-profile  — viewer's wallet has no profile at all. Modal shows
 *                 "Create a LASTPROOF profile" CTA → /manage.
 *   own         — viewer's wallet IS the target's wallet. Modal shows
 *                 a soft dead-end ("That's your profile").
 *
 * Three additional phases are pure client-side transients and never
 * come from this function:
 *   connect     — no wallet attached (modal opens before any API call).
 *   checking    — request in flight to this resolver.
 *   submitting  — request in flight to /api/chads/request.
 *   success     — /api/chads/request returned 200; modal shows the
 *                 confirmation screen.
 *
 * If the TARGET handle does not resolve to an active profile (no
 * profile, free, or unpublished), this function returns null. The
 * /api/chads/eligibility route maps that to a 404 — the static "+ ADD
 * CHAD" button shouldn't have been rendered against a non-active
 * profile in the first place, so a hit here is an edge case (e.g. a
 * race during a profile being unpublished mid-modal).
 */

import { supabaseService } from "@/lib/db/client";
import { getProfileByHandle, getProfileByOperatorId } from "@/lib/db/profiles-adapter";
import type { ProfileRow } from "@/lib/profiles-store";
import { findChadshipBetween } from "@/lib/db/chads-adapter";

export type ChadPhase =
  | "eligible"
  | "already"
  | "pending"
  | "free"
  | "no-profile"
  | "own";

export interface PhaseResolution {
  phase: ChadPhase;
  viewer: {
    wallet: string;
    handle: string | null;
    displayName: string | null;
  };
  target: {
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    tier: number;
    armyCount: number;
  };
  /** ISO timestamp when the chadship was accepted; null unless phase==="already". */
  relationshipSince: string | null;
}

function isActive(p: ProfileRow | null | undefined): boolean {
  if (!p) return false;
  return Boolean(p.isPaid && p.publishedAt);
}

/** Resolve a wallet to its profile via the operators table. Returns null
 *  if the wallet has no operator row or no profile attached. */
export async function getProfileByWallet(
  wallet: string,
): Promise<ProfileRow | null> {
  const { data: operator, error } = await supabaseService()
    .from("operators")
    .select("id")
    .eq("terminal_wallet", wallet)
    .maybeSingle();
  if (error) return null;
  if (!operator?.id) return null;
  return getProfileByOperatorId(operator.id);
}

export async function resolveChadPhase(
  viewerWallet: string,
  targetHandle: string,
  armyCounter?: (wallet: string) => Promise<number>,
): Promise<PhaseResolution | null> {
  const targetProfile = await getProfileByHandle(targetHandle.toLowerCase());
  if (!isActive(targetProfile) || !targetProfile?.terminalWallet) {
    return null;
  }
  const targetWallet = targetProfile.terminalWallet;
  const armyCount = armyCounter ? await armyCounter(targetWallet) : 0;

  const targetSummary = {
    handle: targetProfile.handle,
    displayName: targetProfile.displayName ?? targetProfile.handle,
    avatarUrl: targetProfile.avatarUrl,
    tier: targetProfile.tier ?? 1,
    armyCount,
  };

  // Self-chad guard.
  if (viewerWallet === targetWallet) {
    return {
      phase: "own",
      viewer: { wallet: viewerWallet, handle: null, displayName: null },
      target: targetSummary,
      relationshipSince: null,
    };
  }

  const viewerProfile = await getProfileByWallet(viewerWallet);
  const viewerSummary = {
    wallet: viewerWallet,
    handle: viewerProfile?.handle ?? null,
    displayName: viewerProfile?.displayName ?? null,
  };

  if (!viewerProfile) {
    return {
      phase: "no-profile",
      viewer: viewerSummary,
      target: targetSummary,
      relationshipSince: null,
    };
  }

  if (!isActive(viewerProfile)) {
    return {
      phase: "free",
      viewer: viewerSummary,
      target: targetSummary,
      relationshipSince: null,
    };
  }

  // Viewer + target are both active; check relationship.
  const existing = await findChadshipBetween(viewerWallet, targetWallet);
  if (existing) {
    if (existing.status === "accepted") {
      return {
        phase: "already",
        viewer: viewerSummary,
        target: targetSummary,
        relationshipSince: existing.acceptedAt,
      };
    }
    return {
      phase: "pending",
      viewer: viewerSummary,
      target: targetSummary,
      relationshipSince: null,
    };
  }

  return {
    phase: "eligible",
    viewer: viewerSummary,
    target: targetSummary,
    relationshipSince: null,
  };
}
