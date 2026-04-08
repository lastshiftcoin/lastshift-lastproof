/**
 * Token → USD rate source. Dev: deterministic stubs.
 * Prod: replace with Jupiter/Pyth/Birdeye call.
 */
import type { PaymentToken } from "./pricing";

const STUB_RATES: Record<PaymentToken, number> = {
  USDT: 1.0,
  SOL: 150.0, // ~$150/SOL
  LASTSHFT: 0.002, // ~$0.002/LASTSHFT
};

export async function getTokenUsdRate(token: PaymentToken): Promise<number> {
  if (process.env.TOKEN_RATE_SOURCE === "live") {
    throw new Error("live rate source not yet implemented");
  }
  return STUB_RATES[token];
}
