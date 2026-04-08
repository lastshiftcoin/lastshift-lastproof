import { NextRequest, NextResponse } from "next/server";
import { listProfiles, __resetProfiles, updateProfile } from "@/lib/profiles-store";
import { listNotifications, __resetNotifications } from "@/lib/notifications-store";

/**
 * Dev-only inspector for the in-memory profiles store.
 *
 * GET    → list all profile rows
 * DELETE → reset the store (use between test runs)
 *
 * Disabled in production via NODE_ENV check.
 */

function forbidInProd() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "disabled_in_production" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = forbidInProd();
  if (blocked) return blocked;
  const rows = await listProfiles();
  return NextResponse.json({
    ok: true,
    count: rows.length,
    rows,
    notifications: await listNotifications(),
  });
}

export async function DELETE() {
  const blocked = forbidInProd();
  if (blocked) return blocked;
  __resetProfiles();
  __resetNotifications();
  return NextResponse.json({ ok: true });
}

/** PATCH { id, patch } — dev-only force-set profile fields (e.g. backdate expiry). */
export async function PATCH(req: NextRequest) {
  const blocked = forbidInProd();
  if (blocked) return blocked;
  const body = (await req.json()) as { id: string; patch: Record<string, unknown> };
  const row = await updateProfile(body.id, body.patch as never);
  return NextResponse.json({ ok: !!row, row });
}
