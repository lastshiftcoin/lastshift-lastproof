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

// ─── Jupiter Price API v2 ─────────────────────────────────────────────
// Docs: https://station.jup.ag/docs/apis/price-api-v2
const JUPITER_PRICE_URL = "https://api.jup.ag/price/v2";

// Mint addresses Jupiter needs — SOL uses the wrapped SOL mint
const JUPITER_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  LASTSHFT: TOKEN_MINTS.LASTSHFT,
  USDT: TOKEN_MINTS.USDT,
};

async function fetchLiveRate(token: PaymentToken): Promise<number> {
  // USDT is always $1
  if (token === "USDT") return 1.0;

  // Check cache
  const cached = cache.get(token);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.usd;
  }

  const mint = JUPITER_MINTS[token];
  if (!mint) {
    console.warn(`[token-rates] no mint for ${token}, falling back to stub`);
    return STUB_RATES[token];
  }

  try {
    const url = `${JUPITER_PRICE_URL}?ids=${mint}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[token-rates] Jupiter returned ${res.status} for ${token}`);
      // Return cached value if available, otherwise stub
      return cached?.usd ?? STUB_RATES[token];
    }

    const data = (await res.json()) as {
      data?: Record<string, { price?: string }>;
    };

    const priceStr = data?.data?.[mint]?.price;
    if (!priceStr) {
      console.warn(`[token-rates] no price in Jupiter response for ${token}`);
      return cached?.usd ?? STUB_RATES[token];
    }

    const usd = parseFloat(priceStr);
    if (!Number.isFinite(usd) || usd <= 0) {
      console.warn(`[token-rates] invalid price ${priceStr} for ${token}`);
      return cached?.usd ?? STUB_RATES[token];
    }

    // Update cache
    cache.set(token, { usd, fetchedAt: Date.now() });
    return usd;
  } catch (err) {
    console.error(`[token-rates] Jupiter fetch failed for ${token}:`, err);
    // Graceful degradation: use cached or stub
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
