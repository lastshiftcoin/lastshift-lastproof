/**
 * Fire-and-forget observability for the ambassador referral pipeline.
 *
 * Every attribution decision point calls logReferralEvent so we can
 * reconstruct the funnel and spot drops. Writes never block or throw
 * into the caller — if Supabase is unavailable we log to stderr and
 * move on. The real auth/claim request must never fail because logging
 * failed.
 *
 * Storage: public.referral_events (see migration 0019).
 * Funnel view: public.referral_funnel_daily.
 */

import { supabaseService } from "@/lib/db/client";

export type ReferralEventType =
  | "landing_visit"
  | "wallet_gate"
  | "register_tid"
  | "campaign_claim"
  | "attribution_drop";

export type ReferralEventSource =
  | "operator"  // pre-stamped on operators row
  | "body"      // request body (URL param relayed by client)
  | "cookie"    // lp_ref cookie (legacy)
  | "url"       // directly read from request URL (server-side)
  | "none";     // no ref observed

export type ReferralEventOutcome =
  | "stamped"          // we wrote/propagated attribution
  | "already_stamped"  // operator already had a ref — first-touch wins, we did nothing
  | "invalid_slug"     // slug didn't match any active ambassador
  | "no_ref"           // no slug in the request at all
  | "error";           // something broke mid-flow

export interface ReferralEventInput {
  type: ReferralEventType;
  campaignSlug?: string | null;
  walletAddress?: string | null;
  operatorId?: string | null;
  source?: ReferralEventSource | null;
  outcome?: ReferralEventOutcome | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log an event. Awaitable but safe to fire-and-forget — it always
 * resolves, never rejects. Callers that don't await will not leak
 * unhandled rejections.
 */
export async function logReferralEvent(event: ReferralEventInput): Promise<void> {
  try {
    const { error } = await supabaseService()
      .from("referral_events")
      .insert({
        event_type: event.type,
        campaign_slug: event.campaignSlug ?? null,
        wallet_address: event.walletAddress ?? null,
        operator_id: event.operatorId ?? null,
        source: event.source ?? null,
        outcome: event.outcome ?? null,
        metadata: event.metadata ?? {},
      });
    if (error) {
      console.error(
        `[referral-events] insert failed (${event.type}):`,
        error.message,
      );
    }
  } catch (e) {
    console.error(
      `[referral-events] insert threw (${event.type}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
