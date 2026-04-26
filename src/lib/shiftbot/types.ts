/**
 * SHIFTBOT response types.
 *
 * Per docs/SHIFTBOT-SECURITY-PLAN.md § Layer 2, the endpoint validates every
 * Groq response against this discriminated union. Anything that doesn't
 * narrow cleanly to one of these three types is silently coerced to
 * { type: "refuse", reason: "off_topic" } before reaching the client.
 */

import type { GridFilters } from "@/lib/grid/grid-view";

export type ShiftbotResponse =
  | { type: "filter"; filters: Partial<GridFilters> }
  | { type: "search"; ranked: string[] }
  | { type: "refuse"; reason: ShiftbotRefuseReason };

export type ShiftbotRefuseReason =
  | "off_topic"
  | "no_match"
  | "prompt_injection";

/**
 * Endpoint-level error signals (NOT Groq-level). These ride alongside the
 * ShiftbotResponse — a 429 from rate limiter or session counter never reaches
 * Groq at all, so a separate envelope.
 */
export type ShiftbotEndpointError =
  | "rate_limited"
  | "limit_reached"
  | "bad_input"
  | "service_unavailable";

export interface ShiftbotEndpointOk {
  ok: true;
  response: ShiftbotResponse;
  /** Remaining queries in the current session (for client-side hint, optional). */
  remaining: number;
}

export interface ShiftbotEndpointErr {
  ok: false;
  error: ShiftbotEndpointError;
  /** Human-readable message for the strip to display. */
  message?: string;
}

export type ShiftbotEndpointResult = ShiftbotEndpointOk | ShiftbotEndpointErr;
