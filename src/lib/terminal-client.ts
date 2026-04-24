/**
 * Typed S2S client for the LASTSHIFT Terminal.
 *
 * Single source of truth for every cross-tool call. Shapes lifted verbatim
 * from docs/TERMINAL-CONTRACT.md — do not drift from that doc.
 *
 * Env:
 *   TERMINAL_API_URL      base URL (local mock | staging.lastshift.app | lastshift.app)
 *   INTER_TOOL_API_SECRET bearer token
 *   INTER_TOOL_KEY_ID     rotation key id (starts at "v1")
 *   TOOL_SLUG             always "lastproof"
 *
 * Caching: successful validates are memoized per-process with a 5-minute TTL
 * per (walletAddress, terminalId) pair. Invalidate early via `invalidateValidateCache`
 * before any gated action (publish, payment, profile edit).
 */

import { envClean, envWithDefault } from "./env";

// ─── Contract types (mirror docs/TERMINAL-CONTRACT.md §1–§2) ─────────────────

export type SubscriptionStatus = "free_ea" | "active" | "past_due" | "canceled" | "none";

export interface ValidateSuccess {
  valid: true;
  walletAddress: string;
  terminalId: string;
  firstFiveThousand: boolean;
  freeSubUntil: string | null;
  subscriptionStatus: SubscriptionStatus;
  verified: { x: boolean; telegram: boolean };
  displayName: string | null;
  createdAt: string | null;
}

export type ValidateFailureReason =
  | "wallet_tid_mismatch"
  | "tid_regenerated"
  | "tool_not_entitled"
  | "tid_not_found"
  | "wallet_not_registered"
  | "rate_limited"
  | "malformed_request"
  | "unauthorized"
  | "network_error"
  | "unknown";

export interface ValidateFailure {
  valid: false;
  reason: ValidateFailureReason;
  message: string;
  httpStatus: number;
  retryAfterSec?: number;
}

export type ValidateResult = ValidateSuccess | ValidateFailure;

export interface AffiliateConfirmSuccess {
  ok: true;
  credited: boolean;
  affiliate_slug: string | null;
  recorded_at?: string;
  reason?: "already_recorded";
}

export type AffiliateFailureReason =
  | "wallet_tid_mismatch"
  | "tid_not_found"
  | "wallet_not_registered"
  | "malformed_request"
  | "no_affiliate_on_record"
  | "unauthorized"
  | "network_error"
  | "unknown";

export interface AffiliateConfirmFailure {
  ok: false;
  reason: AffiliateFailureReason;
  message: string;
  httpStatus: number;
  /** True when the reason is a non-retryable terminal success masquerading as failure. */
  terminal: boolean;
}

export type AffiliateConfirmResult = AffiliateConfirmSuccess | AffiliateConfirmFailure;

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig() {
  // Sanitize every read through envClean to strip a class of legacy
  // corruption (trailing literal `\n`) that has bitten this project
  // repeatedly. See src/lib/env.ts for the full history — the 404 on
  // /manage authenticate (2026-04-24) was caused by exactly this
  // pattern on TERMINAL_API_URL.
  const base = envClean("TERMINAL_API_URL");
  const secret = envClean("INTER_TOOL_API_SECRET");
  const keyId = envWithDefault("INTER_TOOL_KEY_ID", "v1");
  const toolSlug = envWithDefault("TOOL_SLUG", "lastproof");
  if (!base) throw new Error("TERMINAL_API_URL not set");
  if (!secret) throw new Error("INTER_TOOL_API_SECRET not set");
  return { base, secret, keyId, toolSlug };
}

function authHeaders() {
  const { secret, keyId } = getConfig();
  return {
    Authorization: `Bearer ${secret}`,
    "X-LastShift-Key-Id": keyId,
    "Content-Type": "application/json",
  };
}

// ─── 5-minute in-memory validate cache ───────────────────────────────────────

const VALIDATE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { value: ValidateSuccess; expiresAt: number };
const validateCache = new Map<string, CacheEntry>();

function cacheKey(wallet: string, tid: string): string {
  return `${wallet}::${tid}`;
}

export function invalidateValidateCache(wallet?: string, tid?: string): void {
  if (!wallet || !tid) {
    validateCache.clear();
    return;
  }
  validateCache.delete(cacheKey(wallet, tid));
}

// ─── validateTerminalId ──────────────────────────────────────────────────────

export interface ValidateOptions {
  /** Force a fresh call even if a cached success exists. Use before gated actions. */
  skipCache?: boolean;
  /** Mock scenario passthrough — dev only. Ignored in non-mock deployments. */
  mockScenario?: string;
}

export async function validateTerminalId(
  walletAddress: string,
  terminalId: string,
  opts: ValidateOptions = {},
): Promise<ValidateResult> {
  const { base, toolSlug } = getConfig();
  const key = cacheKey(walletAddress, terminalId);

  if (!opts.skipCache) {
    const hit = validateCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
  }

  const url = new URL(`${base}/api/license/validate`);
  if (opts.mockScenario) url.searchParams.set("scenario", opts.mockScenario);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ walletAddress, terminalId, toolSlug }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      valid: false,
      reason: "network_error",
      message: err instanceof Error ? err.message : "Network error",
      httpStatus: 0,
    };
  }

  // 401 has a distinct body shape per contract §1.
  if (res.status === 401) {
    return {
      valid: false,
      reason: "unauthorized",
      message: "S2S auth rejected.",
      httpStatus: 401,
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      valid: false,
      reason: "unknown",
      message: `Non-JSON response (status ${res.status})`,
      httpStatus: res.status,
    };
  }

  if (res.ok && payload.valid === true) {
    const success = payload as unknown as ValidateSuccess;
    validateCache.set(key, { value: success, expiresAt: Date.now() + VALIDATE_TTL_MS });
    return success;
  }

  const reason = (payload.reason as ValidateFailureReason) || "unknown";
  const message = (payload.message as string) || `HTTP ${res.status}`;
  const retryHeader = res.headers.get("retry-after");
  const retryAfterSec = retryHeader ? Number(retryHeader) : undefined;

  return {
    valid: false,
    reason,
    message,
    httpStatus: res.status,
    ...(retryAfterSec !== undefined && !Number.isNaN(retryAfterSec) ? { retryAfterSec } : {}),
  };
}

// ─── confirmAffiliate ────────────────────────────────────────────────────────

const AFFILIATE_TERMINAL_SUCCESS_REASONS: ReadonlySet<AffiliateFailureReason> = new Set([
  "no_affiliate_on_record",
]);

export async function confirmAffiliate(params: {
  wallet: string;
  terminalId: string;
  profileUrl: string;
}): Promise<AffiliateConfirmResult> {
  const { base } = getConfig();
  const url = `${base}/api/affiliate/confirm`;

  // snake_case per contract §2 historical lock.
  const body = {
    wallet: params.wallet,
    terminal_id: params.terminalId,
    profile_url: params.profileUrl,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      reason: "network_error",
      message: err instanceof Error ? err.message : "Network error",
      httpStatus: 0,
      terminal: false,
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "S2S auth rejected.",
      httpStatus: 401,
      terminal: true,
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "unknown",
      message: `Non-JSON response (status ${res.status})`,
      httpStatus: res.status,
      terminal: false,
    };
  }

  if (res.ok && payload.ok === true) {
    return payload as unknown as AffiliateConfirmSuccess;
  }

  const reason = (payload.reason as AffiliateFailureReason) || "unknown";
  return {
    ok: false,
    reason,
    message: (payload.message as string) || `HTTP ${res.status}`,
    httpStatus: res.status,
    terminal: AFFILIATE_TERMINAL_SUCCESS_REASONS.has(reason),
  };
}
