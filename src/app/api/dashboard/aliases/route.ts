/**
 * PUT /api/dashboard/aliases — set the "Previously Known As" handles.
 * Body: { aliases: string[] }
 *
 * Replaces all handle_history rows for this profile with the provided
 * aliases. Each alias is stored as a history entry with the current
 * handle as new_handle.
 */

import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { supabaseService } from "@/lib/db/client";
import { getProfileByOperatorId } from "@/lib/profiles-store";

export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseService();
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();
  if (!operator) return NextResponse.json({ error: "no_operator" }, { status: 404 });

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json();
  const aliases: string[] = Array.isArray(body.aliases) ? body.aliases : [];

  // Delete existing history entries
  await sb.from("handle_history").delete().eq("profile_id", profile.id);

  // Insert new entries
  if (aliases.length > 0) {
    const rows = aliases.map((oldHandle) => ({
      id: crypto.randomUUID(),
      profile_id: profile.id,
      old_handle: oldHandle.toLowerCase().replace(/^@/, "").trim(),
      new_handle: profile.handle,
      changed_at: new Date().toISOString(),
    }));

    const { error } = await sb.from("handle_history").insert(rows);
    if (error) {
      console.error("[aliases] insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: aliases.length });
}
