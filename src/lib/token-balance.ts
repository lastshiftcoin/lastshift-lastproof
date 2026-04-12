/**
 * $LASTSHFT balance fetcher with per-wallet 60s in-memory cache.
 *
 * Uses HELIUS_RPC_URL with getTokenAccountsByOwner to fetch real
 * on-chain balance. Falls back to deterministic stubs in dev when
 * no RPC URL is configured.
 */

import { LASTSHFT_MINT } from "./constants";
import { TOKEN_DECIMALS } from "./constants";

export interface TokenBalance {
  wallet: string;
  mint: string;
  amount: number; // ui-scaled (already divided by decimals)
  decimals: number;
  fetchedAt: string; // ISO
  source: "stub" | "rpc" | "cache";
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: TokenBalance; expiresAt: number }>();

export async function getLastshftBalance(wallet: string): Promise<TokenBalance> {
  const now = Date.now();
  const hit = cache.get(wallet);
  if (hit && hit.expiresAt > now) {
    return { ...hit.value, source: "cache" };
  }

  const fresh = await fetchBalance(wallet);
  cache.set(wallet, { value: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh;
}

export function __resetBalanceCache(): void {
  cache.clear();
}

async function fetchBalance(wallet: string): Promise<TokenBalance> {
  const rpcUrl = process.env.HELIUS_RPC_URL;

  if (!rpcUrl) {
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
      decimals: TOKEN_DECIMALS.LASTSHFT,
      fetchedAt: new Date().toISOString(),
      source: "stub",
    };
  }

  // Real RPC call — getTokenAccountsByOwner filtered by LASTSHFT mint.
  // Same pattern used by the eligibility route for USDT balance checks.
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          { mint: LASTSHFT_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    const json = (await res.json()) as {
      result?: {
        value?: Array<{
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    uiAmount: number;
                    decimals: number;
                  };
                };
              };
            };
          };
        }>;
      };
      error?: { message?: string };
    };

    if (json.error) {
      console.error("[token-balance] RPC error:", json.error.message);
      return zeroBalance(wallet);
    }

    const tokenAccount = json.result?.value?.[0];
    const uiAmount = tokenAccount?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    const decimals = tokenAccount?.account?.data?.parsed?.info?.tokenAmount?.decimals ?? TOKEN_DECIMALS.LASTSHFT;

    return {
      wallet,
      mint: LASTSHFT_MINT,
      amount: uiAmount,
      decimals,
      fetchedAt: new Date().toISOString(),
      source: "rpc",
    };
  } catch (err) {
    console.error("[token-balance] RPC fetch failed:", err);
    return zeroBalance(wallet);
  }
}

function zeroBalance(wallet: string): TokenBalance {
  return {
    wallet,
    mint: LASTSHFT_MINT,
    amount: 0,
    decimals: TOKEN_DECIMALS.LASTSHFT,
    fetchedAt: new Date().toISOString(),
    source: "rpc",
  };
}
