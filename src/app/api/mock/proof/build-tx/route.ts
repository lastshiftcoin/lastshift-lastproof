/**
 * Local-dev mock for POST /api/proof/build-tx.
 *
 * Matches docs/PROOF-MODAL-SPEC-REPLY.md §10 step 7:
 *   body: { quote_id }
 *   → 200 { tx_base64, expected_signer, memo }
 *   → 402 insufficient_balance
 *   → 410 quote_expired_hard
 *   → 409 lock_lost | dev_slot_taken
 *   → 503 rpc_degraded
 *   → 500 unknown
 *
 * Scenarios (via ?scenario= or body.scenario):
 *   "ok"                   → 200 happy path (default)
 *   "insufficient_balance" → 402
 *   "quote_expired_hard"   → 410
 *   "lock_lost"            → 409
 *   "dev_slot_taken"       → 409
 *   "rpc_degraded"         → 503
 *   "unknown"              → 500
 *
 * tx_base64 is a deliberately-fake placeholder. Headless smoke tests
 * never actually pass it to a wallet adapter, and the broadcast mock
 * accepts any base64 string regardless of content.
 *
 * THROWAWAY — delete when real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scenario =
  | "ok"
  | "insufficient_balance"
  | "quote_expired_hard"
  | "lock_lost"
  | "dev_slot_taken"
  | "rpc_degraded"
  | "unknown";

const ALLOWED: Scenario[] = [
  "ok",
  "insufficient_balance",
  "quote_expired_hard",
  "lock_lost",
  "dev_slot_taken",
  "rpc_degraded",
  "unknown",
];

const MOCK_PUBKEY = "F7k2QJm9Np8xWv3sH5cB4aRtY6eZu1oKdL2fVgXpN9xMp";

// Deliberately fake. Real wallet adapters will reject it; that's fine —
// headless smoke tests skip the signTransaction() call anyway.
const MOCK_TX_BASE64 =
  "AQAAAAAAAAAMOCK__build_tx__placeholder__qt_01H__replace_me__AAAAAAAA==";

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
  const quoteId = String(body.quote_id ?? "qt_mock_unknown");
  const handle = String(body.handle ?? "cryptomark");
  const ticker = String(body.ticker ?? "$LASTSHFT");
  const path = String(body.path ?? "dev");
  const scenario = readScenario(req, body);

  switch (scenario) {
    case "insufficient_balance":
      return json(
        { ok: false, reason: "insufficient_balance", needed: "8.33", have: "2.10" },
        402,
      );
    case "quote_expired_hard":
      return json({ ok: false, reason: "quote_expired_hard" }, 410);
    case "lock_lost":
      return json({ ok: false, reason: "lock_lost" }, 409);
    case "dev_slot_taken":
      return json({ ok: false, reason: "dev_slot_taken" }, 409);
    case "rpc_degraded":
      return json({ ok: false, reason: "rpc_degraded" }, 503);
    case "unknown":
      return json({ ok: false, reason: "unknown" }, 500);
    case "ok":
    default:
      return json({
        ok: true,
        tx_base64: MOCK_TX_BASE64,
        expected_signer: MOCK_PUBKEY,
        memo: `lp:v1:${handle}:${ticker}:${path}:${quoteId}`,
      });
  }
}
