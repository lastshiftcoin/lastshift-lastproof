import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * PUT /api/dashboard/work-items/reorder
 * Body: { ids: string[] } — ordered list of work item IDs (new position order)
 */
export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();

  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();
  if (!operator) return NextResponse.json({ error: "no_operator" }, { status: 404 });

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  }

  // Verify all IDs belong to this profile
  const { data: items } = await sb
    .from("work_items")
    .select("id")
    .eq("profile_id", profile.id)
    .in("id", ids);

  if (!items || items.length !== ids.length) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }

  // Update positions in order
  const updates = ids.map((id: string, i: number) =>
    sb.from("work_items").update({ position: i }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("[work-items/reorder] error:", failed.error);
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
