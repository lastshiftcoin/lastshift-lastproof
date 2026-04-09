/**
 * Local-dev mock for POST /api/proof/abandon.
 *
 * Matches docs/PROOF-MODAL-SPEC-REPLY.md §10 step 7:
 *   body: { quote_id }
 *   → 200 { released: true }                                  (lock dropped)
 *   → 200 { released: false, reason: "already_consumed" }     (idempotent no-op)
 *   → 404 { released: false, reason: "quote_not_found" }
 *
 * Scenarios (via ?scenario= or body.scenario):
 *   "ok"               → 200 released: true  (default)
 *   "already_consumed" → 200 released: false
 *   "not_found"        → 404
 *
 * THROWAWAY — delete when real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scenario = "ok" | "already_consumed" | "not_found";
const ALLOWED: Scenario[] = ["ok", "already_consumed", "not_found"];

function readScenario(req: NextRequest, body: Record<string, unknown>): Scenario {
  const url = new URL(req.url);
  const raw = String(body.scenario ?? url.searchParams.get("scenario") ?? "ok");
  return (ALLOWED.includes(raw as Scenario) ? raw : "ok") as Scenario;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scenario = readScenario(req, body);

  switch (scenario) {
    case "already_consumed":
      return json({ released: false, reason: "already_consumed" });
    case "not_found":
      return json({ released: false, reason: "quote_not_found" }, 404);
    case "ok":
    default:
      return json({ released: true });
  }
}
