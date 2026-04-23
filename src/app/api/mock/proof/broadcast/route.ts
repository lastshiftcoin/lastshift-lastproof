/**
 * Local-dev mock for POST /api/proof/broadcast.
 *
 * Matches docs/PROOF-MODAL-SPEC-REPLY.md §10 step 7:
 *   body: { quote_id, signed_tx_base64 }
 *   → 200 { ok: true, signature, status: "broadcasted" }
 *   → 400 signature_invalid
 *   → 503 rpc_degraded
 *   → 500 unknown
 *
 * After a 200, the FE polls /api/mock/proof/tx-status?signature=... for
 * the confirmation ladder (broadcasted → confirming → confirmed or
 * blockhash_expired | tx_reverted).
 *
 * Scenarios (via ?scenario= or body.scenario):
 *   "ok"                → 200 happy path (default)
 *   "signature_invalid" → 400
 *   "rpc_degraded"      → 503
 *   "unknown"           → 500
 *
 * THROWAWAY — delete when real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scenario = "ok" | "signature_invalid" | "rpc_degraded" | "unknown";
const ALLOWED: Scenario[] = ["ok", "signature_invalid", "rpc_degraded", "unknown"];

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

function fakeSignature(seed: string): string {
  // Base58-ish 88-char placeholder. Deterministic per quote so the FE
  // polling path is stable across retries of the same scenario.
  const h = seed
    .split("")
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0)
    .toString(36);
  return `5${h}mockbroadcastsignaturepayloadplaceholderforthelastproofmodal${h}Qm`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const quoteId = String(body.quote_id ?? "qt_mock_unknown");
  const scenario = readScenario(req, body);

  switch (scenario) {
    case "signature_invalid":
      return json({ ok: false, reason: "signature_invalid" }, 400);
    case "rpc_degraded":
      return json({ ok: false, reason: "rpc_degraded" }, 503);
    case "unknown":
      return json({ ok: false, reason: "unknown" }, 500);
    case "ok":
    default:
      return json({
        ok: true,
        signature: fakeSignature(quoteId),
        status: "broadcasted",
      });
  }
}
