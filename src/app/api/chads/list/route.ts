import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import {
  listPendingForTarget,
  listAcceptedByRequester,
  listOutgoingByRequester,
} from "@/lib/db/chads-adapter";
import { resolveChadProfiles, resolveChadProfilesOrdered } from "@/lib/chads/profile-batch";

/**
 * GET /api/chads/list?type=<kind>&handle=<handle?>&cursor=<id?>
 *
 * Three modes:
 *   type=pending  (no handle) — session user's incoming pending queue
 *                                (dashboard chads page top section).
 *   type=accepted (no handle) — session user's accepted chads
 *                                (dashboard chads page bottom section).
 *   type=army handle=<h>      — public army view; no session required.
 *
 * Cursor pagination uses the chads.id (descending). Empty array means
 * end of list — frontend's IntersectionObserver goes idle on empty.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const handleParam = url.searchParams.get("handle");
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : undefined;

  const session = await readSession();
  const sessionWallet = session?.walletAddress ?? null;

  // Public army endpoint requires no session — the feature flag still
  // gates it via the master switch (per-wallet override doesn't apply
  // when there's no viewer wallet to override against).
  if (type === "army" && handleParam) {
    if (!isChadsEnabled(sessionWallet)) {
      return NextResponse.json({ ok: false, reason: "feature_disabled" }, { status: 404 });
    }
    const profile = await getProfileByHandle(handleParam.toLowerCase());
    if (!profile?.terminalWallet || !profile.isPaid || !profile.publishedAt) {
      return NextResponse.json({ ok: false, reason: "target_not_active" }, { status: 404 });
    }
    // Public army of profile X = chads X has successfully added.
    // Directional: rows where requester=X, status=accepted; the other
    // operator is always the target_wallet.
    const rows = await listAcceptedByRequester(profile.terminalWallet, cursor);
    const otherWallets = rows.map((r) => r.targetWallet);
    const profiles = await resolveChadProfilesOrdered(otherWallets);
    const lastId = rows.length > 0 ? rows[rows.length - 1]?.id ?? null : null;
    return NextResponse.json({ ok: true, items: profiles, nextCursor: lastId });
  }

  // Authenticated modes: pending / accepted for the session wallet.
  if (!isChadsEnabled(sessionWallet)) {
    return NextResponse.json({ ok: false, reason: "feature_disabled" }, { status: 404 });
  }
  if (!sessionWallet) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  if (type === "pending") {
    const rows = await listPendingForTarget(sessionWallet, cursor);
    const requesterWallets = rows.map((r) => r.requesterWallet);
    const profiles = await resolveChadProfilesOrdered(requesterWallets);
    // Annotate with relationship id so the dashboard knows which row is which
    // for accept/deny calls (those use handles directly, but cursor needs id).
    const lastId = rows.length > 0 ? rows[rows.length - 1]?.id ?? null : null;
    return NextResponse.json({ ok: true, items: profiles, nextCursor: lastId });
  }

  if (type === "accepted") {
    // Session user's own army view on the dashboard = chads they've
    // added (accepted) PLUS asks they've sent that haven't been
    // responded to yet (pending). Pending rows render with the
    // ASK PENDING caption client-side. Sort: id desc (= created_at
    // desc) across both states so the most recent activity is up top.
    //
    // Note: public army surfaces (type=army above) intentionally
    // remain accepted-only — pending is private until the target
    // responds.
    const rows = await listOutgoingByRequester(sessionWallet, cursor);
    const otherWallets = rows.map((r) => r.targetWallet);
    const summaryByWallet = await resolveChadProfiles(otherWallets);
    const items = rows
      .map((r) => {
        const summary = summaryByWallet.get(r.targetWallet);
        if (!summary) return null;
        return { ...summary, status: r.status };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const lastId = rows.length > 0 ? rows[rows.length - 1]?.id ?? null : null;
    return NextResponse.json({ ok: true, items, nextCursor: lastId });
  }

  return NextResponse.json({ ok: false, reason: "bad_type" }, { status: 400 });
}
