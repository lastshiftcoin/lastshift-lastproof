/**
 * Profiles — Supabase adapter.
 *
 * Mirrors `profiles-store.ts`. The DB shape diverges in one important
 * place: `terminalWallet` lives on `operators`, NOT on `profiles`. We
 * resolve it via a foreign-table select on read, and ignore it on write.
 *
 * `dual` mode keeps memory authoritative; supabase writes are
 * fire-and-forget so a flaky DB cannot break create/update flows during
 * migration.
 */

import { supabaseService } from "./client";
import type { ProfileRow } from "../profiles-store";

const TABLE = "profiles";

interface DbProfileWithOperator {
  id: string;
  operator_id: string;
  handle: string;
  display_name: string | null;
  is_paid: boolean | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  last_payment_at: string | null;
  is_early_adopter: boolean | null;
  tier: number | null;
  is_dev: boolean | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  operators?: { terminal_wallet: string } | null;
}

function rowFromDb(r: DbProfileWithOperator): ProfileRow {
  return {
    id: r.id,
    operatorId: r.operator_id,
    terminalWallet: r.operators?.terminal_wallet ?? "",
    handle: r.handle,
    displayName: r.display_name,
    isPaid: r.is_paid ?? false,
    subscriptionStartedAt: r.subscription_started_at,
    subscriptionExpiresAt: r.subscription_expires_at,
    lastPaymentAt: r.last_payment_at,
    isEarlyAdopter: r.is_early_adopter ?? false,
    tier: (r.tier ?? 5) as ProfileRow["tier"],
    isDev: r.is_dev ?? false,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToDb(row: ProfileRow): Record<string, unknown> {
  return {
    id: row.id,
    operator_id: row.operatorId,
    handle: row.handle,
    display_name: row.displayName,
    is_paid: row.isPaid,
    subscription_started_at: row.subscriptionStartedAt,
    subscription_expires_at: row.subscriptionExpiresAt,
    last_payment_at: row.lastPaymentAt,
    is_early_adopter: row.isEarlyAdopter,
    tier: row.tier,
    is_dev: row.isDev,
    published_at: row.publishedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

const SELECT_WITH_OP = "*, operators!inner(terminal_wallet)";

/**
 * Upsert by operator_id. The unique index on profiles.operator_id makes
 * `onConflict: "operator_id"` a true upsert. Mirrors the memory store's
 * `upsertProfileByOperator` semantics.
 */
export async function upsertProfile(row: ProfileRow): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .upsert(rowToDb(row), { onConflict: "operator_id" });
  if (error) throw new Error(`[profiles-adapter] upsert: ${error.message}`);
}

export async function updateProfileFields(
  id: string,
  patch: Partial<Omit<ProfileRow, "id" | "createdAt" | "operatorId" | "terminalWallet">>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.handle !== undefined) dbPatch.handle = patch.handle;
  if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName;
  if (patch.isPaid !== undefined) dbPatch.is_paid = patch.isPaid;
  if (patch.subscriptionStartedAt !== undefined)
    dbPatch.subscription_started_at = patch.subscriptionStartedAt;
  if (patch.subscriptionExpiresAt !== undefined)
    dbPatch.subscription_expires_at = patch.subscriptionExpiresAt;
  if (patch.lastPaymentAt !== undefined) dbPatch.last_payment_at = patch.lastPaymentAt;
  if (patch.isEarlyAdopter !== undefined) dbPatch.is_early_adopter = patch.isEarlyAdopter;
  if (patch.tier !== undefined) dbPatch.tier = patch.tier;
  if (patch.isDev !== undefined) dbPatch.is_dev = patch.isDev;
  if (patch.publishedAt !== undefined) dbPatch.published_at = patch.publishedAt;
  // updated_at handled by trigger touch_profiles_updated_at.

  if (Object.keys(dbPatch).length === 0) return;

  const { error } = await supabaseService().from(TABLE).update(dbPatch).eq("id", id);
  if (error) throw new Error(`[profiles-adapter] update: ${error.message}`);
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select(SELECT_WITH_OP)
    .eq("id", id)
    .maybeSingle<DbProfileWithOperator>();
  if (error) throw new Error(`[profiles-adapter] getById: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function getProfileByOperatorId(
  operatorId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select(SELECT_WITH_OP)
    .eq("operator_id", operatorId)
    .maybeSingle<DbProfileWithOperator>();
  if (error) throw new Error(`[profiles-adapter] getByOperator: ${error.message}`);
  return data ? rowFromDb(data) : null;
}

export async function listAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select(SELECT_WITH_OP)
    .order("created_at", { ascending: true })
    .returns<DbProfileWithOperator[]>();
  if (error) throw new Error(`[profiles-adapter] listAll: ${error.message}`);
  return (data ?? []).map(rowFromDb);
}

/** Test-only. */
export async function __resetProfilesDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[profiles-adapter] reset: ${error.message}`);
}
