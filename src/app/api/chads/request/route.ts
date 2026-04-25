import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import { getProfileByWallet } from "@/lib/chads/resolve-phase";
import {
  findChadshipBetween,
  insertPendingRequest,
} from "@/lib/db/chads-adapter";

/**
 * POST /api/chads/request   body: { target: "<handle>" }
 *
 * Insert a pending chad request from the session wallet to the target.
 * Idempotency is enforced by the unique (requester, target) constraint
 * — a duplicate request returns 409.
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

  let body: { target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  const targetHandle = body.target?.toLowerCase();
  if (!targetHandle) {
    return NextResponse.json({ ok: false, reason: "target_required" }, { status: 400 });
  }

  const targetProfile = await getProfileByHandle(targetHandle);
  if (!targetProfile?.terminalWallet || !targetProfile.isPaid || !targetProfile.publishedAt) {
    return NextResponse.json({ ok: false, reason: "target_not_active" }, { status: 404 });
  }
  const targetWallet = targetProfile.terminalWallet;

  if (wallet === targetWallet) {
    return NextResponse.json({ ok: false, reason: "self_chad" }, { status: 400 });
  }

  const viewerProfile = await getProfileByWallet(wallet);
  if (!viewerProfile) {
    return NextResponse.json({ ok: false, reason: "no_profile" }, { status: 403 });
  }
  if (!viewerProfile.isPaid || !viewerProfile.publishedAt) {
    return NextResponse.json({ ok: false, reason: "free_profile" }, { status: 403 });
  }

  const existing = await findChadshipBetween(wallet, targetWallet);
  if (existing) {
    return NextResponse.json({ ok: false, reason: "already_exists" }, { status: 409 });
  }

  await insertPendingRequest(wallet, targetWallet);

  return NextResponse.json({ ok: true });
}
