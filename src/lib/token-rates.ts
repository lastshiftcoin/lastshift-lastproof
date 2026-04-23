/**
 * Token → USD rate source.
 *
 * Modes (via TOKEN_RATE_SOURCE env):
 *   - "live"  → Jupiter Price API v2 with 60s in-memory cache
 *   - default → deterministic stubs for dev/testing
 *
 * USDT is always pegged at $1.00 regardless of mode.
 */
import type { PaymentToken } from "./pricing";
import { TOKEN_MINTS } from "./constants";

const STUB_RATES: Record<PaymentToken, number> = {
  USDT: 1.0,
  SOL: 150.0,
  LASTSHFT: 0.002,
};

// ─── In-memory cache ──────────────────────────────────────────────────
interface CachedRate {
  usd: number;
  fetchedAt: number;
}

const cache = new Map<PaymentToken, CachedRate>();
const CACHE_TTL_MS = 60_000; // 60 seconds

// ─── Price APIs ──────────────────────────────────────────────────────
// Jupiter Price API v2 for SOL/USDT (listed tokens).
// Raydium Price API for LASTSHFT (minted via Raydium, not listed on Jupiter).
const JUPITER_PRICE_URL = "https://api.jup.ag/price/v2";
const RAYDIUM_PRICE_URL = "https://api-v3.raydium.io/mint/price";

// Mint addresses for price lookups — SOL uses the wrapped SOL mint
const PRICE_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  LASTSHFT: TOKEN_MINTS.LASTSHFT,
  USDT: TOKEN_MINTS.USDT,
};

async function fetchFromJupiter(mint: string): Promise<number | null> {
  const res = await fetch(`${JUPITER_PRICE_URL}?ids=${mint}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: Record<string, { price?: string }>;
  };
  const priceStr = data?.data?.[mint]?.price;
  if (!priceStr) return null;
  const usd = parseFloat(priceStr);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

async function fetchFromRaydium(mint: string): Promise<number | null> {
  const res = await fetch(`${RAYDIUM_PRICE_URL}?mints=${mint}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    success?: boolean;
    data?: Record<string, string>;
  };
  if (!data?.success) return null;
  const priceStr = data.data?.[mint];
  if (!priceStr) return null;
  const usd = parseFloat(priceStr);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

async function fetchLiveRate(token: PaymentToken): Promise<number> {
  // USDT is always $1
  if (token === "USDT") return 1.0;

  // Check cache
  const cached = cache.get(token);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.usd;
  }

  const mint = PRICE_MINTS[token];
  if (!mint) {
    console.warn(`[token-rates] no mint for ${token}, falling back to stub`);
    return STUB_RATES[token];
  }

  try {
    // LASTSHFT is on Raydium, SOL/USDT on Jupiter. Try the primary
    // source first, fall back to the other if it fails.
    let usd: number | null = null;
    if (token === "LASTSHFT") {
      usd = await fetchFromRaydium(mint);
      if (usd == null) usd = await fetchFromJupiter(mint);
    } else {
      usd = await fetchFromJupiter(mint);
      if (usd == null) usd = await fetchFromRaydium(mint);
    }

    if (usd != null) {
      cache.set(token, { usd, fetchedAt: Date.now() });
      return usd;
    }

    console.warn(`[token-rates] no live price for ${token}, using fallback`);
    return cached?.usd ?? STUB_RATES[token];
  } catch (err) {
    console.error(`[token-rates] price fetch failed for ${token}:`, err);
    return cached?.usd ?? STUB_RATES[token];
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export async function getTokenUsdRate(token: PaymentToken): Promise<number> {
  if (process.env.TOKEN_RATE_SOURCE === "live") {
    return fetchLiveRate(token);
  }
  return STUB_RATES[token];
}
