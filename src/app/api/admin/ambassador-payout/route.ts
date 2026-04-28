/**
 * POST /api/admin/ambassador-payout
 *
 * Internal admin endpoint — bearer token gated.
 *
 * Marks all currently-unpaid referrals for a given ambassador as paid
 * in a single atomic operation:
 *   1. Inserts an `ambassador_payouts` row (referral_count, payout_usd,
 *      tx_signature, paid_at)
 *   2. Updates every matching unpaid `profiles` row: sets
 *      `ambassador_paid_at` and `ambassador_payout_id` linking back
 *      to the new payout
 *
 * The atomicity is enforced by the Postgres function
 * `mark_ambassador_referrals_paid()` (see migration 0023). The whole
 * thing runs inside one Postgres transaction; either all rows update
 * together or nothing does.
 *
 * Auth: `Authorization: Bearer ${LASTPROOF_ADMIN_API_TOKEN}` (env, set
 * sensitive on Vercel).
 *
 * Body:
 *   {
 *     ambassador_id: string (uuid),
 *     tx_signature:  string  // Solscan URL or bare base58 signature;
 *                            // pass-through, not validated server-side
 *   }
 *
 * Returns 200 with:
 *   {
 *     ok: true,
 *     payout_id: string,
 *     referral_count: number,
 *     payout_usd: number
 *   }
 *
 * Errors:
 *   400 missing_fields — ambassador_id or tx_signature absent
 *   404 ambassador_not_found — RPC says no active ambassador with that id
 *   400 no_unpaid_referrals — RPC says zero unpaid referrals to mark
 *   403 forbidden — bearer token bad/missing
 *   500 internal_error — supabase RPC threw
 */

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.LASTPROOF_ADMIN_API_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return forbidden();

  let body: { ambassador_id?: string; tx_signature?: string };
  try {
    body = (await request.json()) as {
      ambassador_id?: string;
      tx_signature?: string;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ambassadorId = (body.ambassador_id ?? "").trim();
  const txSignature = (body.tx_signature ?? "").trim();

  if (!ambassadorId || !txSignature) {
    return NextResponse.json(
      { error: "missing_fields", message: "ambassador_id and tx_signature required" },
      { status: 400 },
    );
  }

  try {
    const sb = supabaseService();
    const { data, error } = await sb.rpc("mark_ambassador_referrals_paid", {
      p_ambassador_id: ambassadorId,
      p_tx_signature: txSignature,
    });

    if (error) {
      console.error("[admin/ambassador-payout] RPC error:", error.message);
      return NextResponse.json(
        { error: "internal_error", message: error.message },
        { status: 500 },
      );
    }

    // The RPC returns jsonb; supabase-js gives it back as an object
    const result = data as {
      ok: boolean;
      error?: string;
      payout_id?: string;
      referral_count?: number;
      payout_usd?: number;
    };

    if (!result.ok) {
      const status = result.error === "ambassador_not_found" ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    console.log(
      `[admin/ambassador-payout] paid ambassador=${ambassadorId} count=${result.referral_count} usd=${result.payout_usd} payout=${result.payout_id}`,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/ambassador-payout] unexpected error:", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
