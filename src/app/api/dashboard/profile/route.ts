import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { updateProfile, getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * PATCH /api/dashboard/profile
 *
 * Updates profile fields from the dashboard editor cards.
 * Requires active session. Only the profile owner can update.
 *
 * Body: { fields: Record<string, unknown> }
 * Allowed fields: displayName, headline, pitch, about, bioStatement,
 *   timezone, language, feeRange, website, hireTelegramHandle
 */

const ALLOWED_FIELDS = new Set([
  "displayName",
  "headline",
  "pitch",
  "about",
  "bioStatement",
  "timezone",
  "language",
  "feeRange",
  "avatarUrl",
  "website",
  "hireTelegramHandle",
]);

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Look up operator + profile
  const { supabaseService } = await import("@/lib/db/client");
  const { data: operator } = await supabaseService()
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  if (!operator) {
    return NextResponse.json({ error: "no_operator" }, { status: 403 });
  }

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  let body: { fields: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Filter to allowed fields only
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.fields)) {
    if (ALLOWED_FIELDS.has(key)) {
      patch[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  try {
    const updated = await updateProfile(profile.id, patch);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    console.error("[dashboard/profile] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 },
    );
  }
}
