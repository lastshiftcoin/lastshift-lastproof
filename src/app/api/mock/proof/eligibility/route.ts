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
type Token = "lastshft" | "sol" | "usdt";

/**
 * Mock balances per token. Realistic enough for the FE smoke test to
 * visibly differ across step 4 → step 5 re-fires.
 */
const MOCK_BALANCES: Record<Token, { ui: string; symbol: string }> = {
  lastshft: { ui: "1,250.00", symbol: "$LASTSHFT" },
  sol: { ui: "0.428", symbol: "SOL" },
  usdt: { ui: "42.30", symbol: "USDT" },
};

/**
 * Path-aware USD price → token amount. Mirrors PROOF_PRICES_USD in
 * src/lib/proof-tokens.ts. Kept inline here so the mock has zero
 * runtime dependencies on app code.
 */
const MOCK_NEED: Record<Path, Record<Token, { ui: string; symbol: string }>> = {
  collab: {
    lastshft: { ui: "1.67", symbol: "$LASTSHFT" }, // $0.60 / 0.00036 ≈ 1.67
    sol: { ui: "0.0064", symbol: "SOL" }, // $1.00 @ ~$156/SOL
    usdt: { ui: "1.00", symbol: "USDT" },
  },
  dev: {
    lastshft: { ui: "8.33", symbol: "$LASTSHFT" }, // $3.00 / 0.00036 ≈ 8.33
    sol: { ui: "0.032", symbol: "SOL" }, // $5.00 @ ~$156/SOL
    usdt: { ui: "5.00", symbol: "USDT" },
  },
};

/** Raw amount (smallest unit as string) for the done event's quote row. */
const MOCK_QUOTE_RAW: Record<Path, Record<Token, { amount_ui: number; amount_raw: string; usd: number }>> = {
  collab: {
    lastshft: { amount_ui: 1.67, amount_raw: "1670000", usd: 0.6 },
    sol: { amount_ui: 0.0064, amount_raw: "6400000", usd: 1.0 },
    usdt: { amount_ui: 1.0, amount_raw: "1000000", usd: 1.0 },
  },
  dev: {
    lastshft: { amount_ui: 8.33, amount_raw: "8330000", usd: 3.0 },
    sol: { amount_ui: 0.032, amount_raw: "32000000", usd: 5.0 },
    usdt: { amount_ui: 5.0, amount_raw: "5000000", usd: 5.0 },
  },
};

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

function buildChecks(path: Path, scenario: Scenario, token: Token): CheckEvent[] {
  const bal = MOCK_BALANCES[token];
  const need = MOCK_NEED[path][token];
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
      detail: `${bal.ui} ${bal.symbol} · need ${need.ui} ${need.symbol}`,
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

async function buildStream(path: Path, scenario: Scenario, token: Token): Promise<ReadableStream<Uint8Array>> {
  const checks = buildChecks(path, scenario, token);
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
        const q = MOCK_QUOTE_RAW[path][token];
        write(
          sse("done", {
            eligible: true,
            quote: {
              token,
              amount_ui: q.amount_ui,
              amount_raw: q.amount_raw,
              usd: q.usd,
              usd_rate: token === "lastshft" ? 0.00012 : token === "sol" ? 156.25 : 1.0,
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
  token: Token;
} {
  const url = new URL(req.url);
  const path = (body.path ?? url.searchParams.get("path") ?? "dev") as Path;
  const scenario = (body.scenario ??
    url.searchParams.get("scenario") ??
    "eligible") as Scenario;
  const tokenRaw = String(
    body.token ?? url.searchParams.get("token") ?? "lastshft",
  ).toLowerCase();
  const token: Token =
    tokenRaw === "sol" ? "sol" : tokenRaw === "usdt" ? "usdt" : "lastshft";
  return {
    path: path === "collab" ? "collab" : "dev",
    scenario: scenario === "ineligible" ? "ineligible" : "eligible",
    token,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { path, scenario, token } = parseInputs(req, body);
  const stream = await buildStream(path, scenario, token);

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
  const { path, scenario, token } = parseInputs(req, {});
  const stream = await buildStream(path, scenario, token);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
