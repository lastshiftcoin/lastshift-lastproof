/**
 * Per-store backend mode flags.
 *
 * Each store can independently run in one of three modes:
 *
 *   "memory"    — in-memory only (default; current behavior)
 *   "dual"      — write to BOTH memory AND Supabase, read from memory.
 *                 Used during migration to verify the Supabase write path
 *                 without changing read semantics or risking data loss.
 *   "supabase"  — read + write Supabase only. Memory is bypassed.
 *
 * Controlled by env vars: LASTPROOF_DB_<STORE>=memory|dual|supabase.
 * Defaults to "memory" so nothing changes until a store is explicitly
 * flipped. Step 16 flips them one at a time:
 *   quotes → payments → profiles → proofs → notifications → handle_history
 *
 * Read at boot, never re-evaluated, so a server restart is required
 * to change modes (this is intentional — modes drive store init).
 */

export type StoreMode = "memory" | "dual" | "supabase";

export type StoreName =
  | "quotes"
  | "payments"
  | "profiles"
  | "proofs"
  | "notifications"
  | "handle_history";

const ENV_KEYS: Record<StoreName, string> = {
  quotes: "LASTPROOF_DB_QUOTES",
  payments: "LASTPROOF_DB_PAYMENTS",
  profiles: "LASTPROOF_DB_PROFILES",
  proofs: "LASTPROOF_DB_PROOFS",
  notifications: "LASTPROOF_DB_NOTIFICATIONS",
  handle_history: "LASTPROOF_DB_HANDLE_HISTORY",
};

function parseMode(raw: string | undefined): StoreMode {
  if (raw === "dual" || raw === "supabase") return raw;
  return "memory";
}

export function getStoreMode(name: StoreName): StoreMode {
  return parseMode(process.env[ENV_KEYS[name]]);
}

/** Snapshot — handy for /api/health style endpoints. */
export function getAllStoreModes(): Record<StoreName, StoreMode> {
  return {
    quotes: getStoreMode("quotes"),
    payments: getStoreMode("payments"),
    profiles: getStoreMode("profiles"),
    proofs: getStoreMode("proofs"),
    notifications: getStoreMode("notifications"),
    handle_history: getStoreMode("handle_history"),
  };
}
