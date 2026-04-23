import { NextRequest, NextResponse } from "next/server";
import { validateTerminalId } from "@/lib/terminal-client";
import { writeSession } from "@/lib/session";

/**
 * POST /api/auth/validate-tid
 * Body: { walletAddress, terminalId, scenario? }
 *
 * Round-trips through lib/terminal-client → Terminal (or local mock), and on
 * success writes the session cookie so /manage and /dashboard can read it.
 *
 * `scenario` is a dev-only passthrough for hitting every branch of the mock;
 * stripped in non-mock deployments by the client (ignored by the real endpoint).
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; terminalId?: string; scenario?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const walletAddress = (body.walletAddress || "").trim();
  const terminalId = (body.terminalId || "").trim().toUpperCase();

  if (!walletAddress) {
    return NextResponse.json({ error: "wallet_required" }, { status: 400 });
  }
  // Accepts both real Terminal format XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of
  // 4 alphanum, no fixed prefix) and legacy SHIFT-XXXX-XXXX-XXXX-XXXX for
  // backward-compat with existing seed/test fixtures. Matches the dual-accept
  // pattern in /api/auth/register-tid so both auth entry points agree on
  // which TIDs are well-formed.
  if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/.test(terminalId) &&
      !/^SHIFT-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(terminalId)) {
    return NextResponse.json({ error: "tid_malformed" }, { status: 400 });
  }

  const result = await validateTerminalId(walletAddress, terminalId, {
    skipCache: true,
    mockScenario: body.scenario,
  });

  if (!result.valid) {
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        message: result.message,
        httpStatus: result.httpStatus,
        retryAfterSec: "retryAfterSec" in result ? result.retryAfterSec : undefined,
      },
      { status: result.httpStatus || 400 },
    );
  }

  await writeSession({
    walletAddress: result.walletAddress,
    terminalId: result.terminalId,
    firstFiveThousand: result.firstFiveThousand,
    freeSubUntil: result.freeSubUntil,
    subscriptionStatus: result.subscriptionStatus,
    verified: result.verified,
    displayName: result.displayName,
  });

  return NextResponse.json({
    ok: true,
    session: {
      walletAddress: result.walletAddress,
      terminalId: result.terminalId,
      firstFiveThousand: result.firstFiveThousand,
      freeSubUntil: result.freeSubUntil,
      subscriptionStatus: result.subscriptionStatus,
      verified: result.verified,
      displayName: result.displayName,
    },
  });
}
