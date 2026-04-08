import { NextRequest, NextResponse } from "next/server";

/**
 * Local mock of Terminal's POST /api/affiliate/confirm.
 *
 * AUDITED 2026-04-08 against real Terminal dev server after smoke test
 * (10/10 green). Behavior now matches the real route byte-for-byte:
 *
 *   • Success (first confirm):
 *       200 { ok: true, credited: true, affiliate_slug, recorded_at }
 *   • Idempotent duplicate:
 *       200 { ok: true, credited: false, reason: "already_recorded", affiliate_slug }
 *   • No affiliate on record (this is a SUCCESS per contract):
 *       200 { ok: true, credited: false, reason: "no_affiliate_on_record" }
 *   • wallet_tid_mismatch: 403 (NOT 409 — prior mock was wrong)
 *   • wallet_not_registered: 404
 *   • malformed_request: 400
 *   • unauthorized: 401 { error: "unauthorized" }
 *
 * Body is snake_case (contract §2): { wallet, terminal_id, profile_url }
 *
 * DEFAULT MODE — no `?scenario=` param: behaves like real Terminal with
 * no referral row attached to the seed wallet (the common path for a
 * publish flow where the operator came in organically). Returns
 * `no_affiliate_on_record` as the 200 success.
 *
 * OVERRIDE MODE — `?scenario=<name>`: forces a specific branch.
 *   success | already_recorded | no_affiliate
 *   wallet_tid_mismatch | wallet_not_registered
 *   transient | unauthorized
 */

const EXPECTED_BEARER =
  process.env.INTER_TOOL_API_SECRET || "dev-mock-secret-not-for-production";

const SEED_WALLET = "TEST1111111111111111111111111111111111111111";
const SEED_TID = "SHIFT-TEST-0001-0001-0001";

function authHeaderOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const keyId = req.headers.get("x-lastshift-key-id") || "";
  if (!auth.startsWith("Bearer ")) return false;
  if (auth.slice(7) !== EXPECTED_BEARER) return false;
  if (keyId !== "v1") return false;
  return true;
}

export async function POST(req: NextRequest) {
  if (!authHeaderOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scenarioParam = new URL(req.url).searchParams.get("scenario");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "malformed_request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { wallet, terminal_id } = (body || {}) as {
    wallet?: string;
    terminal_id?: string;
    profile_url?: string;
  };

  if (!wallet || !terminal_id) {
    return NextResponse.json(
      {
        ok: false,
        reason: "malformed_request",
        message: "wallet and terminal_id are required",
      },
      { status: 400 },
    );
  }

  // ─── Override mode ─────────────────────────────────────────────
  if (scenarioParam) {
    switch (scenarioParam) {
      case "success":
        return NextResponse.json({
          ok: true,
          credited: true,
          affiliate_slug: "shift-builder-01",
          recorded_at: new Date().toISOString(),
        });
      case "already_recorded":
        return NextResponse.json({
          ok: true,
          credited: false,
          reason: "already_recorded",
          affiliate_slug: "shift-builder-01",
        });
      case "no_affiliate":
        return NextResponse.json({
          ok: true,
          credited: false,
          reason: "no_affiliate_on_record",
        });
      case "wallet_tid_mismatch":
        return NextResponse.json(
          {
            ok: false,
            reason: "wallet_tid_mismatch",
            message: "Terminal ID does not match wallet.",
          },
          { status: 403 },
        );
      case "wallet_not_registered":
        return NextResponse.json(
          {
            ok: false,
            reason: "wallet_not_registered",
            message: "Wallet is not registered.",
          },
          { status: 404 },
        );
      case "transient":
        return NextResponse.json(
          { ok: false, reason: "service_unavailable", message: "try again" },
          { status: 503 },
        );
      case "unauthorized":
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      default:
        return NextResponse.json(
          {
            ok: false,
            reason: "malformed_request",
            message: `Unknown scenario: ${scenarioParam}`,
          },
          { status: 400 },
        );
    }
  }

  // ─── Default mode — emulate real Terminal with seed row ─────────
  if (wallet !== SEED_WALLET) {
    return NextResponse.json(
      {
        ok: false,
        reason: "wallet_not_registered",
        message: "Wallet is not registered.",
      },
      { status: 404 },
    );
  }
  if (terminal_id !== SEED_TID) {
    return NextResponse.json(
      {
        ok: false,
        reason: "wallet_tid_mismatch",
        message: "Terminal ID does not match wallet.",
      },
      { status: 403 },
    );
  }

  // Seed wallet has no referral row attached by default → success with
  // credited:false. Matches real Terminal's unreferred-wallet path.
  return NextResponse.json({
    ok: true,
    credited: false,
    reason: "no_affiliate_on_record",
  });
}
