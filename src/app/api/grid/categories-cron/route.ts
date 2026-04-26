import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * Daily Vercel Cron — 00:10 UTC (see vercel.json).
 *
 * Refreshes the `categories.operator_count` column by calling the
 * `refresh_categories_operator_count()` Postgres function defined in
 * supabase/migrations/0023_categories_operator_count.sql.
 *
 * The Grid's category chip row reads this cached count to order chips by
 * usage descending. Counts can be up to 24h stale — acceptable trade since
 * chip counts are decorative and don't affect any business logic.
 *
 * Auth:
 *   - Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
 *   - Manual triggers (e.g. one-off after a migration) need the same header.
 *   - In dev (no CRON_SECRET set), the auth check is skipped so curl works.
 *
 * Rate limit: 10 req/min/IP — belt-and-suspenders. The CRON_SECRET check is
 * the real gate; this just bounds noise from probes against the public URL.
 */

const limiter = createRateLimiter({ window: 60_000, max: 10 });

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = limiter.check(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429 },
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, reason: "unauthorized" },
        { status: 401 },
      );
    }
  }

  const { error } = await supabaseService().rpc(
    "refresh_categories_operator_count",
  );
  if (error) {
    console.error("[grid/categories-cron] rpc error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
