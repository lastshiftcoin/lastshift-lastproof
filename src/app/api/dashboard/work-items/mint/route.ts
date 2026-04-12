import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";
import { BASE_PRICES_USD, LASTSHFT_DISCOUNT } from "@/lib/pricing";

/**
 * POST /api/dashboard/work-items/mint
 * Body: { id: string }
 *
 * Validate-only. Checks ownership, proof count, mint cap. Does NOT
 * set minted=true — that happens in the payment dispatcher (handleMint
 * in payment-events.ts) after the webhook confirms the on-chain payment.
 *
 * Client flow:
 *   1. POST here to validate → { ok: true, pricing }
 *   2. POST /api/quote with { kind: "mint", metadata: { refId: workItemId } }
 *   3. Generic payment pipeline (build-tx → sign → broadcast → confirm)
 *   4. Webhook fires → dispatcher sets minted=true
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
  const { id } = body;

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

  // Validation passed — client should now issue a quote and pay via
  // the generic payment pipeline.
  return NextResponse.json({
    ok: true,
    workItemId: id,
    pricing: {
      baseUsd: BASE_PRICES_USD.mint,
      lastshftUsd: +(BASE_PRICES_USD.mint * (1 - LASTSHFT_DISCOUNT)).toFixed(2),
    },
  });
}
