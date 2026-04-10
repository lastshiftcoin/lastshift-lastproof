import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * PUT /api/dashboard/categories
 *
 * Sets the additional categories for a profile.
 * Body: { additional: string[] } — array of category slugs (max 4).
 *
 * Preserves the primary category (set via /api/dashboard/category).
 * Deletes any existing additional categories and replaces them.
 */
export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();

  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  if (!operator) {
    return NextResponse.json({ error: "no_operator" }, { status: 403 });
  }

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  let body: { additional: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { additional } = body;
  if (!Array.isArray(additional) || additional.length > 4) {
    return NextResponse.json({ error: "invalid_categories" }, { status: 400 });
  }

  try {
    // Get the current primary category so we preserve it
    const { data: existing } = await sb
      .from("profile_categories")
      .select("category_slug")
      .eq("profile_id", profile.id);

    // The primary is the first one (set by /api/dashboard/category or onboarding).
    // We'll keep it and replace everything else.
    // For simplicity: delete all, then insert primary + additional.
    const primarySlug = existing?.[0]?.category_slug ?? null;

    // Delete all existing
    await sb
      .from("profile_categories")
      .delete()
      .eq("profile_id", profile.id);

    // Build insert rows: primary first (if exists), then additional
    const rows: { profile_id: string; category_slug: string }[] = [];
    if (primarySlug) {
      rows.push({ profile_id: profile.id, category_slug: primarySlug });
    }
    for (const slug of additional) {
      if (slug !== primarySlug) {
        rows.push({ profile_id: profile.id, category_slug: slug });
      }
    }

    if (rows.length > 0) {
      const { error } = await sb
        .from("profile_categories")
        .insert(rows);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error("[categories] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 },
    );
  }
}
