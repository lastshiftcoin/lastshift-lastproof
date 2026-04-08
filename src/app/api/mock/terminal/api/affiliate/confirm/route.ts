import { NextRequest, NextResponse } from "next/server";

/**
 * Mock Terminal affiliate confirm endpoint.
 *
 * Scenario switch via `?scenario=`:
 *   success              → 200 credited
 *   no_affiliate         → 404 no_affiliate_on_record (terminal success)
 *   already_recorded     → 200 credited=false reason=already_recorded
 *   wallet_tid_mismatch  → 409 (terminal failure, non-retryable)
 *   transient            → 503 (retryable — queue should requeue)
 *   unauthorized         → 401 (default if headers missing)
 *
 * Default scenario: success.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const keyId = req.headers.get("x-lastshift-key-id") || "";
  if (!auth.startsWith("Bearer ") || keyId !== "v1") {
    return NextResponse.json(
      { error: "unauthorized", message: "missing or invalid S2S headers" },
      { status: 401 },
    );
  }

  const scenario = new URL(req.url).searchParams.get("scenario") || "success";

  switch (scenario) {
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
        affiliate_slug: "shift-builder-01",
        reason: "already_recorded",
      });
    case "no_affiliate":
      return NextResponse.json(
        {
          ok: false,
          reason: "no_affiliate_on_record",
          message: "No affiliate attached to this operator",
        },
        { status: 404 },
      );
    case "wallet_tid_mismatch":
      return NextResponse.json(
        {
          ok: false,
          reason: "wallet_tid_mismatch",
          message: "Wallet does not own this Terminal ID",
        },
        { status: 409 },
      );
    case "transient":
      return NextResponse.json(
        { ok: false, reason: "service_unavailable", message: "try again" },
        { status: 503 },
      );
    default:
      return NextResponse.json(
        { ok: false, reason: "malformed_request", message: "unknown scenario" },
        { status: 400 },
      );
  }
}
