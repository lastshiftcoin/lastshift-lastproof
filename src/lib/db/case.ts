/**
 * camelCase ↔ snake_case row converters.
 *
 * Supabase tables use snake_case (Postgres convention). The in-memory
 * stores and TS types use camelCase. Adapters live at the boundary and
 * call these to translate. Shallow only — we never have nested objects
 * in row payloads (jsonb metadata is passed through untouched).
 */

const CAMEL_RE = /([A-Z])/g;
const SNAKE_RE = /_([a-z])/g;

export function camelToSnake(s: string): string {
  return s.replace(CAMEL_RE, (_m, c: string) => `_${c.toLowerCase()}`);
}

export function snakeToCamel(s: string): string {
  return s.replace(SNAKE_RE, (_m, c: string) => c.toUpperCase());
}

/** Passthrough keys whose VALUES should not be re-walked (jsonb blobs). */
const PASSTHROUGH_KEYS = new Set(["metadata", "details"]);

export function rowToSnake<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[camelToSnake(k)] = obj[k];
  }
  return out;
}

export function rowToCamel<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const camel = snakeToCamel(k);
    const v = obj[k];
    out[camel] = PASSTHROUGH_KEYS.has(k) ? v : v;
  }
  return out;
}
