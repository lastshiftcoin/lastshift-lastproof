import { NextRequest, NextResponse } from "next/server";
import { classifyWallet, ALLOWLIST } from "@/lib/wallet-policy";

/**
 * POST /api/wallet/classify  { adapterName }
 *
 * Thin server-side wrapper around `classifyWallet` so the client can
 * trust a single source of truth for wallet policy. The classifier
 * itself is pure and could run client-side, but we also call it from
 * the quote/connect gates and want all layers to see the SAME decision
 * — any future tightening (new wallet added, Binance removed, etc.)
 * lands here and propagates for free.
 *
 * GET returns the current allowlist so the UI can render the "Connect"
 * modal with the right set of wallet buttons without shipping the
 * canonical list in client code.
 */
export async function GET() {
  return NextResponse.json({ ok: true, allowlist: ALLOWLIST });
}

export async function POST(req: NextRequest) {
  let body: { adapterName?: string };
  try {
    body = (await req.json()) as { adapterName?: string };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const classification = classifyWallet(body.adapterName ?? null);
  const allowed = classification.tier !== "blocked";

  return NextResponse.json({
    ok: allowed,
    classification,
  });
}
