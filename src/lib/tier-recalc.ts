/**
 * recalcProfileTier — orchestrator that pulls a profile, derives its
 * current tier inputs, calls the pure computeTier, and writes back if
 * the stored tier differs. Safe to call from webhook, cron, or publish.
 *
 * In skeleton the profile store doesn't yet carry proofs/disputes
 * counters — we read defaults (0). Once the proofs table lands in
 * Skeleton #6, this file grows a `countConfirmedProofs(profileId)` call
 * and a `countDisputesLost(profileId)` call. Callers do NOT change.
 */

import { getProfileById, updateProfile } from "./profiles-store";
import { computeTier, type Tier } from "./tier";
import { isPaidNow } from "./subscription";
import { countConfirmedProofs, countDevVerifications } from "./proofs-store";

export interface RecalcResult {
  ok: boolean;
  profileId: string;
  previousTier: Tier | null;
  newTier: Tier | null;
  changed: boolean;
  reason?: string;
}

/**
 * Per-profile micro-cache to collapse recalcs within a single webhook
 * batch. If N proofs land in one delivery, we recalc once and reuse
 * the result for the subsequent calls. 500ms TTL is long enough to
 * span a batch and short enough that a subsequent legitimate call
 * (cron, publish) re-computes freshly. Not a correctness feature —
 * just a hot-loop collapse. Safe because recalc is a pure function
 * of (profile + proofs + now) and all three mutate through writers
 * that invalidate implicitly via the 500ms window.
 */
const RECALC_DEDUPE_TTL_MS = 500;
const recentRecalcs = new Map<string, { at: number; result: RecalcResult }>();

export function __resetTierRecalcCache(): void {
  recentRecalcs.clear();
}

export async function recalcProfileTier(
  profileId: string,
  now: Date = new Date(),
): Promise<RecalcResult> {
  const cached = recentRecalcs.get(profileId);
  if (cached && now.getTime() - cached.at < RECALC_DEDUPE_TTL_MS) {
    return cached.result;
  }
  const profile = await getProfileById(profileId);
  if (!profile) {
    return {
      ok: false,
      profileId,
      previousTier: null,
      newTier: null,
      changed: false,
      reason: "profile_not_found",
    };
  }
  void cached; // keep reference to avoid accidental cache growth on miss

  // Use profile.isPaid — isPaidNow only checks expiry, EA profiles have null expiry
  const paid = profile.isPaid;
  const published = profile.publishedAt !== null;

  const createdAt = new Date(profile.createdAt);
  const accountAgeDays = Math.floor(
    (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );

  const proofsConfirmed =
    (await countConfirmedProofs(profile.id)) +
    (await countDevVerifications(profile.id));

  const newTier = computeTier({
    isPaid: paid,
    isPublished: published,
    proofsConfirmed,
    disputesLost: 0, // TODO: count from disputes table (future skeleton)
    accountAgeDays,
  });

  const previousTier = profile.tier as Tier;
  let result: RecalcResult;
  if (newTier === previousTier) {
    result = { ok: true, profileId, previousTier, newTier, changed: false };
  } else {
    await updateProfile(profile.id, { tier: newTier });
    result = { ok: true, profileId, previousTier, newTier, changed: true };
  }
  recentRecalcs.set(profileId, { at: now.getTime(), result });
  return result;
}
