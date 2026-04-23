/**
 * SPL token + SOL balance fetcher with per-wallet+mint 60s in-memory cache.
 *
 * Uses HELIUS_RPC_URL with getTokenAccountsByOwner / getBalance to fetch real
 * on-chain balance. Falls back to deterministic stubs in dev when
 * no RPC URL is configured.
 */

import { LASTSHFT_MINT, TOKEN_MINTS, TOKEN_DECIMALS } from "./constants";

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

// ─── Generic SPL token balance (USDT etc.) ──────────────────────────────
// Same RPC pattern as fetchBalance() above but parameterized by mint.
// Used by the admin treasury endpoint to read USDT balance.

const splCache = new Map<string, { value: TokenBalance; expiresAt: number }>();

export async function getSplTokenBalance(
  wallet: string,
  mint: string,
  decimals: number,
): Promise<TokenBalance> {
  const cacheKey = `${wallet}:${mint}`;
  const now = Date.now();
  const hit = splCache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return { ...hit.value, source: "cache" };
  }

  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    // No RPC configured — return zero. Admin dashboard will show 0 in dev.
    const zero: TokenBalance = {
      wallet,
      mint,
      amount: 0,
      decimals,
      fetchedAt: new Date().toISOString(),
      source: "stub",
    };
    splCache.set(cacheKey, { value: zero, expiresAt: now + CACHE_TTL_MS });
    return zero;
  }

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { mint }, { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    const json = (await res.json()) as {
      result?: {
        value?: Array<{
          account: { data: { parsed: { info: { tokenAmount: { uiAmount: number; decimals: number } } } } };
        }>;
      };
      error?: { message?: string };
    };

    if (json.error) {
      console.error(`[token-balance] RPC error for ${mint}:`, json.error.message);
      return { wallet, mint, amount: 0, decimals, fetchedAt: new Date().toISOString(), source: "rpc" };
    }

    // Sum all token accounts the wallet owns for this mint (rare, but possible).
    const accounts = json.result?.value ?? [];
    let total = 0;
    for (const acc of accounts) {
      total += acc.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    }

    const fresh: TokenBalance = {
      wallet,
      mint,
      amount: total,
      decimals,
      fetchedAt: new Date().toISOString(),
      source: "rpc",
    };
    splCache.set(cacheKey, { value: fresh, expiresAt: now + CACHE_TTL_MS });
    return fresh;
  } catch (err) {
    console.error(`[token-balance] SPL fetch failed for ${mint}:`, err);
    return { wallet, mint, amount: 0, decimals, fetchedAt: new Date().toISOString(), source: "rpc" };
  }
}

// ─── Native SOL balance ─────────────────────────────────────────────────

const solCache = new Map<string, { value: TokenBalance; expiresAt: number }>();

export async function getSolBalance(wallet: string): Promise<TokenBalance> {
  const now = Date.now();
  const hit = solCache.get(wallet);
  if (hit && hit.expiresAt > now) {
    return { ...hit.value, source: "cache" };
  }

  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    const zero: TokenBalance = {
      wallet,
      mint: TOKEN_MINTS.SOL,
      amount: 0,
      decimals: TOKEN_DECIMALS.SOL,
      fetchedAt: new Date().toISOString(),
      source: "stub",
    };
    solCache.set(wallet, { value: zero, expiresAt: now + CACHE_TTL_MS });
    return zero;
  }

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [wallet],
      }),
      signal: AbortSignal.timeout(5000),
    });

    const json = (await res.json()) as {
      result?: { value: number };
      error?: { message?: string };
    };

    if (json.error) {
      console.error("[token-balance] SOL RPC error:", json.error.message);
      return { wallet, mint: TOKEN_MINTS.SOL, amount: 0, decimals: TOKEN_DECIMALS.SOL, fetchedAt: new Date().toISOString(), source: "rpc" };
    }

    const lamports = json.result?.value ?? 0;
    const sol = lamports / 1_000_000_000;

    const fresh: TokenBalance = {
      wallet,
      mint: TOKEN_MINTS.SOL,
      amount: sol,
      decimals: TOKEN_DECIMALS.SOL,
      fetchedAt: new Date().toISOString(),
      source: "rpc",
    };
    solCache.set(wallet, { value: fresh, expiresAt: now + CACHE_TTL_MS });
    return fresh;
  } catch (err) {
    console.error("[token-balance] SOL fetch failed:", err);
    return { wallet, mint: TOKEN_MINTS.SOL, amount: 0, decimals: TOKEN_DECIMALS.SOL, fetchedAt: new Date().toISOString(), source: "rpc" };
  }
}
