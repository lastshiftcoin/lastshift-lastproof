/**
 * Profile categories — Supabase adapter.
 *
 * Join table: `profile_categories` links a profile to one or more category
 * slugs. The `categories` lookup table holds the human labels and ordering.
 * The public profile renders these as chips above the proof-of-work section.
 *
 * Reads join the two tables so callers get `{ slug, label }` directly.
 * Writes go through the join table only — `categories` rows are seeded
 * by migration and managed by admins, not by operators.
 */

import { supabaseService } from "./client";

const JOIN_TABLE = "profile_categories";
const CATEGORIES_TABLE = "categories";

// ─── DB shape ──────────────────────────────────────────────────────────────

export interface DbProfileCategory {
  profile_id: string;
  category_slug: string;
  categories?: { label: string; position: number } | null;
}

export interface DbCategory {
  slug: string;
  label: string;
  description: string | null;
  position: number;
}

// ─── App shape ─────────────────────────────────────────────────────────────

export interface ProfileCategoryRow {
  profileId: string;
  slug: string;
  label: string;
}

export interface CategoryRow {
  slug: string;
  label: string;
  description: string | null;
  position: number;
}

// ─── Converters ────────────────────────────────────────────────────────────

function joinRowFromDb(r: DbProfileCategory): ProfileCategoryRow {
  return {
    profileId: r.profile_id,
    slug: r.category_slug,
    label: r.categories?.label ?? r.category_slug.toUpperCase(),
  };
}

function categoryFromDb(r: DbCategory): CategoryRow {
  return {
    slug: r.slug,
    label: r.label,
    description: r.description,
    position: r.position,
  };
}

// ─── Reads ─────────────────────────────────────────────────────────────────

/**
 * Returns the categories assigned to a profile, ordered by the category's
 * global position. Joins through to `categories` for the human label.
 */
export async function listCategoriesByProfile(
  profileId: string,
): Promise<ProfileCategoryRow[]> {
  const { data, error } = await supabaseService()
    .from(JOIN_TABLE)
    .select("profile_id, category_slug, categories!inner(label, position)")
    .eq("profile_id", profileId)
    .order("categories(position)", { ascending: true })
    .returns<DbProfileCategory[]>();
  if (error) throw new Error(`[profile-categories-adapter] listByProfile: ${error.message}`);
  return (data ?? []).map(joinRowFromDb);
}

/** Returns all available categories (admin-seeded lookup table). */
export async function listAllCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabaseService()
    .from(CATEGORIES_TABLE)
    .select("*")
    .order("position", { ascending: true })
    .returns<DbCategory[]>();
  if (error) throw new Error(`[profile-categories-adapter] listAll: ${error.message}`);
  return (data ?? []).map(categoryFromDb);
}

// ─── Writes ────────────────────────────────────────────────────────────────

/** Assign a category to a profile. Idempotent (composite PK). */
export async function addCategoryToProfile(
  profileId: string,
  categorySlug: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(JOIN_TABLE)
    .upsert(
      { profile_id: profileId, category_slug: categorySlug },
      { onConflict: "profile_id,category_slug" },
    );
  if (error) throw new Error(`[profile-categories-adapter] add: ${error.message}`);
}

/** Remove a category from a profile. */
export async function removeCategoryFromProfile(
  profileId: string,
  categorySlug: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from(JOIN_TABLE)
    .delete()
    .eq("profile_id", profileId)
    .eq("category_slug", categorySlug);
  if (error) throw new Error(`[profile-categories-adapter] remove: ${error.message}`);
}

/** Replace all categories for a profile in one shot. */
export async function setCategoriesForProfile(
  profileId: string,
  slugs: string[],
): Promise<void> {
  // Delete all existing
  const { error: delError } = await supabaseService()
    .from(JOIN_TABLE)
    .delete()
    .eq("profile_id", profileId);
  if (delError) throw new Error(`[profile-categories-adapter] set/delete: ${delError.message}`);

  // Insert new set
  if (slugs.length === 0) return;
  const rows = slugs.map((slug) => ({ profile_id: profileId, category_slug: slug }));
  const { error: insError } = await supabaseService().from(JOIN_TABLE).insert(rows);
  if (insError) throw new Error(`[profile-categories-adapter] set/insert: ${insError.message}`);
}

/** Test-only. */
export async function __resetProfileCategoriesDb(): Promise<void> {
  const { error } = await supabaseService()
    .from(JOIN_TABLE)
    .delete()
    .neq("profile_id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[profile-categories-adapter] reset: ${error.message}`);
}
