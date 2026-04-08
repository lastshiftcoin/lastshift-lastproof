/**
 * $LASTSHFT balance fetcher with per-wallet 60s in-memory cache.
 *
 * Lifted in spirit from the Terminal's `useTokenData` — but the
 * caching lives server-side here so we can keep the Helius key out
 * of the browser. UI calls /api/token/balance, which calls this.
 *
 * Swap to real Helius call when the LASTPROOF Helius key is wired.
 * Stub returns deterministic values based on wallet suffix so tests
 * and the widget can render something sensible in dev.
 */

import { LASTSHFT_MINT } from "./constants";

export interface TokenBalance {
  wallet: string;
  mint: string;
  amount: number; // ui-scaled (already divided by decimals)
  decimals: number;
  fetchedAt: string; // ISO
  source: "stub" | "helius" | "cache";
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: TokenBalance; expiresAt: number }>();

export async function getLastshftBalance(wallet: string): Promise<TokenBalance> {
  const now = Date.now();
  const hit = cache.get(wallet);
  if (hit && hit.expiresAt > now) {
    return { ...hit.value, source: "cache" };
  }

  const fresh = await fetchFromHelius(wallet);
  cache.set(wallet, { value: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh;
}

export function __resetBalanceCache(): void {
  cache.clear();
}

async function fetchFromHelius(wallet: string): Promise<TokenBalance> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    // Dev stub — deterministic by suffix.
    const amount = wallet.endsWith("_DEV")
      ? 50_000
      : wallet.endsWith("_BROKE")
        ? 0
        : wallet.endsWith("_RICH")
          ? 1_250_000
          : 420;
    return {
      wallet,
      mint: LASTSHFT_MINT,
      amount,
      decimals: 6,
      fetchedAt: new Date().toISOString(),
      source: "stub",
    };
  }

  // Real Helius call — left as a TODO marker. Replace with
  // getTokenAccountsByOwner + filter by mint.
  throw new Error("Helius fetch not implemented — set HELIUS_API_KEY or rely on stub");
}
