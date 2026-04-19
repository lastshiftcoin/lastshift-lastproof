import { NextRequest, NextResponse } from "next/server";
import { validateTerminalId } from "@/lib/terminal-client";
import { writeSession, readSession } from "@/lib/session";
import { logReferralEvent } from "@/lib/referral-events";

/**
 * POST /api/auth/wallet-gate
 * Body: { walletAddress }
 *
 * Manage-page entry point. Called after wallet connects. Two-step:
 *
 * 1. If the user already has a valid session cookie for this wallet, return it.
 * 2. Otherwise, look up the operator by wallet. In production, this would call
 *    a Terminal wallet-lookup endpoint. For now, we query Supabase's operators
 *    table directly to find the terminal_id, then validate via Terminal.
 *
 * Returns:
 *   { ok: true, session }          — Terminal ID verified, session written
 *   { ok: false, reason: "no_terminal" } — wallet has no Terminal ID
 *   { ok: false, reason: "...", message: "..." } — other failure
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const walletAddress = (body.walletAddress || "").trim();
  const rawRef = (body.ref || "").trim() || null;
  if (!walletAddress) {
    return NextResponse.json({ error: "wallet_required" }, { status: 400 });
  }

  // 1. Check existing session
  const existing = await readSession();
  if (existing && existing.walletAddress === walletAddress) {
    return NextResponse.json({ ok: true, session: existing });
  }

  // 2. Look up terminal_id from operators table
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();
  const { data: operator, error } = await sb
    .from("operators")
    .select("id, terminal_id, referred_by")
    .eq("terminal_wallet", walletAddress)
    .maybeSingle();

  if (error) {
    console.error("[wallet-gate] operator lookup failed:", error.message);
    return NextResponse.json(
      { ok: false, reason: "server_error", message: "Could not look up operator" },
      { status: 500 },
    );
  }

  if (!operator || !operator.terminal_id) {
    // Log new-wallet attempts so we still see the funnel entry even when no
    // operators row exists yet. Without this, unknown wallets would arrive
    // silently and we'd only see them later at register_tid. Outcome=no_ref
    // is informational here — attribution (if any) happens at register_tid.
    logReferralEvent({
      type: "wallet_gate",
      walletAddress,
      campaignSlug: rawRef,
      source: rawRef ? "body" : "none",
      outcome: "no_ref",
      metadata: { newWallet: true, hasIncomingRef: !!rawRef },
    });
    return NextResponse.json(
      { ok: false, reason: "no_terminal", message: "No terminal ID bound to this wallet" },
      { status: 404 },
    );
  }

  // First-touch attribution: if operator has no referred_by yet and the
  // visitor arrived via a valid ambassador URL, stamp it now. Wallet-gate
  // is called on every wallet connect, so this catches returning users who
  // first authenticated before this fix shipped.
  if (!rawRef) {
    // Returning user (or direct /manage visit) with no ref in the URL.
    // Not an error — just means no attribution signal to capture here.
    logReferralEvent({
      type: "wallet_gate",
      walletAddress,
      operatorId: operator.id,
      campaignSlug: operator.referred_by ?? null,
      source: operator.referred_by ? "operator" : "none",
      outcome: operator.referred_by ? "already_stamped" : "no_ref",
    });
  } else if (operator.referred_by) {
    // Ref present but operator already attributed — first-touch wins.
    logReferralEvent({
      type: "wallet_gate",
      walletAddress,
      operatorId: operator.id,
      campaignSlug: operator.referred_by,
      source: "operator",
      outcome: "already_stamped",
      metadata: { incomingRef: rawRef },
    });
  } else {
    const { data: amb } = await sb
      .from("ambassadors")
      .select("campaign_slug")
      .eq("campaign_slug", rawRef)
      .eq("is_active", true)
      .maybeSingle();
    if (!amb) {
      logReferralEvent({
        type: "wallet_gate",
        walletAddress,
        operatorId: operator.id,
        campaignSlug: rawRef,
        source: "body",
        outcome: "invalid_slug",
      });
    } else {
      const { error: stampErr } = await sb
        .from("operators")
        .update({ referred_by: amb.campaign_slug })
        .eq("id", operator.id)
        .is("referred_by", null); // double-guard against races
      if (stampErr) {
        console.error("[wallet-gate] referral stamp failed:", stampErr.message);
        logReferralEvent({
          type: "wallet_gate",
          walletAddress,
          operatorId: operator.id,
          campaignSlug: amb.campaign_slug,
          source: "body",
          outcome: "error",
          metadata: { error: stampErr.message },
        });
      } else {
        console.log(`[wallet-gate] referral attributed — operator=${operator.id} slug=${amb.campaign_slug}`);
        logReferralEvent({
          type: "wallet_gate",
          walletAddress,
          operatorId: operator.id,
          campaignSlug: amb.campaign_slug,
          source: "body",
          outcome: "stamped",
        });
      }
    }
  }

  // 3. Validate via Terminal
  const result = await validateTerminalId(walletAddress, operator.terminal_id, {
    skipCache: true,
  });

  if (!result.valid) {
    // TID was regenerated — wallet exists but stored TID is stale.
    // Return a distinct reason so the frontend can show the re-auth TID input.
    if (result.reason === "tid_regenerated" || result.reason === "tid_not_found") {
      return NextResponse.json(
        { ok: false, reason: "tid_reset", message: "Your Terminal ID has changed. Enter your new one." },
        { status: 403 },
      );
    }
    // Wallet not in Terminal at all
    if (result.reason === "wallet_not_registered") {
      return NextResponse.json(
        { ok: false, reason: "no_terminal", message: result.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, reason: result.reason, message: result.message },
      { status: result.httpStatus || 400 },
    );
  }

  // 4. Write session
  await writeSession({
    walletAddress: result.walletAddress,
    terminalId: result.terminalId,
    firstFiveThousand: result.firstFiveThousand,
    freeSubUntil: result.freeSubUntil,
    subscriptionStatus: result.subscriptionStatus,
    verified: result.verified,
    displayName: result.displayName,
  });

  return NextResponse.json({
    ok: true,
    session: {
      walletAddress: result.walletAddress,
      terminalId: result.terminalId,
      firstFiveThousand: result.firstFiveThousand,
      freeSubUntil: result.freeSubUntil,
      subscriptionStatus: result.subscriptionStatus,
      verified: result.verified,
      displayName: result.displayName,
    },
  });
}
