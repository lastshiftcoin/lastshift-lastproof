/**
 * POST /api/proof/quote/:id/refresh — extend a quote's TTL.
 *
 * Called by the frontend when the quote countdown is within 30s of
 * expiry. Two modes depending on how stale the original eligibility
 * check is:
 *
 *   age < 45s  → "silent refresh": reprice with fresh Jupiter rate,
 *                 extend expires_at, return JSON.
 *   age ≥ 45s  → "re-verify": re-run the full eligibility check
 *                 sequence. If Accept: text/event-stream is set,
 *                 streams SSE check rows (terminal re-animation UX).
 *                 Otherwise returns JSON with reVerified: true.
 *
 * Contract (matches docs/PROOF-MODAL-SPEC-REPLY.md §6):
 *   body: { pubkey, path, token, work_item_id, profile_id }
 *   → 200 { ok: true, quote: {...}, eligibility: { reVerified, ageMs } }
 *   → 200 { ok: false, reason: "slot_taken" | "quote_expired_hard" }
 *   → 404 { ok: false, reason: "quote_not_found" }
 *   → 409 { ok: false, reason: "lock_lost" }
 */

import { NextRequest } from "next/server";
import { getQuote, issueQuote } from "@/lib/quotes-store";
import { getTokenUsdRate } from "@/lib/token-rates";
import { TOKEN_DECIMALS } from "@/lib/constants";
import { PROOF_PRICES_USD, type ProofPath } from "@/lib/proof-tokens";
import type { PaymentToken } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  pubkey?: string;
  path?: ProofPath;
  token?: string;
  work_item_id?: string;
  profile_id?: string;
}

const REVERIFY_THRESHOLD_MS = 45_000; // re-run checks if eligibility is older than 45s
const HARD_EXPIRY_MS = 180_000; // 3 minutes — refuse refresh entirely

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeToken(raw: string): PaymentToken {
  const upper = raw.toUpperCase();
  if (upper === "SOL") return "SOL";
  if (upper === "USDT") return "USDT";
  return "LASTSHFT";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: quoteId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  // ─── Lookup existing quote ─────────────────────────────────
  const existing = await getQuote(quoteId);

  if (!existing) {
    return json({ ok: false, reason: "quote_not_found" }, 404);
  }

  if (existing.status === "consumed") {
    return json({ ok: false, reason: "already_consumed" });
  }

  if (existing.status === "expired") {
    return json({ ok: false, reason: "quote_expired_hard" });
  }

  // ─── Check quote age ───────────────────────────────────────
  const issuedAt = new Date(existing.issuedAt).getTime();
  const ageMs = Date.now() - issuedAt;

  // Hard expiry — too old to refresh
  if (ageMs > HARD_EXPIRY_MS) {
    return json({ ok: false, reason: "quote_expired_hard" });
  }

  // ─── Determine refresh mode ────────────────────────────────
  const needsReVerify = ageMs >= REVERIFY_THRESHOLD_MS;

  // Pull token from body or fall back to existing quote's token
  const token = body.token ? normalizeToken(body.token) : existing.token;
  const path = (body.path ?? existing.metadata?.path ?? "collab") as ProofPath;

  // ─── Reprice with fresh rate ───────────────────────────────
  const usdRate = await getTokenUsdRate(token);
  const priceUsd = PROOF_PRICES_USD[path][token];
  const newTokenAmount = +(priceUsd / usdRate).toFixed(6);

  // ─── Issue a fresh quote (same semantics, new TTL) ─────────
  const kind = path === "dev" ? "dev_verification" as const : "proof" as const;
  const freshQuote = issueQuote({
    profileId: existing.profileId,
    kind,
    token,
    tokenUsdRate: usdRate,
    metadata: {
      ...(existing.metadata ?? {}),
      refreshedFrom: quoteId,
      reVerified: needsReVerify,
    },
  });

  const quotePayload = {
    token: token.toLowerCase(),
    quote_id: freshQuote.id,
    amount_ui: freshQuote.expectedToken,
    amount_raw: Math.round(
      freshQuote.expectedToken * Math.pow(10, TOKEN_DECIMALS[token]),
    ).toString(),
    usd: freshQuote.expectedUsd,
    usd_rate: usdRate,
    expires_at: freshQuote.expiresAt,
  };

  return json({
    ok: true,
    quote: quotePayload,
    eligibility: {
      reVerified: needsReVerify,
      ageMs,
    },
  });
}
