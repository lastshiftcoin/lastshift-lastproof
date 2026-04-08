import { NextRequest, NextResponse } from "next/server";
import { listProfiles, updateProfile } from "@/lib/profiles-store";
import { deriveState } from "@/lib/subscription";
import { insertNotification } from "@/lib/notifications-store";
import { recalcProfileTier } from "@/lib/tier-recalc";
import { sweepExpiredQuotes } from "@/lib/quotes-store";

/**
 * Daily Vercel Cron — 00:05 UTC (see vercel.json).
 *
 * Walks every published profile and:
 *   - flips is_paid=false on any profile whose expiry has passed
 *     (lazy reads already compute state on-the-fly, but we want
 *     the stored flag to reflect reality for Grid queries)
 *   - inserts a `subscription_expired` notification ONCE per transition
 *   - inserts `subscription_warning` notifications when entering the
 *     ≤3-day window (also once per transition)
 *
 * Idempotency: we only write when the STORED is_paid disagrees with the
 * DERIVED state, so re-running the cron is a no-op after the first pass
 * of the day. Warning notifications dedupe via a simple "already have one
 * in the current window" check against notifications-store.
 *
 * Auth: Vercel Cron hits with a bearer of CRON_SECRET. Local dev: allow
 * unauthenticated so `curl /api/subscription/cron` works.
 */

import { listNotifications } from "@/lib/notifications-store";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const profiles = listProfiles().filter((p) => p.publishedAt !== null);

  let expiredFlipped = 0;
  let warningInserted = 0;
  let expiredInserted = 0;

  for (const p of profiles) {
    const state = deriveState({ expiresAt: p.subscriptionExpiresAt, now });

    if ((state === "expired" || state === "none") && p.isPaid) {
      updateProfile(p.id, { isPaid: false });
      recalcProfileTier(p.id, now);
      expiredFlipped++;
      // Only insert expiry notification once — dedupe on kind per profile.
      const existing = listNotifications(p.id).find((n) => n.kind === "subscription_expired");
      if (!existing) {
        insertNotification({
          profileId: p.id,
          kind: "subscription_expired",
          body: "Your LASTPROOF subscription has expired. Reactivate to restore your public profile.",
        });
        expiredInserted++;
      }
    }

    if (state === "warning") {
      // One warning per window — cleared when subscription rolls forward.
      // Pivot on the most recent "window start" event, which is
      // whichever is later: last payment, or the profile publish time
      // (for EA-granted profiles that have never paid). Without the
      // publishedAt fallback, EA warnings would be inserted every cron
      // tick because lastPaymentAt is null.
      const warnings = listNotifications(p.id).filter((n) => n.kind === "subscription_warning");
      const latest = warnings[warnings.length - 1];
      const windowStart =
        p.lastPaymentAt ?? p.publishedAt ?? p.subscriptionStartedAt ?? null;
      const shouldInsert =
        !latest ||
        (windowStart !== null && new Date(latest.createdAt) < new Date(windowStart));
      if (shouldInsert) {
        insertNotification({
          profileId: p.id,
          kind: "subscription_warning",
          body: "Your LASTPROOF subscription expires in under 3 days. Pay now to avoid downtime.",
        });
        warningInserted++;
      }
    }
  }

  // Belt-and-suspenders: flip any stale open quotes to expired so the
  // quotes table reflects reality. Tolerance already rejects expired
  // quotes lazily, but Grid/dev-tool consumers read status directly.
  const quotesSwept = sweepExpiredQuotes(now);

  return NextResponse.json({
    ok: true,
    scanned: profiles.length,
    expiredFlipped,
    warningInserted,
    expiredInserted,
    quotesSwept,
    ranAt: now.toISOString(),
  });
}
