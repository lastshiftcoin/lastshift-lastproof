import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByWallet } from "@/lib/chads/resolve-phase";
import {
  countAcceptedForWallet,
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

  const [pending, accepted] = await Promise.all([
    countPendingForTarget(wallet),
    countAcceptedForWallet(wallet),
  ]);

  return NextResponse.json({
    ok: true,
    pendingCount: pending,
    armyCount: accepted,
    tier,
  });
}
