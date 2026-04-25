import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import {
  findChadshipBetween,
  acceptPending,
  deleteChadship,
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

  // Verify a pending row exists in the requester→target direction. The
  // session wallet must be the target; we never let a third party
  // accept/deny on behalf of someone.
  const existing = await findChadshipBetween(requesterWallet, wallet);
  if (
    !existing ||
    existing.status !== "pending" ||
    existing.requesterWallet !== requesterWallet ||
    existing.targetWallet !== wallet
  ) {
    return NextResponse.json({ ok: false, reason: "no_pending_request" }, { status: 404 });
  }

  if (action === "accept") {
    await acceptPending(requesterWallet, wallet);
  } else {
    // Deny — hard-delete row.
    await deleteChadship(requesterWallet, wallet);
  }

  return NextResponse.json({ ok: true });
}
