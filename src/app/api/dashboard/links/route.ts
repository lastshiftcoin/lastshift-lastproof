import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/links — create a new link
 * DELETE /api/dashboard/links?id=xxx — delete a link
 * PATCH /api/dashboard/links — update pin state for a link
 */

async function getProfile(session: { walletAddress: string }) {
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();
  if (!operator) return { profile: null, sb };
  const profile = await getProfileByOperatorId(operator.id);
  return { profile, sb };
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { label, url, platform } = body;

  if (!label || !url) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Get next position
  const { data: existing } = await sb
    .from("profile_links")
    .select("position")
    .eq("profile_id", profile.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await sb
    .from("profile_links")
    .insert({
      profile_id: profile.id,
      label,
      url,
      platform: platform || "web",
      pinned: false,
      position: nextPos,
    })
    .select()
    .single();

  if (error) {
    console.error("[links] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    link: {
      id: data.id,
      label: data.label,
      url: data.url,
      platform: data.platform,
      pinned: data.pinned,
      position: data.position,
    },
  });
}

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const reqUrl = new URL(request.url);
  const id = reqUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Verify ownership
  const { data: link } = await sb
    .from("profile_links")
    .select("id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await sb.from("profile_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { id, pinned } = body;

  if (!id || typeof pinned !== "boolean") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Verify ownership
  const { data: link } = await sb
    .from("profile_links")
    .select("id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // If pinning, check max 6
  if (pinned) {
    const { count } = await sb
      .from("profile_links")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("pinned", true);

    if ((count ?? 0) >= 6) {
      return NextResponse.json({ error: "max_pinned" }, { status: 400 });
    }
  }

  const { error } = await sb
    .from("profile_links")
    .update({ pinned })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
