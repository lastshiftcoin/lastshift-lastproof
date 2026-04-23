/**
 * Helius webhook HMAC verification.
 *
 * Helius signs enhanced-webhook payloads by letting you set an `Authorization`
 * header value on the webhook config; it forwards that header verbatim on
 * every POST. For LASTPROOF we use `Authorization: <shared-secret>` as the
 * simplest shape Helius supports. We compare it in constant time against
 * HELIUS_WEBHOOK_SECRET.
 *
 * Terminal does not run a Helius webhook today, so there is no shared helper
 * to copy — this is our canonical verifier. Keep it small and dependency-free.
 *
 * If/when we switch to Helius's newer HMAC-SHA256-of-body signature scheme,
 * the verifier swaps in place; every caller goes through `verifyHeliusRequest`.
 */

import crypto from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_header" | "mismatch" };

/**
 * Minimum accepted length for HELIUS_WEBHOOK_SECRET. Helius auth is a
 * plain static bearer — there is no HMAC, no timestamp, and the only
 * thing standing between an attacker and a forged payment event is the
 * entropy of this secret. 32 bytes (~256 bits) is the floor; 64+ is
 * preferred. Configured via env at deploy time.
 */
const MIN_SECRET_LENGTH = 32;

function getSecret(): string | null {
  const s = process.env.HELIUS_WEBHOOK_SECRET;
  if (!s || s.length === 0) return null;
  if (s.length < MIN_SECRET_LENGTH) {
    // Fail closed: a weak secret is worse than an obvious config error
    // because it creates the illusion of authentication. Logging once
    // at verify time is enough — production boot should also call
    // `assertHeliusSecretConfigured()` to surface this at startup.
    console.error(
      `[helius-verify] HELIUS_WEBHOOK_SECRET is ${s.length} chars; ` +
        `minimum ${MIN_SECRET_LENGTH}. Rejecting all webhook deliveries.`,
    );
    return null;
  }
  return s;
}

/**
 * Boot-time assertion — call from a server startup path (or cron warmup)
 * to fail loudly if the secret is missing or too short. Keeps the error
 * visible in Vercel logs instead of silently 401-ing every delivery.
 */
export function assertHeliusSecretConfigured(): void {
  const s = process.env.HELIUS_WEBHOOK_SECRET;
  if (!s) throw new Error("HELIUS_WEBHOOK_SECRET is not set");
  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `HELIUS_WEBHOOK_SECRET is ${s.length} chars; minimum ${MIN_SECRET_LENGTH}`,
    );
  }
}

/**
 * Constant-time compare. Both strings must be non-empty and equal length;
 * length mismatch is reported as `mismatch` (not `missing_header`) so timing
 * attackers cannot probe the expected length via branching behavior.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyHeliusRequest(req: Request): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };

  const header = req.headers.get("authorization");
  if (!header) return { ok: false, reason: "missing_header" };

  return safeEqual(header, secret) ? { ok: true } : { ok: false, reason: "mismatch" };
}
