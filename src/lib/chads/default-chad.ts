/**
 * Default-chad seeding — the "Tom from MySpace" pattern.
 *
 * Every paid+published operator starts with @lastshiftfounder in
 * their Chad Army by default, so newly-onboarded users encounter the
 * Chad Management section as a populated surface (which makes the
 * feature self-explanatory) rather than an empty one.
 *
 * Mechanics under the directional model:
 * - Insert a single row: (requester=user, target=founder, status=accepted)
 * - Founder appears in user's army (per directional rule, requester=user
 *   means the user has added the target to their army)
 * - User can Remove at any time via /manage/chads — that hard-deletes
 *   the row, founder is gone from their army
 * - If the user later re-asks the founder via Add Chad, it's a normal
 *   ask flow — the founder must accept manually (no auto-accept)
 *
 * Triggered from /api/profile/publish on first publish + paid state.
 * Backfilled for existing operators via the SQL block in the WORKLOG
 * for this commit.
 */

import { supabaseService } from "@/lib/db/client";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";

const DEFAULT_CHAD_HANDLE = "lastshiftfounder";

/**
 * Insert the default-chad row for a newly-published operator.
 *
 * Skips silently when:
 * - CHADS_ENABLED flag is off
 * - Default chad's profile can't be resolved (handle moved, profile
 *   unpublished, etc.) — guard against orphan auto-adds
 * - The user IS the default chad (founder publishing their own profile;
 *   they don't need themselves in their own army)
 * - A row already exists in this direction (handled by the unique
 *   constraint; duplicate insert error is swallowed)
 *
 * Fire-and-forget. Errors here must NOT fail the publish flow — chad
 * is a discovery layer, not core operator onboarding.
 */
export async function tryAddDefaultChad(userWallet: string): Promise<void> {
  if (!isChadsEnabled(userWallet)) return;

  const founder = await getProfileByHandle(DEFAULT_CHAD_HANDLE);
  if (!founder?.terminalWallet) return;
  if (founder.terminalWallet === userWallet) return;

  // Defensive: only seed when the founder profile is itself active.
  // If the founder is somehow unpaid/unpublished, the lapse-hide rule
  // would mask the row anyway, but skipping the insert keeps the table
  // free of dormant default-chad rows.
  if (!founder.isPaid || !founder.publishedAt) return;

  const { error } = await supabaseService().from("chads").insert({
    requester_wallet: userWallet,
    target_wallet: founder.terminalWallet,
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });
  // Unique-constraint violations (row already exists from a re-publish
  // or backfill collision) and any other DB error are non-fatal.
  if (error) return;
}
