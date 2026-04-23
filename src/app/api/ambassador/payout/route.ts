/**
 * POST /api/ambassador/payout
 *
 * Admin-only: records a payout for an ambassador. Writes to ambassador_payouts
 * with the Solscan tx signature as proof of payment.
 *
 * Body: { ambassador_id, period_start, period_end, referral_count, payout_usd, tx_signature }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ambassador_id, period_start, period_end, referral_count, payout_usd, tx_signature } =
    body as {
      ambassador_id?: string;
      period_start?: string;
      period_end?: string;
      referral_count?: number;
      payout_usd?: number;
      tx_signature?: string;
    };

  if (!ambassador_id || !period_start || !period_end || referral_count == null || payout_usd == null || !tx_signature) {
    return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }

  const sb = supabaseService();

  // Verify ambassador exists
  const { data: amb } = await sb
    .from("ambassadors")
    .select("id")
    .eq("id", ambassador_id)
    .maybeSingle();

  if (!amb) {
    return NextResponse.json({ ok: false, reason: "ambassador_not_found" }, { status: 404 });
  }

  const { error } = await sb.from("ambassador_payouts").insert({
    ambassador_id,
    period_start,
    period_end,
    referral_count,
    payout_usd,
    tx_signature,
    paid_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[ambassador/payout] insert error:", error.message);
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
