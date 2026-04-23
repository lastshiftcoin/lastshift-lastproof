import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { runDevPreflight } from "@/lib/dev-preflight";

/**
 * POST /api/dev/preflight
 * Session-gated. Returns { qualified, reason }.
 * UI uses this to show/hide "Pay for DEV verification" button.
 * Webhook ALSO calls runDevPreflight() server-side before accepting the
 * confirmed payment — front-end gate is advisory.
 */
export async function POST(_req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }
  const result = await runDevPreflight(session.walletAddress);
  return NextResponse.json({ ok: true, ...result });
}
