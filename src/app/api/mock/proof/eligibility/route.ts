/**
 * Local-dev SSE mock for POST /api/proof/eligibility.
 *
 * Matches the event schedule locked in docs/PROOF-MODAL-SPEC-REPLY.md §5:
 *   event: start
 *   event: check   (one per row, fast→slow ordering)
 *   event: done    (with quote on eligible, failed_checks on ineligible)
 *
 * Fixture-driven via request body so the FE can exercise all three
 * variants (collab-eligible, dev-eligible, dev-ineligible) without a
 * real backend:
 *
 *   { path: "collab", scenario: "eligible" }
 *   { path: "dev",    scenario: "eligible" }
 *   { path: "dev",    scenario: "ineligible" }
 *
 * Also supports ?scenario= query param for GET-style probing from the
 * wireframe HTML. Stream is deliberately slow (realistic cold-cache
 * timings from the spec) so the FE animation can be eyeballed.
 *
 * This is a THROWAWAY — delete when the real endpoint ships.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Path = "collab" | "dev";
type Scenario = "eligible" | "ineligible";

interface CheckEvent {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
  /** ms to wait BEFORE emitting this row (simulates RPC latency) */
  delayMs: number;
}

const MOCK_PUBKEY = "F7k2QJm9Np8xWv3sH5cB4aRtY6eZu1oKdL2fVgXpN9xMp";
const MOCK_MINT = "5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB"; // LASTSHFT

function buildChecks(path: Path, scenario: Scenario): CheckEvent[] {
  const base: CheckEvent[] = [
    {
      id: "uniqueness",
      label: "UNIQUENESS",
      ok: true,
      detail: "wallet has not proofed this project",
      delayMs: 100,
    },
    {
      id: "slot",
      label: path === "dev" ? "DEV SLOT" : "COLLAB SLOT",
      ok: true,
      detail:
        path === "dev"
          ? "no dev proof yet on this project"
          : "collaborator slot open",
      delayMs: 150,
    },
    {
      id: "balance",
      label: "BALANCE",
      ok: true,
      detail: `1,250.00 $LASTSHFT · need ${path === "dev" ? "8.33" : "1.67"} $LASTSHFT`,
      delayMs: 300,
    },
  ];

  if (path === "collab") return base;

  // dev path adds mint-authority + deployer(+first-5 fused) + founder neutral
  const devChecks: CheckEvent[] = [
    {
      id: "mint_authority",
      label: "MINT-AUTHORITY",
      ok: scenario === "eligible",
      detail:
        scenario === "eligible"
          ? "F7k2…9xMp is current mint authority"
          : "not the current mint authority",
      delayMs: 400,
    },
    {
      id: "deployer",
      label: "DEPLOYER",
      ok: scenario === "eligible",
      detail:
        scenario === "eligible"
          ? "F7k2…9xMp signed mint tx · slot 3 of first-5 holders"
          : "did not sign mint tx · not in first-5 holders",
      delayMs: 2500,
    },
    {
      id: "founder",
      label: "FOUNDER",
      ok: null, // neutral — v1.1
      detail: "not checked in v1",
      delayMs: 50,
    },
  ];

  return [...base, ...devChecks];
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function buildStream(path: Path, scenario: Scenario): Promise<ReadableStream<Uint8Array>> {
  const checks = buildChecks(path, scenario);
  const encoder = new TextEncoder();
  const quoteId = `qt_mock_${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 90_000).toISOString();

  return new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      write(
        sse("start", {
          quote_id: quoteId,
          path,
          mint: MOCK_MINT,
          pubkey: MOCK_PUBKEY,
        }),
      );

      for (const check of checks) {
        await sleep(check.delayMs);
        write(
          sse("check", {
            id: check.id,
            label: check.label,
            ok: check.ok,
            detail: check.detail,
          }),
        );
      }

      await sleep(100);

      // Eligible if every real (non-null) check is ok=true
      const eligible = checks.every((c) => c.ok !== false);
      if (eligible) {
        write(
          sse("done", {
            eligible: true,
            quote: {
              token: "lastshft",
              amount_ui: path === "dev" ? 8.33 : 1.67,
              amount_raw: path === "dev" ? "8330000" : "1670000",
              usd: path === "dev" ? 3.0 : 0.6,
              usd_rate: 0.00012,
              quote_id: quoteId,
              expires_at: expiresAt,
            },
          }),
        );
      } else {
        const failed = checks.filter((c) => c.ok === false).map((c) => c.id);
        write(
          sse("done", {
            eligible: false,
            reason: "dev_checks_failed",
            failed_checks: failed,
          }),
        );
      }

      controller.close();
    },
  });
}

function parseInputs(req: NextRequest, body: Record<string, unknown>): {
  path: Path;
  scenario: Scenario;
} {
  const url = new URL(req.url);
  const path = (body.path ?? url.searchParams.get("path") ?? "dev") as Path;
  const scenario = (body.scenario ??
    url.searchParams.get("scenario") ??
    "eligible") as Scenario;
  return {
    path: path === "collab" ? "collab" : "dev",
    scenario: scenario === "ineligible" ? "ineligible" : "eligible",
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { path, scenario } = parseInputs(req, body);
  const stream = await buildStream(path, scenario);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// GET is a convenience for manual curl/wireframe probing — same params via query string.
export async function GET(req: NextRequest) {
  const { path, scenario } = parseInputs(req, {});
  const stream = await buildStream(path, scenario);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
