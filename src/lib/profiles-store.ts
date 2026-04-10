/**
 * Profiles store — async API, mode-dispatched.
 *
 * Three modes (set via LASTPROOF_DB_PROFILES env, see db/mode.ts):
 *
 *   memory   — in-memory Map only. Tests + offline dev.
 *   dual     — write to BOTH memory AND Supabase, READS still from memory.
 *              Memory is the source of truth. Supabase writes are
 *              fire-and-forget so a flaky DB cannot break user flows.
 *   supabase — read + write Supabase only. Memory is bypassed entirely.
 *              The source of truth is the DB.
 *
 * Every export is async so the same API works for all three modes. The
 * memory + dual paths still resolve synchronously inside the promise,
 * so per-call latency is unchanged for those modes.
 */

export interface ProfileRow {
  id: string;
  operatorId: string;
  /** Terminal wallet — matches operators.terminal_wallet. */
  terminalWallet: string;
  handle: string;
  displayName: string | null;

  // ─── Content fields (written by dashboard, read by projector) ───
  headline: string | null;
  pitch: string | null;
  about: string | null;
  bioStatement: string | null;
  timezone: string | null;
  language: string | null;
  feeRange: string | null;
  avatarUrl: string | null;

  // ─── Social handles ─────────────────────────────────────────────
  xHandle: string | null;
  xVerified: boolean;
  tgHandle: string | null;
  tgVerified: boolean;
  website: string | null;
  hireTelegramHandle: string | null;

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

export async function upsertProfileByOperator(
  input: CreateProfileInput,
): Promise<ProfileRow> {
  const mode = getStoreMode("profiles");

  if (mode === "supabase") {
    // Look up existing by operator_id, then upsert.
    const existing = await profilesDb.getProfileByOperatorId(input.operatorId);
    const now = new Date().toISOString();
    const row: ProfileRow = existing
      ? {
          ...existing,
          handle: input.handle,
          displayName: input.displayName,
          isEarlyAdopter: input.isEarlyAdopter,
          updatedAt: now,
        }
      : {
          id: newId(),
          operatorId: input.operatorId,
          terminalWallet: input.terminalWallet,
          handle: input.handle,
          displayName: input.displayName,
          headline: null,
          pitch: null,
          about: null,
          bioStatement: null,
          timezone: null,
          language: null,
          feeRange: null,
          avatarUrl: null,
          xHandle: null,
          xVerified: false,
          tgHandle: null,
          tgVerified: false,
          website: null,
          hireTelegramHandle: null,
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
    await profilesDb.upsertProfile(row);
    return row;
  }

  // memory + dual paths
  const existingId = byOperatorId.get(input.operatorId);
  if (existingId) {
    const existing = byId.get(existingId)!;
    existing.handle = input.handle;
    existing.displayName = input.displayName;
    existing.isEarlyAdopter = input.isEarlyAdopter;
    existing.updatedAt = new Date().toISOString();
    if (mode === "dual") {
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
    headline: null,
    pitch: null,
    about: null,
    bioStatement: null,
    timezone: null,
    language: null,
    feeRange: null,
    avatarUrl: null,
    xHandle: null,
    xVerified: false,
    tgHandle: null,
    tgVerified: false,
    website: null,
    hireTelegramHandle: null,
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

  if (mode === "dual") {
    fireAndForget("upsert", profilesDb.upsertProfile(row));
  }
  return row;
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  if (getStoreMode("profiles") === "supabase") {
    return profilesDb.getProfileById(id);
  }
  return byId.get(id) || null;
}

export async function getProfileByOperatorId(
  operatorId: string,
): Promise<ProfileRow | null> {
  if (getStoreMode("profiles") === "supabase") {
    return profilesDb.getProfileByOperatorId(operatorId);
  }
  const id = byOperatorId.get(operatorId);
  return id ? byId.get(id) || null : null;
}

export async function updateProfile(
  id: string,
  patch: Partial<Omit<ProfileRow, "id" | "createdAt" | "operatorId">>,
): Promise<ProfileRow | null> {
  const mode = getStoreMode("profiles");

  if (mode === "supabase") {
    await profilesDb.updateProfileFields(id, patch);
    return profilesDb.getProfileById(id);
  }

  const row = byId.get(id);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });

  if (mode === "dual") {
    fireAndForget("update", profilesDb.updateProfileFields(id, patch));
  }
  return row;
}

export async function listProfiles(): Promise<ProfileRow[]> {
  if (getStoreMode("profiles") === "supabase") {
    return profilesDb.listAllProfiles();
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function __resetProfiles(): void {
  byId.clear();
  byOperatorId.clear();
}
