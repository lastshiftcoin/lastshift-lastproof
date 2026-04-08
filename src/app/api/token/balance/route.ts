import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getLastshftBalance } from "@/lib/token-balance";

/**
 * GET /api/token/balance
 * Returns the session wallet's $LASTSHFT balance. 60s server cache.
 * UI polls this on dashboard mount + whenever a subscription payment
 * transitions (tied in via a future invalidate hook).
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }
  const balance = await getLastshftBalance(session.walletAddress);
  return NextResponse.json({ ok: true, balance });
}
