import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateTerminalId } from "@/lib/terminal-client";
import { writeSession } from "@/lib/session";
import { logReferralEvent } from "@/lib/referral-events";

/**
 * POST /api/auth/register-tid
 * Body: { walletAddress, terminalId }
 *
 * Called when:
 *   1. A NEW wallet enters a TID for the first time (creates operators row)
 *   2. A RETURNING user's TID was regenerated (updates existing operators row)
 *
 * Flow:
 *   - Validate wallet + TID against real Terminal
 *   - If valid: upsert operators row, write session cookie
 *   - If invalid: return the failure reason
 *
 * This is the ONLY place operators rows are created/updated with new TIDs.
 */
export async function POST(req: NextRequest) {
  let body: { walletAddress?: string; terminalId?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const walletAddress = (body.walletAddress || "").trim();
  const terminalId = (body.terminalId || "").trim().toUpperCase();

  // Attribution source priority (first-non-null wins):
  //   1. body.ref         — URL ?ref= carried from /manage?ref=<slug>
  //   2. lp_ref cookie    — set by src/proxy.ts on ambassador landing visits,
  //                         survives tab close and direct /manage navigations
  //                         (the missing link that dropped @namesake01's
  //                         attribution on 2026-04-22).
  const cookieStore = await cookies();
  const cookieRef = cookieStore.get("lp_ref")?.value ?? null;
  const rawRef = ((body.ref || "").trim() || null) ?? cookieRef;
  const refSource: "body" | "cookie" | "none" = body.ref
    ? "body"
    : cookieRef
      ? "cookie"
      : "none";

  if (!walletAddress) {
    return NextResponse.json({ ok: false, reason: "wallet_required" }, { status: 400 });
  }

  // Basic format check: accepts both legacy SHIFT-XXXX-XXXX-XXXX-XXXX
  // and real Terminal format XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of 4 alphanum)
  if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/.test(terminalId) &&
      !/^SHIFT-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(terminalId)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_format", message: "Terminal ID format: XXXX-XXXX-XXXX-XXXX-XXXX" },
      { status: 400 },
    );
  }

  // Validate against real Terminal
  const result = await validateTerminalId(walletAddress, terminalId, { skipCache: true });

  if (!result.valid) {
    return NextResponse.json(
      { ok: false, reason: result.reason, message: result.message },
      { status: result.httpStatus || 400 },
    );
  }

  // Terminal confirmed this wallet + TID is valid.
  // Upsert the operators row (insert new OR update existing TID).
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();

  // Validate ref against ambassadors table (first-touch wins downstream).
  // Only server-validated slugs are persisted.
  let validatedRef: string | null = null;
  let refOutcome: "no_ref" | "invalid_slug" | "valid" = "no_ref";
  if (rawRef) {
    const { data: amb } = await sb
      .from("ambassadors")
      .select("campaign_slug")
      .eq("campaign_slug", rawRef)
      .eq("is_active", true)
      .maybeSingle();
    if (amb) {
      validatedRef = amb.campaign_slug;
      refOutcome = "valid";
    } else {
      refOutcome = "invalid_slug";
    }
  }

  // Check if operator row exists for this wallet
  const { data: existing } = await sb
    .from("operators")
    .select("id, terminal_id, referred_by")
    .eq("terminal_wallet", walletAddress)
    .maybeSingle();

  let operatorId: string;

  if (existing) {
    // Update existing row with new TID (TID regeneration case).
    // First-touch wins: only stamp referred_by if it's currently null.
    const shouldStampRef = validatedRef && !existing.referred_by;
    const { error: updateErr } = await sb
      .from("operators")
      .update({
        terminal_id: terminalId,
        first_five_thousand: result.firstFiveThousand,
        last_validated_at: new Date().toISOString(),
        ...(shouldStampRef ? { referred_by: validatedRef } : {}),
      })
      .eq("id", existing.id);

    if (updateErr) {
      console.error("[register-tid] operator update failed:", updateErr.message);
      logReferralEvent({
        type: "register_tid",
        walletAddress,
        operatorId: existing.id,
        campaignSlug: validatedRef ?? rawRef,
        source: refSource,
        outcome: "error",
        metadata: { error: updateErr.message, path: "update" },
      });
      return NextResponse.json(
        { ok: false, reason: "server_error", message: "Could not update operator" },
        { status: 500 },
      );
    }
    operatorId = existing.id;
    // Log attribution outcome for this existing-operator update path
    logReferralEvent({
      type: "register_tid",
      walletAddress,
      operatorId,
      campaignSlug: existing.referred_by ?? (shouldStampRef ? validatedRef : null),
      source: shouldStampRef
        ? refSource
        : existing.referred_by
          ? "operator"
          : "none",
      outcome: shouldStampRef
        ? "stamped"
        : existing.referred_by
          ? "already_stamped"
          : refOutcome === "invalid_slug"
            ? "invalid_slug"
            : "no_ref",
      metadata: { path: "update", isNew: false, incomingRef: rawRef },
    });
  } else {
    // Insert new operator row — attribution stamped here for the first time
    const { data: inserted, error: insertErr } = await sb
      .from("operators")
      .insert({
        terminal_wallet: walletAddress,
        terminal_id: terminalId,
        first_five_thousand: result.firstFiveThousand,
        last_validated_at: new Date().toISOString(),
        ...(validatedRef ? { referred_by: validatedRef } : {}),
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[register-tid] operator insert failed:", insertErr?.message);
      logReferralEvent({
        type: "register_tid",
        walletAddress,
        campaignSlug: validatedRef ?? rawRef,
        source: refSource,
        outcome: "error",
        metadata: { error: insertErr?.message ?? "unknown", path: "insert" },
      });
      return NextResponse.json(
        { ok: false, reason: "server_error", message: "Could not create operator" },
        { status: 500 },
      );
    }
    operatorId = inserted.id;
    if (validatedRef) {
      console.log(`[register-tid] referral attributed — operator=${operatorId} slug=${validatedRef}`);
    }
    logReferralEvent({
      type: "register_tid",
      walletAddress,
      operatorId,
      campaignSlug: validatedRef,
      source: validatedRef ? refSource : "none",
      outcome: validatedRef
        ? "stamped"
        : refOutcome === "invalid_slug"
          ? "invalid_slug"
          : "no_ref",
      metadata: { path: "insert", isNew: true, incomingRef: rawRef },
    });
  }

  // Consume the lp_ref cookie once the operators row has been written
  // (either inserted or updated). Whether or not we ended up stamping
  // referred_by (first-touch may already be set), the cookie has served
  // its purpose — subsequent visits shouldn't re-trigger stamping logic.
  if (refSource === "cookie") {
    cookieStore.delete("lp_ref");
  }

  // Write session cookie
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
    isNew: !existing,
    operatorId,
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
