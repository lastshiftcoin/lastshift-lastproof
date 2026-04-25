import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import {
  findChadInDirection,
  acceptPending,
  deleteChadshipDirected,
} from "@/lib/db/chads-adapter";

/**
 * POST /api/chads/respond   body: { requester: "<handle>", action: "accept" | "deny" }
 *
 * The session wallet is the TARGET responding to a pending request.
 *
 *   accept → flips the row's status to accepted.
 *   deny   → hard-deletes the row (re-request is then automatically
 *            possible). The requester never learns they were denied
 *            (privacy-of-deny per the locked design — same end-state
 *            UX as ignore).
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

  let body: { requester?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  const requesterHandle = body.requester?.toLowerCase();
  const action = body.action;
  if (!requesterHandle || (action !== "accept" && action !== "deny")) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  const requesterProfile = await getProfileByHandle(requesterHandle);
  if (!requesterProfile?.terminalWallet) {
    return NextResponse.json({ ok: false, reason: "requester_unknown" }, { status: 404 });
  }
  const requesterWallet = requesterProfile.terminalWallet;

  // Verify a pending row exists in the asker→session direction. The
  // session wallet must be the target. The reverse direction (the
  // session's own ask back to the asker, if any) is a separate row
  // and is unaffected by this respond call.
  const existing = await findChadInDirection(requesterWallet, wallet);
  if (!existing || existing.status !== "pending") {
    return NextResponse.json({ ok: false, reason: "no_pending_request" }, { status: 404 });
  }

  if (action === "accept") {
    await acceptPending(requesterWallet, wallet);
  } else {
    // Deny — hard-delete only this directional row.
    await deleteChadshipDirected(requesterWallet, wallet);
  }

  return NextResponse.json({ ok: true });
}
