import { NextRequest, NextResponse } from "next/server";

/**
 * Local mock of Terminal's POST /api/license/validate.
 * Mirrors docs/TERMINAL-CONTRACT.md §1 exactly.
 *
 * Scenario switch via query param `?scenario=...` lets the client hit every
 * success + failure branch without needing a real Terminal. Default: success.
 *
 * Scenarios:
 *   success                 → 200, firstFiveThousand=true, free_ea
 *   success_not_ea          → 200, firstFiveThousand=false, freeSubUntil=null
 *   success_active          → 200, subscriptionStatus=active, verified true/true
 *   wallet_tid_mismatch     → 403
 *   tid_regenerated         → 403
 *   tool_not_entitled       → 403
 *   tid_not_found           → 404
 *   wallet_not_registered   → 404
 *   rate_limited            → 429 + Retry-After: 30
 *   malformed_request       → 400
 *   unauthorized            → 401 (different body shape: {error})
 */

const EXPECTED_BEARER = process.env.INTER_TOOL_API_SECRET || "dev-mock-secret-not-for-production";

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

export async function POST(req: NextRequest) {
  // 401 unauthorized has a distinct body shape per contract §1.
  if (!authHeaderOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scenario = (req.nextUrl.searchParams.get("scenario") || "success") as Scenario;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { valid: false, reason: "malformed_request", message: "Body is not valid JSON." },
      { status: 400 },
    );
  }

  const { walletAddress, terminalId, toolSlug } = (body || {}) as {
    walletAddress?: string;
    terminalId?: string;
    toolSlug?: string;
  };

  if (!walletAddress || !terminalId || toolSlug !== "lastproof") {
    return NextResponse.json(
      { valid: false, reason: "malformed_request", message: "Missing or invalid fields." },
      { status: 400 },
    );
  }

  switch (scenario) {
    case "success":
      return NextResponse.json({
        valid: true,
        walletAddress,
        terminalId,
        firstFiveThousand: true,
        freeSubUntil: "2026-06-07T00:00:00Z",
        subscriptionStatus: "free_ea",
        verified: { x: false, telegram: false },
        displayName: null,
        createdAt: "2026-04-08T14:22:10Z",
      });

    case "success_not_ea":
      return NextResponse.json({
        valid: true,
        walletAddress,
        terminalId,
        firstFiveThousand: false,
        freeSubUntil: null,
        subscriptionStatus: "none",
        verified: { x: false, telegram: false },
        displayName: null,
        createdAt: "2026-04-08T14:22:10Z",
      });

    case "success_active":
      return NextResponse.json({
        valid: true,
        walletAddress,
        terminalId,
        firstFiveThousand: false,
        freeSubUntil: null,
        subscriptionStatus: "active",
        verified: { x: true, telegram: true },
        displayName: "cryptomark",
        createdAt: "2025-11-14T09:02:44Z",
      });

    case "wallet_tid_mismatch":
      return NextResponse.json(
        {
          valid: false,
          reason: "wallet_tid_mismatch",
          message: "Terminal ID does not belong to the connected wallet.",
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
          message: "This wallet is not entitled to LASTPROOF.",
        },
        { status: 403 },
      );

    case "tid_not_found":
      return NextResponse.json(
        { valid: false, reason: "tid_not_found", message: "Terminal ID not recognized." },
        { status: 404 },
      );

    case "wallet_not_registered":
      return NextResponse.json(
        {
          valid: false,
          reason: "wallet_not_registered",
          message: "Wallet has no Terminal account.",
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
        { valid: false, reason: "malformed_request", message: "Simulated malformed request." },
        { status: 400 },
      );

    case "unauthorized":
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    default:
      return NextResponse.json(
        { valid: false, reason: "malformed_request", message: `Unknown scenario: ${scenario}` },
        { status: 400 },
      );
  }
}
