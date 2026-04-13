import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = new Date().toISOString();
  try {
    const { count, error } = await supabaseService()
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ status: "degraded", startedAt, error: error.message, tool: "lastproof" });
    }

    return NextResponse.json({ status: "ok", startedAt, profileCount: count, tool: "lastproof" });
  } catch (err) {
    return NextResponse.json({ status: "error", startedAt, error: (err as Error).message, tool: "lastproof" });
  }
}
