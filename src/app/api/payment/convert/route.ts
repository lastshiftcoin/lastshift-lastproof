/**
 * GET /api/payment/convert?kind=mint&token=LASTSHFT
 *
 * Returns the exact token amount for a payment at current live rates.
 * Used by the payment modal to show users the precise amount to send.
 */

import { NextRequest } from "next/server";
import { priceFor, type PaymentToken, type PaymentKindPriced } from "@/lib/pricing";
import { getTokenUsdRate } from "@/lib/token-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS = new Set(["subscription", "mint", "handle_change"]);
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
  const kind = req.nextUrl.searchParams.get("kind");
  const token = req.nextUrl.searchParams.get("token");

  if (!kind || !VALID_KINDS.has(kind)) {
    return json({ ok: false, error: "invalid kind" }, 400);
  }
  if (!token || !VALID_TOKENS.has(token)) {
    return json({ ok: false, error: "invalid token" }, 400);
  }

  const usd = priceFor(kind as PaymentKindPriced, token as PaymentToken);
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
