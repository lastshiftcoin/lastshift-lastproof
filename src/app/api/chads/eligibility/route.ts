import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { resolveChadPhase } from "@/lib/chads/resolve-phase";
import { countAcceptedForWallet } from "@/lib/db/chads-adapter";

/**
 * GET /api/chads/eligibility?target=<handle>
 *
 * Resolves the modal phase the viewer should see for this target. Returns
 * 404 when the target isn't an active chad-eligible profile (no profile,
 * free, or unpublished — the static "+ ADD CHAD" button shouldn't have
 * been rendered against such a target in the first place).
 */
export async function GET(req: Request) {
  const session = await readSession();
  const wallet = session?.walletAddress ?? null;

  if (!isChadsEnabled(wallet)) {
    return NextResponse.json({ ok: false, reason: "feature_disabled" }, { status: 404 });
  }

  if (!wallet) {
    // No connected wallet — modal stays in the client-side "connect" phase
    // and never hits this endpoint, but defensive 401 if it does.
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const target = new URL(req.url).searchParams.get("target");
  if (!target) {
    return NextResponse.json({ ok: false, reason: "target_required" }, { status: 400 });
  }

  const resolution = await resolveChadPhase(
    wallet,
    target,
    countAcceptedForWallet,
  );
  if (!resolution) {
    return NextResponse.json({ ok: false, reason: "target_not_active" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, resolution });
}
