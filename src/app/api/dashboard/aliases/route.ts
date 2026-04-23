/**
 * PUT /api/dashboard/aliases — set the "Previously Known As" handles.
 * Body: { aliases: string[] }
 *
 * Stores aliases in profile_aliases table (cosmetic, user-managed).
 * Does NOT touch handle_history (system-managed audit trail for
 * cooldown + redirects).
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

  // Delete existing aliases for this profile
  await sb.from("profile_aliases").delete().eq("profile_id", profile.id);

  // Insert new aliases
  if (aliases.length > 0) {
    const rows = aliases.map((alias, i) => ({
      profile_id: profile.id,
      alias: alias.toLowerCase().replace(/^@/, "").trim(),
      position: i,
    }));

    const { error } = await sb.from("profile_aliases").insert(rows);
    if (error) {
      console.error("[aliases] insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: aliases.length });
}
