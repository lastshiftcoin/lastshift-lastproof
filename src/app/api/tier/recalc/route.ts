import { NextRequest, NextResponse } from "next/server";
import { recalcProfileTier } from "@/lib/tier-recalc";
import { listProfiles } from "@/lib/profiles-store";

/**
 * POST /api/tier/recalc  { profileId? }
 * Dev/admin only. If profileId omitted, recalcs everything (nightly job).
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { profileId?: string };
  if (body.profileId) {
    return NextResponse.json(await recalcProfileTier(body.profileId));
  }
  const profiles = await listProfiles();
  const results = await Promise.all(profiles.map((p) => recalcProfileTier(p.id)));
  return NextResponse.json({ ok: true, count: results.length, results });
}
