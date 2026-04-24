/**
 * Env var read helpers — centralize sanitization to neutralize a class
 * of long-standing bugs in this project where env values were set via
 * shell commands that appended a literal `\n` (two chars: backslash
 * and `n`) to the value.
 *
 * Historical examples of the bug pattern:
 *   - `NEXT_PUBLIC_TREASURY_WALLET="5qCY...\n"` (found 2026-04-21)
 *   - `TOKEN_RATE_SOURCE="live\n"` (observed in dev .env 2026-04-23)
 *   - `TERMINAL_API_URL="https://lastshift.app\n"` (root cause of
 *     2026-04-24 "Non-JSON response (status 404)" bug — the literal
 *     `\n` becomes `/n/` when Node's URL constructor normalizes the
 *     backslash, landing requests at `/n/api/license/validate`
 *     instead of `/api/license/validate`, producing 404s)
 *
 * Going forward, read server-side env vars through `envClean()` (or
 * `envRequired()` when absent = fatal). These strip:
 *   - trailing literal `\n` (backslash + n), single or repeated
 *   - trailing actual whitespace including real newlines
 *
 * Client-side `NEXT_PUBLIC_*` vars are inlined at build time and
 * can't be cleaned at runtime — fix their source values directly in
 * the deployment config if corruption is found.
 */

/**
 * Strip trailing literal `\n` sequences (backslash + n, the 2-char
 * corruption pattern that's bitten this project repeatedly) AND
 * trim real whitespace. Returns undefined if the var isn't set.
 */
export function envClean(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  return raw.replace(/(?:\\n)+$/u, "").trim();
}

/**
 * Like `envClean`, but throws when the var is missing or empty after
 * cleaning. Use when a missing value would silently break downstream
 * code (e.g. `TERMINAL_API_URL`, `SESSION_HMAC_SECRET`).
 */
export function envRequired(name: string): string {
  const v = envClean(name);
  if (!v) throw new Error(`env: ${name} is not set (or empty after cleaning)`);
  return v;
}

/**
 * Read an env var and fall back to a literal default if unset. Still
 * cleaned. Use for config values that have a safe default shipped in
 * code (e.g. `INTER_TOOL_KEY_ID` → "v1").
 */
export function envWithDefault(name: string, fallback: string): string {
  const v = envClean(name);
  return v && v.length > 0 ? v : fallback;
}
