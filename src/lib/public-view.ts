/**
 * Public profile view projector — expired stripe-down.
 *
 * User rule (verbatim): "stripe down to make them want to pay".
 * Expired public view shows ONLY: avatar, display_name, location, timezone,
 * bio_statement, NON-ACTIVE badge. Everything else hidden.
 *
 * Active/warning view returns the full shape. Dashboards bypass this
 * projector entirely — owners always see their full profile regardless
 * of state.
 *
 * Pure function. Takes a ProfileRow-ish input + now clock. Zero I/O.
 */

import type { ProfileRow } from "./profiles-store";
import { deriveState, type SubscriptionState } from "./subscription";

export interface PublicViewBase {
  handle: string;
  displayName: string | null;
  state: SubscriptionState;
  isPaid: boolean;
}

export interface PublicViewExpired extends PublicViewBase {
  mode: "expired";
  badge: "NON-ACTIVE";
  // All the fields that survive the stripe-down. In skeleton the
  // ProfileRow type only carries a handful; the rest land as the
  // table grows. Keeping the keys here documents the contract.
  avatarUrl: string | null;
  location: string | null;
  timezone: string | null;
  bioStatement: string | null;
}

export interface PublicViewActive extends PublicViewBase {
  mode: "full";
  profile: ProfileRow;
}

export type PublicView = PublicViewExpired | PublicViewActive | null;

export function projectPublicView(
  profile: ProfileRow | null,
  now: Date = new Date(),
): PublicView {
  if (!profile) return null;
  if (!profile.publishedAt) return null; // never published → no public view

  const state = deriveState({ expiresAt: profile.subscriptionExpiresAt, now });

  if (state === "expired" || state === "none") {
    return {
      mode: "expired",
      badge: "NON-ACTIVE",
      handle: profile.handle,
      displayName: profile.displayName,
      state,
      isPaid: false,
      avatarUrl: null,
      location: null,
      timezone: null,
      bioStatement: null,
    };
  }

  return {
    mode: "full",
    handle: profile.handle,
    displayName: profile.displayName,
    state,
    isPaid: true,
    profile,
  };
}
