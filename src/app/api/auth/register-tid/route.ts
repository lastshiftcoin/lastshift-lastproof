import { NextRequest, NextResponse } from "next/server";
import { validateTerminalId } from "@/lib/terminal-client";
import { writeSession } from "@/lib/session";

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
  let body: { walletAddress?: string; terminalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const walletAddress = (body.walletAddress || "").trim();
  const terminalId = (body.terminalId || "").trim().toUpperCase();

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

  // Check if operator row exists for this wallet
  const { data: existing } = await sb
    .from("operators")
    .select("id, terminal_id")
    .eq("terminal_wallet", walletAddress)
    .maybeSingle();

  let operatorId: string;

  if (existing) {
    // Update existing row with new TID (TID regeneration case)
    const { error: updateErr } = await sb
      .from("operators")
      .update({
        terminal_id: terminalId,
        first_five_thousand: result.firstFiveThousand,
        last_validated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateErr) {
      console.error("[register-tid] operator update failed:", updateErr.message);
      return NextResponse.json(
        { ok: false, reason: "server_error", message: "Could not update operator" },
        { status: 500 },
      );
    }
    operatorId = existing.id;
  } else {
    // Insert new operator row
    const { data: inserted, error: insertErr } = await sb
      .from("operators")
      .insert({
        terminal_wallet: walletAddress,
        terminal_id: terminalId,
        first_five_thousand: result.firstFiveThousand,
        last_validated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[register-tid] operator insert failed:", insertErr?.message);
      return NextResponse.json(
        { ok: false, reason: "server_error", message: "Could not create operator" },
        { status: 500 },
      );
    }
    operatorId = inserted.id;
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
