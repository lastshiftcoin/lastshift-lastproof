/**
 * GET /api/admin/treasury
 *
 * Internal admin endpoint — bearer token gated.
 * Returns the LASTPROOF treasury wallet balances: SOL, USDT, LASTSHFT.
 *
 * Auth: `Authorization: Bearer ${LASTPROOF_ADMIN_API_TOKEN}` (env var, set in Vercel)
 *
 * All balance fetches go through src/lib/token-balance.ts which has a 60s
 * in-memory cache per (wallet, mint), so repeated dashboard refreshes are cheap.
 */

import { NextResponse } from "next/server";
import { getLastshftBalance, getSolBalance, getSplTokenBalance } from "@/lib/token-balance";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.LASTPROOF_ADMIN_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return forbidden();

  const treasury =
    process.env.LASTPROOF_AR_WALLET ?? process.env.TREASURY_WALLET ?? "";

  if (!treasury) {
    return NextResponse.json(
      { error: "config_error", message: "LASTPROOF_AR_WALLET not configured" },
      { status: 500 },
    );
  }

  try {
    const [sol, usdt, lastshft] = await Promise.all([
      getSolBalance(treasury),
      getSplTokenBalance(treasury, TOKEN_MINTS.USDT, TOKEN_DECIMALS.USDT),
      getLastshftBalance(treasury),
    ]);

    return NextResponse.json({
      address: treasury,
      sol: { amount: sol.amount, decimals: sol.decimals, source: sol.source },
      usdt: { amount: usdt.amount, decimals: usdt.decimals, source: usdt.source },
      lastshft: { amount: lastshft.amount, decimals: lastshft.decimals, source: lastshft.source },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/treasury] unexpected error:", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
