/**
 * Local-dev mock for GET /api/proof/tx-status?signature=...
 *
 * Drives the FE confirmation ladder on step 7:
 *   BROADCASTING → CONFIRMING → CONFIRMED
 *                            ↘ FAILED (with reason)
 *
 * Status is derived server-side from a `?started=` timestamp the FE
 * passes on the first poll, so the mock is stateless: each call
 * computes elapsed time and returns the right rung of the ladder.
 *
 * Scenarios (via ?scenario=):
 *   "ok"                → broadcasted → confirming → confirmed (default)
 *   "blockhash_expired" → broadcasted → failed(blockhash_expired)
 *   "tx_reverted"       → broadcasted → confirming → failed(tx_reverted)
 *   "rpc_degraded"      → 503 any time (transient, FE should retry)
 *
 * Timing (wall-clock from ?started=):
 *   0–700ms    → "broadcasted"
 *   700–2500ms → "confirming"
 *   2500ms+    → "confirmed"  (or failed variant per scenario)
 *
 * THROWAWAY — delete when real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scenario = "ok" | "blockhash_expired" | "tx_reverted" | "rpc_degraded";
const ALLOWED: Scenario[] = ["ok", "blockhash_expired", "tx_reverted", "rpc_degraded"];

type Status = "broadcasted" | "confirming" | "confirmed" | "failed";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const signature = url.searchParams.get("signature") ?? "";
  const scenario = (ALLOWED.includes(
    url.searchParams.get("scenario") as Scenario,
  )
    ? (url.searchParams.get("scenario") as Scenario)
    : "ok") satisfies Scenario;
  const started = Number(url.searchParams.get("started") ?? Date.now());
  const elapsed = Date.now() - started;

  if (scenario === "rpc_degraded") {
    return json({ ok: false, reason: "rpc_degraded" }, 503);
  }

  let status: Status;
  let reason: string | undefined;

  if (elapsed < 700) {
    status = "broadcasted";
  } else if (scenario === "blockhash_expired") {
    status = "failed";
    reason = "blockhash_expired";
  } else if (elapsed < 2500) {
    status = "confirming";
  } else if (scenario === "tx_reverted") {
    status = "failed";
    reason = "tx_reverted";
  } else {
    status = "confirmed";
  }

  return json({
    ok: status !== "failed",
    signature,
    status,
    ...(reason ? { reason } : {}),
    elapsed_ms: elapsed,
    solscan_url: status === "confirmed" ? `https://solscan.io/tx/${signature}` : null,
  });
}
