import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { upsertProfileByOperator } from "@/lib/profiles-store";
import type { ProfileRow } from "@/lib/profiles-store";
import {
  validateHandle,
  validateDisplayName,
  HANDLE_REJECTION_MESSAGE,
  DISPLAY_NAME_REJECTION_MESSAGE,
} from "@/lib/handle-validation";

/**
 * POST /api/onboarding
 *
 * Creates a new profile from the onboarding wizard data:
 *   { operatorId, handle, displayName, category, timezone, language, oneLiner }
 *
 * Steps:
 *   1. Validate session
 *   2. Verify operatorId belongs to session wallet
 *   3. Create profile via upsertProfileByOperator
 *   4. Update extra fields (timezone, language, bioStatement)
 *   5. Insert primary category into profile_categories
 *   6. Return the created profile
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    operatorId: string;
    handle: string;
    displayName: string;
    category: string | null;
    timezone: string;
    language: string;
    oneLiner: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { operatorId, handle, displayName, category, timezone, language, oneLiner } = body;

  // Basic validation
  if (!operatorId || !handle || !displayName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  // Reserved-word, brand-protection, profanity, founder-spoof checks.
  // See src/lib/handle-validation.ts for rules. Internal `reason` is
  // logged for observability; user only ever sees the generic message.
  const handleCheck = validateHandle(handle);
  if (!handleCheck.ok) {
    console.log(
      `[onboarding] handle rejected: handle=${handle.slice(0, 32)} reason=${handleCheck.reason}`,
    );
    return NextResponse.json(
      { error: "handle_not_acceptable", message: HANDLE_REJECTION_MESSAGE },
      { status: 400 },
    );
  }

  // Display name validation — length, invisible-char block, brand /
  // founder / personal-name / profanity checks. See
  // src/lib/handle-validation.ts for full rules.
  const displayNameCheck = validateDisplayName(displayName);
  if (!displayNameCheck.ok) {
    console.log(
      `[onboarding] display_name rejected: reason=${displayNameCheck.reason}`,
    );
    return NextResponse.json(
      { error: "display_name_not_acceptable", message: DISPLAY_NAME_REJECTION_MESSAGE },
      { status: 400 },
    );
  }

  // Verify operatorId belongs to session wallet
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();

  const { data: operator } = await sb
    .from("operators")
    .select("id, terminal_wallet")
    .eq("id", operatorId)
    .maybeSingle();

  if (!operator || operator.terminal_wallet !== session.walletAddress) {
    return NextResponse.json({ error: "operator_mismatch" }, { status: 403 });
  }

  // Check handle isn't taken (race condition guard)
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .ilike("handle", handle)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  try {
    // 1. Create profile
    const profile: ProfileRow = await upsertProfileByOperator({
      operatorId,
      terminalWallet: session.walletAddress,
      handle: handle.toLowerCase(),
      displayName: displayName.trim(),
      isEarlyAdopter: session.firstFiveThousand,
    });

    // 2. Update additional fields that upsertProfileByOperator doesn't cover
    const { updateProfile } = await import("@/lib/profiles-store");
    const updated = await updateProfile(profile.id, {
      timezone: timezone || null,
      language: language || null,
      bioStatement: oneLiner || null,
    });

    // 3. Insert primary category (if selected)
    if (category) {
      // First ensure the category slug exists in categories table
      const { data: catRow } = await sb
        .from("categories")
        .select("slug")
        .eq("slug", category)
        .maybeSingle();

      if (catRow) {
        await sb
          .from("profile_categories")
          .upsert(
            { profile_id: profile.id, category_slug: category },
            { onConflict: "profile_id,category_slug" },
          );
      }
    }

    return NextResponse.json({ profile: updated ?? profile });
  } catch (err) {
    console.error("[onboarding] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 },
    );
  }
}
