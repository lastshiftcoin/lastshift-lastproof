import { NextRequest, NextResponse } from "next/server";
import {
  runAffiliateWorker,
  listAffiliateJobs,
  __resetAffiliateQueue,
} from "@/lib/affiliate-queue";

/**
 * Affiliate worker endpoint.
 *
 * Runs one pass of the in-memory affiliate queue: picks every job whose
 * nextRunAt has elapsed, calls Terminal's confirmAffiliate S2S endpoint,
 * and marks done / requeues / dead-letters per the retry schedule in
 * `lib/affiliate-queue.ts`.
 *
 * Auth: Vercel Cron hits GET with `Authorization: Bearer $CRON_SECRET`
 * every 10 minutes (see vercel.json). Manual dev invocation is allowed
 * when CRON_SECRET is not set.
 *
 * POST is kept for test harnesses (bypasses cron-secret gate in dev).
 */

function authorize(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev — no secret configured
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

async function runPass() {
  const summary = await runAffiliateWorker();
  return { ok: true, ...summary, jobs: listAffiliateJobs() };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runPass());
}

export async function POST(req: NextRequest) {
  // POST is the dev/test entry point — no auth gate so unit tests can
  // drive the worker without standing up a secret. Cron uses GET.
  if (process.env.NODE_ENV === "production" && !authorize(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runPass());
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  __resetAffiliateQueue();
  return NextResponse.json({ ok: true });
}
