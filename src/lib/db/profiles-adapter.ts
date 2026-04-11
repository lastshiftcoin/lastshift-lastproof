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
  headline: string | null;
  pitch: string | null;
  about: string | null;
  bio_statement: string | null;
  timezone: string | null;
  language: string | null;
  secondary_language: string | null;
  website: string | null;
  avatar_url: string | null;
  fee_range: string | null;
  x_handle: string | null;
  x_verified: boolean | null;
  telegram_handle: string | null;
  telegram_verified: boolean | null;
  hire_telegram_handle: string | null;
  is_paid: boolean | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  last_payment_at: string | null;
  is_early_adopter: boolean | null;
  ea_number: number | null;
  tier: number | null;
  is_dev: boolean | null;
  view_count: number;
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
    headline: r.headline,
    pitch: r.pitch,
    about: r.about,
    bioStatement: r.bio_statement,
    timezone: r.timezone,
    language: r.language,
    secondaryLanguage: r.secondary_language ?? null,
    feeRange: r.fee_range,
    avatarUrl: r.avatar_url,
    xHandle: r.x_handle,
    xVerified: r.x_verified ?? false,
    tgHandle: r.telegram_handle,
    tgVerified: r.telegram_verified ?? false,
    website: r.website,
    hireTelegramHandle: r.hire_telegram_handle,
    isPaid: r.is_paid ?? false,
    subscriptionStartedAt: r.subscription_started_at,
    subscriptionExpiresAt: r.subscription_expires_at,
    lastPaymentAt: r.last_payment_at,
    isEarlyAdopter: r.is_early_adopter ?? false,
    eaNumber: r.ea_number ?? null,
    tier: (r.tier ?? 5) as ProfileRow["tier"],
    isDev: r.is_dev ?? false,
    viewCount: r.view_count ?? 0,
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
    headline: row.headline,
    pitch: row.pitch,
    about: row.about,
    bio_statement: row.bioStatement,
    timezone: row.timezone,
    avatar_url: row.avatarUrl,
    language: row.language,
    secondary_language: row.secondaryLanguage,
    website: row.website,
    fee_range: row.feeRange,
    x_handle: row.xHandle,
    x_verified: row.xVerified,
    telegram_handle: row.tgHandle,
    telegram_verified: row.tgVerified,
    hire_telegram_handle: row.hireTelegramHandle,
    is_paid: row.isPaid,
    subscription_started_at: row.subscriptionStartedAt,
    subscription_expires_at: row.subscriptionExpiresAt,
    last_payment_at: row.lastPaymentAt,
    is_early_adopter: row.isEarlyAdopter,
    ea_number: row.eaNumber,
    tier: row.tier,
    is_dev: row.isDev,
    view_count: row.viewCount,
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
  if (patch.headline !== undefined) dbPatch.headline = patch.headline;
  if (patch.pitch !== undefined) dbPatch.pitch = patch.pitch;
  if (patch.about !== undefined) dbPatch.about = patch.about;
  if (patch.bioStatement !== undefined) dbPatch.bio_statement = patch.bioStatement;
  if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
  if (patch.feeRange !== undefined) dbPatch.fee_range = patch.feeRange;
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.language !== undefined) dbPatch.language = patch.language;
  if (patch.secondaryLanguage !== undefined) dbPatch.secondary_language = patch.secondaryLanguage;
  if (patch.website !== undefined) dbPatch.website = patch.website;
  if (patch.xHandle !== undefined) dbPatch.x_handle = patch.xHandle;
  if (patch.xVerified !== undefined) dbPatch.x_verified = patch.xVerified;
  if (patch.tgHandle !== undefined) dbPatch.telegram_handle = patch.tgHandle;
  if (patch.tgVerified !== undefined) dbPatch.telegram_verified = patch.tgVerified;
  if (patch.hireTelegramHandle !== undefined) dbPatch.hire_telegram_handle = patch.hireTelegramHandle;
  if (patch.isPaid !== undefined) dbPatch.is_paid = patch.isPaid;
  if (patch.subscriptionStartedAt !== undefined)
    dbPatch.subscription_started_at = patch.subscriptionStartedAt;
  if (patch.subscriptionExpiresAt !== undefined)
    dbPatch.subscription_expires_at = patch.subscriptionExpiresAt;
  if (patch.lastPaymentAt !== undefined) dbPatch.last_payment_at = patch.lastPaymentAt;
  if (patch.isEarlyAdopter !== undefined) dbPatch.is_early_adopter = patch.isEarlyAdopter;
  if (patch.eaNumber !== undefined) dbPatch.ea_number = patch.eaNumber;
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

export async function getProfileByHandle(
  handle: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select(SELECT_WITH_OP)
    .eq("handle", handle)
    .maybeSingle<DbProfileWithOperator>();
  if (error) throw new Error(`[profiles-adapter] getByHandle: ${error.message}`);
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

/**
 * Atomically increment view_count for a profile by handle.
 * Uses the Supabase RPC function `increment_profile_view`.
 * Returns the new count, or null if handle doesn't exist.
 */
export async function incrementViewCount(handle: string): Promise<number | null> {
  const { data, error } = await supabaseService()
    .rpc("increment_profile_view", { p_handle: handle });
  if (error) {
    console.error("[profiles-adapter] incrementViewCount:", error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

/** Test-only. */
export async function __resetProfilesDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[profiles-adapter] reset: ${error.message}`);
}
