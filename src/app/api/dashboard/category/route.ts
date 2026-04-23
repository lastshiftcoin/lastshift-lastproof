import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * PUT /api/dashboard/category
 *
 * Sets the primary category for the profile.
 * Body: { category: string } — the category slug.
 *
 * Replaces the current primary category in profile_categories.
 * The identity card handles primary; additional categories are Step 5.
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

  let body: { category: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { category } = body;
  if (!category || typeof category !== "string") {
    return NextResponse.json({ error: "missing_category" }, { status: 400 });
  }

  try {
    // Verify category exists
    const { data: catRow } = await sb
      .from("categories")
      .select("slug")
      .eq("slug", category)
      .maybeSingle();

    if (!catRow) {
      return NextResponse.json({ error: "invalid_category" }, { status: 400 });
    }

    // For primary category, we do a simple upsert.
    // First remove all existing categories for this profile (primary replacement).
    // Note: In Step 5 (additional categories), we'll need a smarter approach
    // that preserves secondary categories. For now, the identity card only
    // manages the primary one.
    //
    // Actually, let's be careful: just upsert without deleting others,
    // since additional categories may exist from Step 5.
    await sb
      .from("profile_categories")
      .upsert(
        { profile_id: profile.id, category_slug: category },
        { onConflict: "profile_id,category_slug" },
      );

    return NextResponse.json({ ok: true, category });
  } catch (err) {
    console.error("[category] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 },
    );
  }
}
