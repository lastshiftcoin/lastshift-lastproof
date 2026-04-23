/**
 * GET /api/ticker — returns the current $LASTSHFT price + 24h change.
 *
 * Uses GeckoTerminal API v2 (same as Terminal build) for both price and
 * 24h change percentage. Falls back to Jupiter/stub rates if Gecko fails.
 *
 * Response is cached 60s at the edge + client.
 */
import { NextResponse } from "next/server";
import { LASTSHFT_MINT } from "@/lib/constants";
import { getTokenUsdRate } from "@/lib/token-rates";

const GECKO_BASE = "https://api.geckoterminal.com/api/v2/networks/solana";

export async function GET() {
  try {
    // Parallel fetch — same pattern as terminal-build/src/hooks/useTokenData.ts
    const [tokenRes, poolRes] = await Promise.all([
      fetch(`${GECKO_BASE}/tokens/${LASTSHFT_MINT}`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${GECKO_BASE}/tokens/${LASTSHFT_MINT}/pools?page=1`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!tokenRes.ok) throw new Error(`Gecko token ${tokenRes.status}`);

    const tokenData = await tokenRes.json();
    const usd = parseFloat(tokenData?.data?.attributes?.price_usd) || 0;
    if (usd <= 0) throw new Error("Invalid price from Gecko");

    let change24h = 0;
    if (poolRes.ok) {
      const poolData = await poolRes.json();
      const topPool = poolData?.data?.[0];
      change24h =
        parseFloat(topPool?.attributes?.price_change_percentage?.h24) || 0;
    }

    return NextResponse.json(
      { token: "LASTSHFT", usd, change24h },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch {
    // Fallback to Jupiter / stub rate — no 24h change available
    const usd = await getTokenUsdRate("LASTSHFT");
    return NextResponse.json(
      { token: "LASTSHFT", usd, change24h: null },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  }
}
