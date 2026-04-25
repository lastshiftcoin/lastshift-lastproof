import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import {
  findChadInDirection,
  deleteChadshipDirected,
} from "@/lib/db/chads-adapter";

/**
 * POST /api/chads/remove   body: { chad: "<handle>" }
 *
 * Hard-delete an accepted chadship. Either side can initiate. Instant —
 * no confirmation, no undo, no countdown (per locked design).
 */
export async function POST(req: Request) {
  const session = await readSession();
  const wallet = session?.walletAddress ?? null;

  if (!isChadsEnabled(wallet)) {
    return NextResponse.json({ ok: false, reason: "feature_disabled" }, { status: 404 });
  }
  if (!wallet) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  let body: { chad?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  const chadHandle = body.chad?.toLowerCase();
  if (!chadHandle) {
    return NextResponse.json({ ok: false, reason: "chad_required" }, { status: 400 });
  }

  const chadProfile = await getProfileByHandle(chadHandle);
  if (!chadProfile?.terminalWallet) {
    return NextResponse.json({ ok: false, reason: "chad_unknown" }, { status: 404 });
  }
  const chadWallet = chadProfile.terminalWallet;

  // Verify an accepted row exists in MY direction (I'm the requester,
  // chad is the target — the chad is in MY army). Refuse to delete a
  // pending row here — denying a pending ask goes through
  // /api/chads/respond { action: "deny" }.
  //
  // Directional remove: only the (session → chad) row is touched.
  // The reverse-direction row (chad → session, if any) is left alone
  // — that one belongs to the chad's own army management.
  const existing = await findChadInDirection(wallet, chadWallet);
  if (!existing || existing.status !== "accepted") {
    return NextResponse.json({ ok: false, reason: "not_chads" }, { status: 404 });
  }

  await deleteChadshipDirected(wallet, chadWallet);
  return NextResponse.json({ ok: true });
}
