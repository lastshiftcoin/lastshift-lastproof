import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { supabaseService } from "@/lib/db/client";

import { sanitizeShiftbotQuery } from "@/lib/shiftbot/sanitize";
import { validateShiftbotResponse } from "@/lib/shiftbot/validate";
import {
  SHIFTBOT_SYSTEM_PROMPT,
  buildShiftbotUserMessage,
} from "@/lib/shiftbot/prompt";
import { getOperatorsForSearch } from "@/lib/shiftbot/operators";
import type {
  ShiftbotEndpointResult,
  ShiftbotResponse,
} from "@/lib/shiftbot/types";

/**
 * POST /api/shiftbot/search
 *
 * SHIFTBOT functional endpoint. Wires all four defense layers per
 * docs/SHIFTBOT-SECURITY-PLAN.md:
 *
 *   L1 — system prompt (in src/lib/shiftbot/prompt.ts)
 *   L2 — output validation (validateShiftbotResponse)
 *   L3 — Groq params hardened (temp 0.2, max_tokens 400, json_object)
 *   L4 — IP rate limit (5/min) + session counter (10/cookie) + input
 *        sanitization + refusal logging to shiftbot_refusals table
 *
 * Called from ShiftbotStrip when the user is on /operators*. On other
 * pages, the strip shows a canned response without hitting this endpoint.
 */

const GROQ_API_KEY = process.env.LASTPROOF_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SHIFTBOT_LIMIT = 10;
const COOKIE_NAME = "shiftbot_count";

// Per-IP rate limiter — 5 req/min/IP. Anti-abuse, not UX nudge.
const ipLimiter = createRateLimiter({ window: 60_000, max: 5 });

export async function POST(req: NextRequest) {
  // ─── L4a: rate limiter (anti-abuse) ────────────────────────────────
  const ip = getClientIp(req);
  const rl = ipLimiter.check(ip);
  if (!rl.ok) {
    return errResponse("rate_limited", "Too many requests. Try again in a minute.");
  }

  // ─── L4b: session counter ──────────────────────────────────────────
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  const count = Number(cookieValue) || 0;
  if (count >= SHIFTBOT_LIMIT) {
    return errResponse(
      "limit_reached",
      "Sorry — you've hit your SHIFTBOT limit for this session. Use the filters in the sidebar to keep exploring, or refresh later for a fresh quota.",
    );
  }

  // ─── L4c: input sanitization ───────────────────────────────────────
  const body = await req.json().catch(() => null);
  const query = sanitizeShiftbotQuery(body?.query);
  if (!query) {
    return errResponse("bad_input", "Type a question to ask SHIFTBOT.");
  }

  if (!GROQ_API_KEY) {
    console.error("[shiftbot/search] LASTPROOF_GROQ_API_KEY not set");
    return errResponse(
      "service_unavailable",
      "SHIFTBOT is temporarily unavailable.",
    );
  }

  // ─── Pull enriched operator data for SHIFTBOT search ───────────────
  // Mode B (deep content search) needs more than what's on the Grid card —
  // pitch, about, work_items, etc. See docs/SHIFTBOT-SECURITY-PLAN.md §
  // Mode B content scope. getOperatorsForSearch() applies the same
  // visibility predicate as grid_operators but joins richer fields.
  const operators = await getOperatorsForSearch();
  const candidateHandles = new Set(operators.map((o) => o.handle));

  // ─── L1 + L3: Groq call with hardened params ───────────────────────
  // Default to refuse:off_topic so any unexpected branch (e.g. Groq
  // returns the JSON literal `null`) still produces a valid response.
  let groqResponse: ShiftbotResponse = { type: "refuse", reason: "off_topic" };
  try {
    const userMessage = buildShiftbotUserMessage(query, operators);
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SHIFTBOT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => "");
      console.error("[shiftbot/search] Groq error:", groqRes.status, text);
      return errResponse(
        "service_unavailable",
        "SHIFTBOT is temporarily unavailable.",
      );
    }

    const groqJson = await groqRes.json();
    const rawContent = groqJson?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      groqResponse = { type: "refuse", reason: "off_topic" };
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // Groq returned non-JSON despite response_format setting.
        groqResponse = { type: "refuse", reason: "off_topic" };
        parsed = null;
      }
      // ─── L2: output validation ─────────────────────────────────────
      if (parsed !== null) {
        groqResponse = validateShiftbotResponse(parsed, candidateHandles);
      }
    }
  } catch (err) {
    console.error("[shiftbot/search] fetch error:", err);
    return errResponse(
      "service_unavailable",
      "SHIFTBOT is temporarily unavailable.",
    );
  }

  // ─── L4d: log refusals (fire-and-forget, don't block the response) ──
  // Narrow the discriminated union before reading `.reason` — only the
  // refuse variant has it.
  if (groqResponse.type === "refuse") {
    const refusalReason = groqResponse.reason;
    void logRefusal(query, refusalReason, ip);
  }

  // ─── Increment session counter (refusals count too — spec § Layer 4) ─
  const newCount = count + 1;
  const result: ShiftbotEndpointResult = {
    ok: true,
    response: groqResponse,
    remaining: Math.max(0, SHIFTBOT_LIMIT - newCount),
  };

  const res = NextResponse.json(result);
  res.cookies.set(COOKIE_NAME, String(newCount), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No maxAge → session cookie (resets on browser close)
  });
  return res;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function errResponse(
  error:
    | "rate_limited"
    | "limit_reached"
    | "bad_input"
    | "service_unavailable",
  message: string,
) {
  const status = error === "rate_limited" || error === "limit_reached"
    ? 429
    : error === "bad_input"
    ? 400
    : 503;
  const body: ShiftbotEndpointResult = { ok: false, error, message };
  return NextResponse.json(body, { status });
}

/**
 * Hash IP for the refusal log. Uses IP_HASH_SALT env var (server-side only)
 * so hashes are unique to this deployment. If salt is unset, returns null
 * and the column stores NULL — refusals still log, just without IP
 * correlation. Forward-compatible: once salt is set, future refusals get
 * proper hashes.
 */
function hashIp(ip: string): string | null {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[shiftbot/search] IP_HASH_SALT not set — refusal logs missing ip_hash",
      );
    }
    return null;
  }
  return createHash("sha256").update(ip + salt).digest("hex");
}

async function logRefusal(query: string, reason: string, ip: string): Promise<void> {
  try {
    const { error } = await supabaseService()
      .from("shiftbot_refusals")
      .insert({
        reason,
        query,
        ip_hash: hashIp(ip),
      });
    if (error) {
      console.error("[shiftbot/search] log refusal failed:", error.message);
    }
  } catch (err) {
    // Logging is best-effort. Don't propagate failures to the user.
    console.error("[shiftbot/search] log refusal exception:", err);
  }
}
