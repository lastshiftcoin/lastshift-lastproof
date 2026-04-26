/**
 * Output validation for SHIFTBOT responses.
 *
 * Layer 2 of four defense layers — the critical line. Even if Layer 1 (system
 * prompt) fails on a novel attack, this validator coerces anything that
 * doesn't match the expected schema into refuse:off_topic. There's no field
 * for "passwords", "emails", or "system_prompt" anywhere in the allowed
 * shapes, so successful prompt-side attacks have no leak surface.
 *
 * Spec: docs/SHIFTBOT-SECURITY-PLAN.md § Layer 2
 */

import type { GridFilters, GridTier, GridFee } from "@/lib/grid/grid-view";
import type { ShiftbotResponse, ShiftbotRefuseReason } from "./types";

// ─── Allowlists ──────────────────────────────────────────────────────

const VALID_CATEGORY_SLUGS = new Set<string>([
  "community-manager",
  "mod",
  "raid-leader",
  "shiller",
  "alpha-caller",
  "kol-influencer",
  "space-host-ama-host",
  "content-creator",
  "collab-manager",
  "growth-paid-media",
  "brand-creative",
  "bd-partnerships",
  "pr-comms",
  "vibe-coder-builder",
  "token-dev-tokenomics",
]);

const VALID_TIERS = new Set<number>([1, 2, 3, 4]);
const VALID_FEES = new Set<string>(["$", "$$", "$$$", "$$$$"]);
const VALID_PROOF_BUCKETS = new Set<number>([0, 10, 25, 50, 100]);
const VALID_REFUSE_REASONS = new Set<string>([
  "off_topic",
  "no_match",
  "prompt_injection",
]);

// 2-3 letter language codes, alphabetic only
const LANG_CODE_RE = /^[A-Z]{2,3}$/i;
// UTC offset format, e.g. "UTC-5", "UTC+12"
const TZ_OFFSET_RE = /^UTC[+-]\d{1,2}$/i;

// Default fallback — used by every validation failure path
const REFUSE_OFF_TOPIC: ShiftbotResponse = {
  type: "refuse",
  reason: "off_topic",
};

/**
 * Validate Groq's parsed JSON response. On any deviation from the allowed
 * schema, returns refuse:off_topic. The caller treats the returned value as
 * authoritative — never the raw Groq output.
 *
 * @param raw            Parsed JSON from Groq's content (already JSON.parsed)
 * @param candidateHandles Set of operator handles we sent to Groq. `search`
 *                       responses must reference handles ONLY from this set.
 *                       Anything else is hallucination → silently dropped.
 */
export function validateShiftbotResponse(
  raw: unknown,
  candidateHandles: Set<string>,
): ShiftbotResponse {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return REFUSE_OFF_TOPIC;
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type;

  // ─── refuse ─────────────────────────────────────────────────────────
  if (type === "refuse") {
    const reason = obj.reason;
    if (typeof reason !== "string" || !VALID_REFUSE_REASONS.has(reason)) {
      return REFUSE_OFF_TOPIC;
    }
    return { type: "refuse", reason: reason as ShiftbotRefuseReason };
  }

  // ─── filter ─────────────────────────────────────────────────────────
  if (type === "filter") {
    const filters = obj.filters;
    if (!filters || typeof filters !== "object") return REFUSE_OFF_TOPIC;
    const f = filters as Record<string, unknown>;
    const out: Partial<GridFilters> = {};

    if (typeof f.category === "string" && VALID_CATEGORY_SLUGS.has(f.category)) {
      out.category = f.category;
    }

    if (Array.isArray(f.tiers)) {
      out.tiers = f.tiers.filter(
        (t): t is GridTier =>
          typeof t === "number" && VALID_TIERS.has(t),
      );
    }

    if (Array.isArray(f.fees)) {
      out.fees = f.fees.filter(
        (v): v is GridFee => typeof v === "string" && VALID_FEES.has(v),
      );
    }

    if (Array.isArray(f.languages)) {
      out.languages = f.languages
        .filter((s): s is string => typeof s === "string" && LANG_CODE_RE.test(s))
        .map((s) => s.toUpperCase());
    }

    if (Array.isArray(f.timezones)) {
      out.timezones = f.timezones.filter(
        (s): s is string => typeof s === "string" && TZ_OFFSET_RE.test(s),
      );
    }

    if (
      typeof f.minProofs === "number" &&
      VALID_PROOF_BUCKETS.has(f.minProofs)
    ) {
      out.minProofs = f.minProofs;
    }

    if (typeof f.onlyVerified === "boolean") out.onlyVerified = f.onlyVerified;
    if (typeof f.onlyDevProofs === "boolean") {
      out.onlyDevProofs = f.onlyDevProofs;
    }

    return { type: "filter", filters: out };
  }

  // ─── search ─────────────────────────────────────────────────────────
  if (type === "search") {
    const ranked = obj.ranked;
    if (!Array.isArray(ranked)) return REFUSE_OFF_TOPIC;

    // Only keep handles that are real operators we actually sent to Groq.
    // Cap at 12 even if model returned more.
    const safe = ranked
      .filter(
        (h): h is string => typeof h === "string" && candidateHandles.has(h),
      )
      .slice(0, 12);

    if (safe.length === 0) {
      return { type: "refuse", reason: "no_match" };
    }
    return { type: "search", ranked: safe };
  }

  // ─── unknown type ───────────────────────────────────────────────────
  return REFUSE_OFF_TOPIC;
}
