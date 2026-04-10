import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/work-items/mint
 * Body: { id: string, txSignature: string }
 *
 * Marks a work item as minted after verifying the operator owns it
 * and the item has at least 1 proof (you shouldn't mint empty items).
 *
 * NOTE: txSignature verification against the chain is a future step.
 * For now, presence of a signature is required as a gate.
 */
export async function POST(request: Request) {
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
  const { id, txSignature } = body;

  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Verify ownership
  const { data: item } = await sb
    .from("work_items")
    .select("id, profile_id, minted")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item.minted) return NextResponse.json({ error: "already_minted" }, { status: 409 });

  // Check max 4 minted
  const { count: mintedCount } = await sb
    .from("work_items")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("minted", true);

  if ((mintedCount ?? 0) >= 4) {
    return NextResponse.json({ error: "max_minted" }, { status: 400 });
  }

  // Require at least 1 proof
  const { count: proofCount } = await sb
    .from("proofs")
    .select("id", { count: "exact", head: true })
    .eq("work_item_id", id);

  if ((proofCount ?? 0) === 0) {
    return NextResponse.json({ error: "no_proofs" }, { status: 400 });
  }

  // TODO: Verify txSignature is a valid on-chain mint transaction
  if (!txSignature || typeof txSignature !== "string") {
    return NextResponse.json({ error: "missing_tx" }, { status: 402 });
  }

  const { error } = await sb
    .from("work_items")
    .update({ minted: true })
    .eq("id", id);

  if (error) {
    console.error("[work-items/mint] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, minted: true });
}
