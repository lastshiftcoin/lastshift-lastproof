/**
 * Local-dev mock for POST /api/proof/quote/:id/refresh.
 *
 * Matches docs/PROOF-MODAL-SPEC-REPLY.md §6:
 *   - single round-trip
 *   - same quote_id, extended expires_at, new usd_rate
 *   - fake "reVerified" flag based on a query param so the FE can
 *     exercise both the silent-refresh and the re-animate-terminal UX
 *   - supports Accept: text/event-stream (re-animates) OR JSON (single-shot)
 *
 * Scenarios (via ?scenario= or body.scenario):
 *   "ok"            → 200 ok: true, reVerified: false
 *   "reverified"    → 200 ok: true, reVerified: true  (SSE variant re-streams checks)
 *   "slot_taken"    → 200 ok: false, reason: "slot_taken"
 *   "expired_hard"  → 200 ok: false, reason: "quote_expired_hard"
 *   "lock_lost"     → 409 ok: false, reason: "lock_lost"
 *
 * THROWAWAY — delete when real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scenario = "ok" | "reverified" | "slot_taken" | "expired_hard" | "lock_lost";

function readScenario(req: NextRequest, body: Record<string, unknown>): Scenario {
  const url = new URL(req.url);
  const raw = (body.scenario ?? url.searchParams.get("scenario") ?? "ok") as string;
  const allowed: Scenario[] = ["ok", "reverified", "slot_taken", "expired_hard", "lock_lost"];
  return (allowed.includes(raw as Scenario) ? raw : "ok") as Scenario;
}

function priceDrift(): { amount_ui: number; amount_raw: string; usd_rate: number } {
  // small random drift ±3% to simulate live price movement
  const base = 8.33;
  const drift = (Math.random() * 0.06 - 0.03) * base;
  const ui = Math.round((base + drift) * 100) / 100;
  return {
    amount_ui: ui,
    amount_raw: Math.round(ui * 1_000_000).toString(),
    usd_rate: 0.00012 + (Math.random() * 0.0000024 - 0.0000012),
  };
}

function okPayload(quoteId: string, reVerified: boolean, ageMs: number) {
  const drift = priceDrift();
  return {
    ok: true,
    quote: {
      token: "lastshft",
      quote_id: quoteId,
      usd: 3.0,
      ...drift,
      expires_at: new Date(Date.now() + 90_000).toISOString(),
    },
    eligibility: {
      reVerified,
      ageMs,
    },
  };
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sseReVerifyStream(quoteId: string): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      write(sse("start", { quote_id: quoteId, mode: "reverify" }));

      // Condensed re-check — reuses warm cache so each line is faster than the initial run
      const rows = [
        { id: "uniqueness", label: "UNIQUENESS", detail: "still unique", ms: 80 },
        { id: "slot", label: "DEV SLOT", detail: "still open", ms: 100 },
        { id: "balance", label: "BALANCE", detail: "sufficient", ms: 150 },
        { id: "mint_authority", label: "MINT-AUTHORITY", detail: "match (cached)", ms: 120 },
        { id: "deployer", label: "DEPLOYER", detail: "match (cached)", ms: 400 },
      ];

      for (const row of rows) {
        await sleep(row.ms);
        write(sse("check", { id: row.id, label: row.label, ok: true, detail: row.detail }));
      }

      await sleep(80);
      write(sse("done", okPayload(quoteId, true, 45_000)));
      controller.close();
    },
  });
}

function wantsSse(req: NextRequest): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/event-stream");
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: quoteId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scenario = readScenario(req, body);

  if (scenario === "lock_lost") {
    return jsonResp(
      { ok: false, reason: "lock_lost" },
      409,
    );
  }

  if (scenario === "slot_taken") {
    return jsonResp({ ok: false, reason: "slot_taken" });
  }

  if (scenario === "expired_hard") {
    return jsonResp({ ok: false, reason: "quote_expired_hard" });
  }

  // ok + reverified paths
  const reVerified = scenario === "reverified";

  if (reVerified && wantsSse(req)) {
    const stream = await sseReVerifyStream(quoteId);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  return jsonResp(okPayload(quoteId, reVerified, reVerified ? 45_000 : 12_000));
}
