/**
 * Affiliate confirm queue — in-memory with retry + dead-letter.
 *
 * Terminal exposes an S2S `confirmAffiliate` callback. LASTPROOF calls
 * it on first publish so the affiliate graph knows a new paid tool
 * user came in. Network hiccups mustn't drop attributions, so we
 * enqueue the call and run it through a retry loop with exponential
 * backoff. A permanent failure (after maxAttempts) lands in the
 * dead-letter list for manual replay.
 *
 * The real queue will be Supabase + a worker; this skeleton keeps the
 * SHAPE identical so the swap is transparent.
 */

import { confirmAffiliate } from "./terminal-client";

export type AffiliateJobStatus = "pending" | "in_flight" | "done" | "dead";

export interface AffiliateJob {
  id: string;
  profileId: string;
  operatorWallet: string;
  terminalId: string;
  profileUrl: string;
  attempts: number;
  maxAttempts: number;
  nextRunAt: number; // epoch ms
  status: AffiliateJobStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Retry schedule — 6 attempts total spread across ~17 hours so the full
 * lifecycle of a job fits inside a 24-hour SLA window (contract: "6
 * attempts over 24h before dead-letter"). Indexes correspond to the
 * delay AFTER that attempt number fails:
 *   attempt 1 fails → +1 min → attempt 2
 *   attempt 2 fails → +15 min → attempt 3
 *   attempt 3 fails → +1 h   → attempt 4
 *   attempt 4 fails → +4 h   → attempt 5
 *   attempt 5 fails → +12 h  → attempt 6
 *   attempt 6 fails → dead
 * Total elapsed: ~17h 16m, well under 24h.
 */
const BACKOFF_SCHEDULE_MS: readonly number[] = [
  1 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  4 * 60 * 60 * 1_000,
  12 * 60 * 60 * 1_000,
];
const MAX_ATTEMPTS = 6;

const jobs: AffiliateJob[] = [];

export function enqueueAffiliateConfirm(input: {
  profileId: string;
  operatorWallet: string;
  terminalId: string;
  profileUrl: string;
}): AffiliateJob {
  const now = new Date();
  const job: AffiliateJob = {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    operatorWallet: input.operatorWallet,
    terminalId: input.terminalId,
    profileUrl: input.profileUrl,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextRunAt: now.getTime(),
    status: "pending",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  jobs.push(job);
  return job;
}

export function listAffiliateJobs(): AffiliateJob[] {
  return jobs.slice();
}

export function __resetAffiliateQueue(): void {
  jobs.length = 0;
}

/**
 * Run one worker pass: pick every job whose nextRunAt has elapsed and
 * is still pending/in_flight, attempt the S2S call, mark done / requeue
 * with backoff / dead-letter.
 *
 * Returns a summary so callers/tests can assert.
 */
export async function runAffiliateWorker(now: Date = new Date()): Promise<{
  attempted: number;
  done: number;
  requeued: number;
  dead: number;
}> {
  const nowMs = now.getTime();
  let attempted = 0;
  let done = 0;
  let requeued = 0;
  let dead = 0;

  for (const job of jobs) {
    if (job.status !== "pending" && job.status !== "in_flight") continue;
    if (job.nextRunAt > nowMs) continue;

    attempted++;
    job.status = "in_flight";
    job.attempts++;
    job.updatedAt = new Date().toISOString();

    try {
      const result = await confirmAffiliate({
        wallet: job.operatorWallet,
        terminalId: job.terminalId,
        profileUrl: job.profileUrl,
      });
      if (result.ok) {
        job.status = "done";
        job.updatedAt = new Date().toISOString();
        done++;
        continue;
      }
      // Non-retryable terminal outcomes (e.g. no_affiliate_on_record,
      // wallet_tid_mismatch, malformed_request) — mark done.
      if (result.terminal) {
        job.status = "done";
        job.lastError = `terminal_reason:${result.reason}`;
        job.updatedAt = new Date().toISOString();
        done++;
        continue;
      }
      job.lastError = `terminal_reason:${result.reason}`;
    } catch (err) {
      job.lastError = (err as Error).message ?? "unknown_error";
    }

    // Failure path
    if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      job.updatedAt = new Date().toISOString();
      dead++;
    } else {
      job.status = "pending";
      const delayIdx = Math.min(job.attempts - 1, BACKOFF_SCHEDULE_MS.length - 1);
      job.nextRunAt = nowMs + BACKOFF_SCHEDULE_MS[delayIdx];
      job.updatedAt = new Date().toISOString();
      requeued++;
    }
  }

  return { attempted, done, requeued, dead };
}
