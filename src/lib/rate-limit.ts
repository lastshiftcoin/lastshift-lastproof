/**
 * In-memory rate limiter. Same pattern as Terminal.
 *
 * Per-IP token bucket with configurable window and max requests.
 * Resets on cold start (Vercel function re-deploy) but sufficient
 * for launch. Upgrade to Upstash Redis for persistence if needed.
 *
 * Usage:
 *   const limiter = createRateLimiter({ window: 60_000, max: 5 });
 *   const result = limiter.check(ip);
 *   if (!result.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Window in milliseconds. */
  window: number;
  /** Max requests per window. */
  max: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(config: RateLimitConfig) {
  // Each limiter gets its own store so different routes don't share counters
  const id = `rl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const store = new Map<string, RateLimitEntry>();
  stores.set(id, store);

  // Periodic cleanup — remove expired entries every 5 minutes
  if (typeof setInterval !== "undefined") {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) store.delete(key);
      }
    }, 5 * 60 * 1000);
  }

  return {
    check(ip: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(ip);

      if (!entry || entry.resetAt <= now) {
        // New window
        store.set(ip, { count: 1, resetAt: now + config.window });
        return { ok: true, remaining: config.max - 1, resetAt: now + config.window };
      }

      entry.count++;
      if (entry.count > config.max) {
        return { ok: false, remaining: 0, resetAt: entry.resetAt };
      }

      return { ok: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
    },
  };
}

/**
 * Extract client IP from request headers.
 * Vercel sets x-forwarded-for; falls back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
