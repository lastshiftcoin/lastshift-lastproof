import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/work-items — create a new work item
 * DELETE /api/dashboard/work-items?id=xxx — delete a work item (only if no proofs)
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
  const { ticker, role, description, startedAt, endedAt } = body;

  if (!role || typeof role !== "string") {
    return NextResponse.json({ error: "missing_role" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("work_items")
    .insert({
      profile_id: profile.id,
      ticker: ticker || null,
      role,
      description: description || null,
      started_at: startedAt || null,
      ended_at: endedAt || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[work-items] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    item: {
      id: data.id,
      ticker: data.ticker,
      role: data.role,
      description: data.description,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      minted: data.minted ?? false,
      proofCount: 0,
      hasDevProof: false,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { id, ticker, role, description, startedAt, endedAt } = body;

  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (!role || typeof role !== "string") {
    return NextResponse.json({ error: "missing_role" }, { status: 400 });
  }

  // Verify ownership
  const { data: item } = await sb
    .from("work_items")
    .select("id, profile_id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Check for proofs — locked items cannot be edited
  const { count, data: proofRows } = await sb
    .from("proofs")
    .select("id, kind", { count: "exact" })
    .eq("work_item_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "locked_has_proofs" }, { status: 409 });
  }

  const { data, error } = await sb
    .from("work_items")
    .update({
      ticker: ticker || null,
      role,
      description: description || null,
      started_at: startedAt || null,
      ended_at: endedAt || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[work-items] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasDevProof = (proofRows ?? []).some((p: { kind: string }) => p.kind === "dev_verification");

  return NextResponse.json({
    item: {
      id: data.id,
      ticker: data.ticker,
      role: data.role,
      description: data.description,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      minted: data.minted ?? false,
      proofCount: count ?? 0,
      hasDevProof,
    },
  });
}

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Verify ownership and no proofs
  const { data: item } = await sb
    .from("work_items")
    .select("id, profile_id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Check for proofs referencing this work item
  const { count } = await sb
    .from("proofs")
    .select("id", { count: "exact", head: true })
    .eq("work_item_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "locked_has_proofs" }, { status: 409 });
  }

  const { error } = await sb.from("work_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
