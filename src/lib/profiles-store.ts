/**
 * Profiles store — typed stub mirroring the `profiles` Supabase table.
 *
 * v1 is an in-memory Map keyed by profile id. Same swap pattern as
 * payments-store: reimplement the exported functions against Supabase and
 * callers do not move.
 *
 * Only the fields the skeletons actually touch are modeled here. The full
 * profile schema (pitch, about, work_items, screenshots, etc.) lands when
 * the Phase B / C UI wires in Supabase for real.
 */

export interface ProfileRow {
  id: string;
  operatorId: string;
  /** Terminal wallet — matches operators.terminal_wallet. */
  terminalWallet: string;
  handle: string;
  displayName: string | null;

  // Subscription state — owned by LASTPROOF, NOT Terminal.
  isPaid: boolean;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  lastPaymentAt: string | null;

  // Mirrored from Terminal validate on each session refresh.
  isEarlyAdopter: boolean;

  // Tier / DEV — written by skeletons #5 / #6.
  tier: 1 | 2 | 3 | 4 | 5;
  isDev: boolean;

  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

import { getStoreMode } from "./db/mode";
import * as profilesDb from "./db/profiles-adapter";

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[profiles-store] dual-write ${label} failed:`, err);
  });
}

const byId = new Map<string, ProfileRow>();
const byOperatorId = new Map<string, string>(); // operatorId → profileId

function newId(): string {
  return crypto.randomUUID();
}

export interface CreateProfileInput {
  operatorId: string;
  terminalWallet: string;
  handle: string;
  displayName: string | null;
  isEarlyAdopter: boolean;
}

export function upsertProfileByOperator(input: CreateProfileInput): ProfileRow {
  const existingId = byOperatorId.get(input.operatorId);
  if (existingId) {
    const existing = byId.get(existingId)!;
    existing.handle = input.handle;
    existing.displayName = input.displayName;
    existing.isEarlyAdopter = input.isEarlyAdopter;
    existing.updatedAt = new Date().toISOString();
    const mode = getStoreMode("profiles");
    if (mode === "dual" || mode === "supabase") {
      fireAndForget("upsert", profilesDb.upsertProfile(existing));
    }
    return existing;
  }
  const now = new Date().toISOString();
  const row: ProfileRow = {
    id: newId(),
    operatorId: input.operatorId,
    terminalWallet: input.terminalWallet,
    handle: input.handle,
    displayName: input.displayName,
    isPaid: false,
    subscriptionStartedAt: null,
    subscriptionExpiresAt: null,
    lastPaymentAt: null,
    isEarlyAdopter: input.isEarlyAdopter,
    tier: 5,
    isDev: false,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  byId.set(row.id, row);
  byOperatorId.set(input.operatorId, row.id);

  const mode = getStoreMode("profiles");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("upsert", profilesDb.upsertProfile(row));
  }
  return row;
}

export function getProfileById(id: string): ProfileRow | null {
  return byId.get(id) || null;
}

export function getProfileByOperatorId(operatorId: string): ProfileRow | null {
  const id = byOperatorId.get(operatorId);
  return id ? byId.get(id) || null : null;
}

export function updateProfile(
  id: string,
  patch: Partial<Omit<ProfileRow, "id" | "createdAt" | "operatorId">>,
): ProfileRow | null {
  const row = byId.get(id);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });

  const mode = getStoreMode("profiles");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("update", profilesDb.updateProfileFields(id, patch));
  }
  return row;
}

export function listProfiles(): ProfileRow[] {
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function __resetProfiles(): void {
  byId.clear();
  byOperatorId.clear();
}
