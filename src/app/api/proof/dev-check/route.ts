/**
 * POST /api/proof/dev-check
 *
 * Lightweight, pre-payment dev wallet eligibility check.
 * No session, no quote, no state — pure read-only.
 *
 * Input:  { wallet: string, work_item_id: string }
 * Output: { eligible: boolean, checks: { mintAuthority, deployer, founder } }
 *
 * Runs the same verifyDevWallet() used by post-payment verification,
 * so the result is authoritative.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { verifyDevWallet } from "@/lib/token-dev-verify";
import { TOKEN_MINTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { wallet?: string; work_item_id?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const wallet = body?.wallet?.trim();
  const workItemId = body?.work_item_id;

  if (!wallet || !workItemId) {
    return NextResponse.json(
      { error: "wallet and work_item_id are required" },
      { status: 400 },
    );
  }

  // Basic Solana address validation (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json(
      { error: "invalid_wallet", detail: "Not a valid Solana address." },
      { status: 400 },
    );
  }

  // Look up work item → ticker
  const db = supabaseService();
  const { data: wi } = await db
    .from("work_items")
    .select("ticker")
    .eq("id", workItemId)
    .maybeSingle();

  const rawTicker = wi?.ticker;
  if (!rawTicker) {
    return NextResponse.json(
      { eligible: false, reason: "no_ticker", detail: "Work item has no associated token." },
      { status: 200 },
    );
  }

  // Strip $ prefix — work items store "$LASTSHFT" but TOKEN_MINTS keys are "LASTSHFT"
  const ticker = rawTicker.replace(/^\$/, "");
  const mintAddress = TOKEN_MINTS[ticker as keyof typeof TOKEN_MINTS];

  if (!mintAddress || mintAddress === "native") {
    return NextResponse.json(
      { eligible: false, reason: "no_mint", detail: `No mint address found for ${ticker}.` },
      { status: 200 },
    );
  }

  // Run the same 3 checks used by post-payment verification
  const result = await verifyDevWallet(mintAddress, wallet);

  const eligible =
    result.mintAuthority.ok === true ||
    result.deployer.ok === true ||
    result.founder.ok === true;

  return NextResponse.json({
    eligible,
    checks: {
      mintAuthority: { ok: result.mintAuthority.ok, detail: result.mintAuthority.detail },
      deployer: { ok: result.deployer.ok, detail: result.deployer.detail },
      founder: { ok: result.founder.ok, detail: result.founder.detail },
    },
  });
}
