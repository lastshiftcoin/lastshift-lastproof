import { NextResponse } from "next/server";
import { listProfiles } from "@/lib/profiles-store";
import { projectPublicView } from "@/lib/public-view";

/**
 * GET /api/profile/[handle]
 *
 * Public read. Routes through the stripe-down projector so expired
 * profiles return the NON-ACTIVE shell. Owners hitting their own profile
 * through the dashboard use a different path that bypasses this.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const profile = listProfiles().find((p) => p.handle === handle.toLowerCase()) || null;
  const view = projectPublicView(profile);
  if (!view) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, view });
}
