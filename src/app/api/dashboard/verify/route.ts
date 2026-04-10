import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/verify — link/unlink X or Telegram handle
 * Body: { platform: "x" | "tg", handle: string | null }
 *
 * When handle is provided: sets the handle (verification is pending admin review).
 * When handle is null: disconnects the platform.
 *
 * NOTE: In a future iteration, X uses OAuth and Telegram uses a bot widget.
 * For MVP, operators self-report their handles. The `x_verified` and
 * `tg_verified` flags are set by admin/automated verification later.
 */

async function getProfileAndSb(session: { walletAddress: string }) {
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

  const { profile, sb } = await getProfileAndSb(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const { platform, handle } = body;

  if (platform !== "x" && platform !== "tg") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const cleanHandle = handle
    ? handle.replace(/^@/, "").trim().toLowerCase()
    : null;

  if (cleanHandle && (cleanHandle.length < 1 || cleanHandle.length > 40)) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (platform === "x") {
    updates.x_handle = cleanHandle;
    // Don't auto-verify — that requires OAuth or admin action
    // If disconnecting, also clear verified flag
    if (!cleanHandle) updates.x_verified = false;
  } else {
    // DB column is telegram_handle, not tg_handle
    updates.telegram_handle = cleanHandle;
    if (!cleanHandle) updates.telegram_verified = false;
  }

  const { error } = await sb
    .from("profiles")
    .update(updates)
    .eq("id", profile.id);

  if (error) {
    console.error("[verify] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    platform,
    handle: cleanHandle,
    verified: false, // Always false on self-link; admin verifies later
  });
}
