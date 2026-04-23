import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/verify — disconnect X or Telegram handle
 * Body: { platform: "x" | "tg", handle: null }
 *
 * Connecting is now handled via OAuth:
 *   X:        GET /api/auth/x/authorize → Twitter OAuth → callback
 *   Telegram: Login Widget on page → POST /api/auth/telegram/callback
 *
 * This route only handles DISCONNECT (handle: null).
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

  // Connecting is now OAuth-only — reject non-null handles
  if (handle !== null) {
    return NextResponse.json(
      { error: "Use OAuth to connect. Send handle: null to disconnect." },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (platform === "x") {
    updates.x_handle = null;
    updates.x_verified = false;
  } else {
    updates.telegram_handle = null;
    updates.telegram_verified = false;
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
    handle: null,
    verified: false,
  });
}
