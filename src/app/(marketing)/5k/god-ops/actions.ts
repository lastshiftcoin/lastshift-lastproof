"use server";

/**
 * Server Actions for the god-ops admin dashboard.
 *
 * Runs server-side with the Supabase service role — no token needs
 * to leave the browser. The form on the god-ops page calls these
 * directly.
 *
 * Same atomic operation as the HTTP endpoint at
 * /api/admin/ambassador-payout, just routed through Next's Server
 * Actions transport rather than fetch().
 */

import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/db/client";

export interface MarkPaidResult {
  ok: boolean;
  error?: string;
  payout_id?: string;
  referral_count?: number;
  payout_usd?: number;
  message?: string;
}

/**
 * Mark all currently-unpaid referrals for an ambassador as paid.
 * Atomically inserts an `ambassador_payouts` row + updates every
 * matching `profiles` row to link back to it.
 *
 * Args:
 *   ambassadorId — the ambassadors.id (uuid)
 *   txSignature  — Solscan link or bare base58 tx sig (pass-through)
 */
export async function markAmbassadorReferralsPaid(
  ambassadorId: string,
  txSignature: string,
): Promise<MarkPaidResult> {
  const id = ambassadorId.trim();
  const tx = txSignature.trim();

  if (!id || !tx) {
    return {
      ok: false,
      error: "missing_fields",
      message: "Ambassador and tx signature are both required.",
    };
  }

  try {
    const sb = supabaseService();
    const { data, error } = await sb.rpc("mark_ambassador_referrals_paid", {
      p_ambassador_id: id,
      p_tx_signature: tx,
    });

    if (error) {
      console.error("[god-ops/actions] RPC error:", error.message);
      return { ok: false, error: "rpc_error", message: error.message };
    }

    const result = data as MarkPaidResult;

    if (!result.ok) {
      const friendly =
        result.error === "ambassador_not_found"
          ? "Ambassador not found or inactive."
          : result.error === "no_unpaid_referrals"
            ? "No unpaid referrals to mark for this ambassador."
            : `Error: ${result.error ?? "unknown"}`;
      return { ...result, message: friendly };
    }

    // Refresh the god-ops page so the unpaid counts drop to 0
    // immediately after the form submits.
    revalidatePath("/5k/god-ops");
    revalidatePath(`/5k/[reportSlug]`, "page");

    return {
      ...result,
      message: `Paid ${result.referral_count} referral${result.referral_count === 1 ? "" : "s"} ($${result.payout_usd?.toFixed(2)}).`,
    };
  } catch (err) {
    console.error("[god-ops/actions] unexpected error:", err);
    return {
      ok: false,
      error: "unexpected",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
