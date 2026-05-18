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
import { getCurrentWeekWindowPT } from "@/lib/weekly-window";

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

export interface RecordWeeklyPayoutResult {
  ok: boolean;
  error?: string;
  message?: string;
  payoutId?: string;
  referralCount?: number;
}

/**
 * Record a weekly retainer payout for a `weekly_flat` ambassador
 * (e.g. Habilamar — $80/month, paid weekly, 250-referral quota).
 *
 * Writes one ambassador_payouts row covering the current Sun-8pm-PT
 * week boundary, with paid_at = now() and the supplied solscan tx
 * signature. referral_count snapshots the count for the period at
 * the moment of payout. payout_usd is stored internally for ledger
 * integrity but never surfaced on the public report for this model.
 *
 * Idempotent guard: if a payout for the same (ambassador, period_start)
 * already exists, returns an error rather than double-writing.
 */
export async function recordWeeklyPayout(
  ambassadorId: string,
  txSignature: string,
): Promise<RecordWeeklyPayoutResult> {
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

    // Verify the ambassador is on the weekly_flat model
    const { data: amb, error: ambErr } = await sb
      .from("ambassadors")
      .select("id, campaign_slug, payout_model, weekly_program_started_at")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (ambErr || !amb) {
      return {
        ok: false,
        error: "ambassador_not_found",
        message: "Ambassador not found or inactive.",
      };
    }

    if (amb.payout_model !== "weekly_flat") {
      return {
        ok: false,
        error: "wrong_payout_model",
        message: "This ambassador is on the per-referral model, not weekly_flat.",
      };
    }

    const { start, end } = getCurrentWeekWindowPT();

    // Idempotency check
    const { data: existing } = await sb
      .from("ambassador_payouts")
      .select("id")
      .eq("ambassador_id", id)
      .eq("period_start", start.toISOString())
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: "already_paid",
        message: "A payout for this week has already been recorded.",
      };
    }

    // Floor at program start so a partial first week doesn't include
    // backlog claims from before the model launched.
    const programStart = amb.weekly_program_started_at
      ? new Date(amb.weekly_program_started_at)
      : null;
    const effectiveStart =
      programStart && programStart > start ? programStart : start;

    // Snapshot the count for the week
    const { count, error: countErr } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", amb.campaign_slug)
      .gte("ea_claimed_at", effectiveStart.toISOString())
      .lte("ea_claimed_at", end.toISOString());

    if (countErr) {
      return {
        ok: false,
        error: "count_failed",
        message: countErr.message,
      };
    }

    const referralCount = count ?? 0;
    const now = new Date().toISOString();

    // payout_usd: $80/month ÷ 4 weeks = $20/week. Stored for ledger
    // integrity. Never displayed on the weekly_flat public report.
    const { data: inserted, error: insertErr } = await sb
      .from("ambassador_payouts")
      .insert({
        ambassador_id: id,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        referral_count: referralCount,
        payout_usd: 20,
        tx_signature: tx,
        paid_at: now,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return {
        ok: false,
        error: "insert_failed",
        message: insertErr?.message ?? "Could not record payout.",
      };
    }

    revalidatePath("/5k/god-ops");
    revalidatePath(`/5k/[reportSlug]`, "page");

    return {
      ok: true,
      payoutId: inserted.id,
      referralCount,
      message: `Recorded weekly payout — ${referralCount} referral${referralCount === 1 ? "" : "s"} this week.`,
    };
  } catch (err) {
    console.error("[god-ops/actions] recordWeeklyPayout error:", err);
    return {
      ok: false,
      error: "unexpected",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
