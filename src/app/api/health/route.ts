import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { probeDb } = await import("../../../lib/db/health");
    const db = await probeDb();
    return NextResponse.json({
      status: db.ok ? "ok" : "degraded",
      startedAt: new Date().toISOString(),
      db,
      tool: "lastproof",
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      startedAt: new Date().toISOString(),
      error: (err as Error).message,
      tool: "lastproof",
    });
  }
}
