/**
 * GET /api/health
 *
 * Lightweight liveness + DB probe for the dual-write migration loop.
 * Returns Supabase reachability, latency, and the current per-store
 * mode flags. Use this between flips to confirm the new mode actually
 * propagated and the service-role connection is healthy.
 *
 * Always returns 200 with a `status` field — never 5xx — so uptime
 * monitors don't page on a transient DB blip. Read the body.
 */

import { NextResponse } from "next/server";
import { probeDb } from "../../../lib/db/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = new Date().toISOString();
  const db = await probeDb();
  return NextResponse.json({
    status: db.ok ? "ok" : "degraded",
    startedAt,
    db,
    tool: "lastproof",
  });
}
