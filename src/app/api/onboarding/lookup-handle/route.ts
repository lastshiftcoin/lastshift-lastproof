import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { parseReferralHandle, ambassadorSlugForHandle } from "@/lib/referral-lookup";

/**
 * POST /api/onboarding/lookup-handle
 * Body: { input: string }
 *
 * Live UX feedback for the "Referred by an operator?" field on the
 * onboarding modal. Debounced from the client.
 *
 * Returns one of:
 *   { kind: "empty" }                       — input parsed to nothing
 *   { kind: "invalid" }                     — input couldn't be parsed
 *   { kind: "ambassador", handle, tgHandle?, campaignSlug } — ambassador profile
 *   { kind: "operator", handle }            — regular profile exists
 *   { kind: "not_found", handle }           — parsed but no profile owns it
 *
 * No auth required: the field is shown pre-onboarding. Cheap query.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ kind: "invalid" });
  }

  const raw = (body.input || "").trim();
  if (!raw) return NextResponse.json({ kind: "empty" });

  const handle = parseReferralHandle(raw);
  if (!handle) return NextResponse.json({ kind: "invalid" });

  const sb = supabaseService();

  const { data: profile } = await sb
    .from("profiles")
    .select("id, handle")
    .ilike("handle", handle)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ kind: "not_found", handle });
  }

  const campaignSlug = ambassadorSlugForHandle(handle);
  if (campaignSlug) {
    // Pull the friendly tg_handle for display ("Nice — @Habilamar_ibn").
    const { data: amb } = await sb
      .from("ambassadors")
      .select("tg_handle")
      .eq("campaign_slug", campaignSlug)
      .eq("is_active", true)
      .maybeSingle();

    return NextResponse.json({
      kind: "ambassador",
      handle: profile.handle,
      tgHandle: amb?.tg_handle ?? null,
      campaignSlug,
    });
  }

  return NextResponse.json({ kind: "operator", handle: profile.handle });
}
