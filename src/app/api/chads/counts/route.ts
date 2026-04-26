import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByWallet } from "@/lib/chads/resolve-phase";
import {
  countOutgoingByRequester,
  countPendingForTarget,
} from "@/lib/db/chads-adapter";

/**
 * GET /api/chads/counts
 *
 * Returns the session wallet's pending request count + accepted chad
 * count + tier. Used by the dashboard ChadManagementStrip to render
 * the summary card without server-side prop drilling through
 * DashboardShell/DashboardContent.
 *
 * Returns 404 when the feature is disabled — the strip then renders null.
 */
export async function GET() {
  const session = await readSession();
  const wallet = session?.walletAddress ?? null;

  if (!isChadsEnabled(wallet)) {
    return NextResponse.json({ ok: false, reason: "feature_disabled" }, { status: 404 });
  }
  if (!wallet) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const profile = await getProfileByWallet(wallet);
  const tier = profile?.tier ?? 5;

  // pending = incoming asks targeting me (target=me, status=pending)
  // accepted (dashboard) = my full outgoing list — chads I've added
  //   plus asks I've sent that haven't been responded to yet. The
  //   "Your Chad Army" sidenote on the dashboard reflects this.
  //   Public surfaces (modal target preview, public army strip) use
  //   countAcceptedByRequester instead — accepted-only — so visitors
  //   don't see the operator's pending outgoing state.
  const [pending, accepted] = await Promise.all([
    countPendingForTarget(wallet),
    countOutgoingByRequester(wallet),
  ]);

  return NextResponse.json({
    ok: true,
    pendingCount: pending,
    armyCount: accepted,
    tier,
  });
}
