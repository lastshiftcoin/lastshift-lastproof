import { NextRequest, NextResponse } from "next/server";

/**
 * Local mock of Terminal's POST /api/license/validate.
 *
 * AUDITED 2026-04-08 against real Terminal dev server after smoke test
 * (10/10 green). Behavior now emulates the real route with the same
 * seeded test row from `schema-v3-lastproof.sql`:
 *
 *   walletAddress:      TEST1111111111111111111111111111111111111111
 *   terminalId:         SHIFT-TEST-0001-0001-0001
 *   firstFiveThousand:  true
 *   freeSubUntil:       2026-06-07T00:00:00+00:00
 *   subscriptionStatus: free_ea
 *   verified:           { x: false, telegram: false }
 *   displayName:        test-operator
 *   createdAt:          2026-04-08T22:46:08.945661+00:00 (fixed to keep determinism)
 *   toolSlug entitled:  lastproof
 *
 * DEFAULT MODE — no `?scenario=` param: behaves like real Terminal.
 *   • Known wallet + matching TID + entitled toolSlug → 200 success
 *   • Known wallet + wrong TID                        → 403 wallet_tid_mismatch
 *   • Unknown wallet                                  → 404 wallet_not_registered
 *   • Known wallet + toolSlug !== 'lastproof'         → 403 tool_not_entitled
 *
 * OVERRIDE MODE — `?scenario=<name>`: forces a specific branch regardless
 * of wallet/TID inputs. Use this from test harnesses that need to exercise
 * branches which can't be triggered organically:
 *   success | success_not_ea | success_active
 *   wallet_tid_mismatch | tid_regenerated | tool_not_entitled
 *   tid_not_found | wallet_not_registered
 *   rate_limited | malformed_request | unauthorized
 *
 * Response shapes are byte-for-byte identical to real Terminal's route
 * (src/app/api/license/validate/route.ts in terminal-build), including
 * the Postgres timestamptz `+00:00` suffix on both `freeSubUntil` and
 * `createdAt` — do NOT change to "Z" or client string-compares break.
 */

const EXPECTED_BEARER =
  process.env.INTER_TOOL_API_SECRET || "dev-mock-secret-not-for-production";

interface SeedShape {
  walletAddress: string;
  terminalId: string;
  firstFiveThousand: boolean;
  freeSubUntil: string | null;
  subscriptionStatus: "free_ea" | "active" | "past_due" | "canceled" | "none";
  verified: { x: boolean; telegram: boolean };
  displayName: string | null;
  createdAt: string;
}

// Seed row — must match schema-v3-lastproof.sql exactly.
const SEED: SeedShape = {
  walletAddress: "TEST1111111111111111111111111111111111111111",
  terminalId: "SHIFT-TEST-0001-0001-0001",
  firstFiveThousand: true,
  freeSubUntil: "2026-06-07T00:00:00+00:00",
  subscriptionStatus: "free_ea",
  verified: { x: false, telegram: false },
  displayName: "test-operator",
  createdAt: "2026-04-08T22:46:08.945661+00:00",
};

type Scenario =
  | "success"
  | "success_not_ea"
  | "success_active"
  | "wallet_tid_mismatch"
  | "tid_regenerated"
  | "tool_not_entitled"
  | "tid_not_found"
  | "wallet_not_registered"
  | "rate_limited"
  | "malformed_request"
  | "unauthorized";

function authHeaderOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const keyId = req.headers.get("x-lastshift-key-id") || "";
  if (!auth.startsWith("Bearer ")) return false;
  if (auth.slice(7) !== EXPECTED_BEARER) return false;
  if (keyId !== "v1") return false;
  return true;
}

function successPayload(
  walletAddress: string,
  terminalId: string,
  overrides: Partial<SeedShape> = {},
) {
  return {
    valid: true,
    walletAddress,
    terminalId,
    firstFiveThousand: overrides.firstFiveThousand ?? SEED.firstFiveThousand,
    freeSubUntil: overrides.freeSubUntil ?? SEED.freeSubUntil,
    subscriptionStatus: overrides.subscriptionStatus ?? SEED.subscriptionStatus,
    verified: overrides.verified ?? SEED.verified,
    displayName: overrides.displayName ?? SEED.displayName,
    createdAt: overrides.createdAt ?? SEED.createdAt,
  };
}

export async function POST(req: NextRequest) {
  if (!authHeaderOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scenarioParam = req.nextUrl.searchParams.get("scenario");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { valid: false, reason: "malformed_request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { walletAddress, terminalId, toolSlug } = (body || {}) as {
    walletAddress?: string;
    terminalId?: string;
    toolSlug?: string;
  };

  // Shared malformed-body guard applies in both modes (matches real Terminal).
  if (!walletAddress || !terminalId || !toolSlug) {
    return NextResponse.json(
      {
        valid: false,
        reason: "malformed_request",
        message: "walletAddress, terminalId, and toolSlug are required",
      },
      { status: 400 },
    );
  }

  // ─── Override mode — forced scenario ─────────────────────────────
  if (scenarioParam) {
    const scenario = scenarioParam as Scenario;
    switch (scenario) {
      case "success":
        return NextResponse.json(successPayload(walletAddress, terminalId));
      case "success_not_ea":
        return NextResponse.json(
          successPayload(walletAddress, terminalId, {
            firstFiveThousand: false,
            freeSubUntil: null,
            subscriptionStatus: "none",
          }),
        );
      case "success_active":
        return NextResponse.json(
          successPayload(walletAddress, terminalId, {
            firstFiveThousand: false,
            freeSubUntil: null,
            subscriptionStatus: "active",
            verified: { x: true, telegram: true },
            displayName: "cryptomark",
          }),
        );
      case "wallet_tid_mismatch":
        return NextResponse.json(
          {
            valid: false,
            reason: "wallet_tid_mismatch",
            message: "Terminal ID does not match this wallet.",
          },
          { status: 403 },
        );
      case "tid_regenerated":
        return NextResponse.json(
          {
            valid: false,
            reason: "tid_regenerated",
            message: "Terminal ID was regenerated. Re-enter current Terminal ID.",
          },
          { status: 403 },
        );
      case "tool_not_entitled":
        return NextResponse.json(
          {
            valid: false,
            reason: "tool_not_entitled",
            message: `Wallet is not entitled to ${toolSlug}.`,
          },
          { status: 403 },
        );
      case "tid_not_found":
        return NextResponse.json(
          {
            valid: false,
            reason: "tid_not_found",
            message: "Terminal ID not recognized.",
          },
          { status: 404 },
        );
      case "wallet_not_registered":
        return NextResponse.json(
          {
            valid: false,
            reason: "wallet_not_registered",
            message: "Wallet is not registered with Terminal.",
          },
          { status: 404 },
        );
      case "rate_limited":
        return NextResponse.json(
          { valid: false, reason: "rate_limited", message: "Too many requests." },
          { status: 429, headers: { "Retry-After": "30" } },
        );
      case "malformed_request":
        return NextResponse.json(
          {
            valid: false,
            reason: "malformed_request",
            message: "Simulated malformed request.",
          },
          { status: 400 },
        );
      case "unauthorized":
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      default:
        return NextResponse.json(
          {
            valid: false,
            reason: "malformed_request",
            message: `Unknown scenario: ${scenarioParam}`,
          },
          { status: 400 },
        );
    }
  }

  // ─── Default mode — emulate real Terminal lookup against seed row ──
  if (walletAddress !== SEED.walletAddress) {
    return NextResponse.json(
      {
        valid: false,
        reason: "wallet_not_registered",
        message: "Wallet is not registered with Terminal.",
      },
      { status: 404 },
    );
  }
  if (terminalId !== SEED.terminalId) {
    return NextResponse.json(
      {
        valid: false,
        reason: "wallet_tid_mismatch",
        message: "Terminal ID does not match this wallet.",
      },
      { status: 403 },
    );
  }
  if (toolSlug !== "lastproof") {
    return NextResponse.json(
      {
        valid: false,
        reason: "tool_not_entitled",
        message: `Wallet is not entitled to ${toolSlug}.`,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(successPayload(walletAddress, terminalId));
}
