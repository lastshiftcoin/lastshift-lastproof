/**
 * Input sanitization for SHIFTBOT queries.
 *
 * Layer 4 of four defense layers. Strips control chars and zero-width unicode
 * (steganography defense), trims whitespace, caps at 200 chars.
 *
 * Returns null if the input can't be salvaged into a usable query — caller
 * treats null as bad_input (400) without ever calling Groq.
 */

const MAX_QUERY_LEN = 200;

// C0/C1 control characters (excluding \n, \r, \t which we'd just collapse)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Zero-width and invisible Unicode — common steganography vector
// (zero-width space, zero-width non-joiner, zero-width joiner, BOM, etc.)
const ZERO_WIDTH_CHARS = /[​-‍﻿⁠⁡-⁤]/g;

export function sanitizeShiftbotQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const stripped = raw
    .replace(CONTROL_CHARS, " ")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();

  if (stripped.length === 0) return null;
  if (stripped.length > MAX_QUERY_LEN) return null;
  return stripped;
}
