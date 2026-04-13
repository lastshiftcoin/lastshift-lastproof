/**
 * GET /api/proof/convert?path=collab&token=LASTSHFT
 *
 * Returns the exact token amount for a proof payment at current live rates.
 * Used by Screen 3 to show users the precise amount to send in their wallet.
 *
 * Response: { ok, usd, token_amount, token, rate_usd }
 */

import { NextRequest } from "next/server";
import { priceFor, type PaymentToken, type PaymentKindPriced } from "@/lib/pricing";
import { getTokenUsdRate } from "@/lib/token-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PATHS = new Set(["collab", "dev"]);
const VALID_TOKENS = new Set(["LASTSHFT", "SOL", "USDT"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  const token = req.nextUrl.searchParams.get("token");

  if (!path || !VALID_PATHS.has(path)) {
    return json({ ok: false, error: "invalid path" }, 400);
  }
  if (!token || !VALID_TOKENS.has(token)) {
    return json({ ok: false, error: "invalid token" }, 400);
  }

  const kind: PaymentKindPriced = path === "dev" ? "dev_verification" : "proof";
  const usd = priceFor(kind, token as PaymentToken);
  const rateUsd = await getTokenUsdRate(token as PaymentToken);
  const tokenAmount = usd / rateUsd;

  return json({
    ok: true,
    usd,
    token_amount: tokenAmount,
    token,
    rate_usd: rateUsd,
  });
}
