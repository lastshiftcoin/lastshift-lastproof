/**
 * POST /api/proof/dev-check
 *
 * Lightweight, pre-payment dev wallet eligibility check.
 * No session, no quote, no state — pure read-only on the API surface,
 * with a side-effect write of `work_items.target_mint` when the
 * operator successfully attests a CA for a non-legacy ticker.
 *
 * Input:
 *   {
 *     wallet:        string,           // operator's Solana wallet
 *     work_item_id:  string,           // which work item they're claiming
 *     target_mint?:  string            // operator-pasted contract address;
 *                                      // required when the work item's ticker
 *                                      // isn't in the legacy TOKEN_MINTS list
 *   }
 *
 * Output (one of):
 *   { eligible: true,  mint, checks: { mintAuthority, deployer, founder } }
 *   { eligible: false, mint, checks: {...} }      // wallet didn't match
 *   { eligible: false, reason: "no_ticker", detail }
 *   { eligible: false, reason: "needs_ca", ticker, detail }   // ticker not
 *                                                              // in TOKEN_MINTS,
 *                                                              // no CA pasted
 *   { eligible: false, reason: "unsupported_chain", detail }  // EVM CA pasted
 *   { eligible: false, reason: "invalid_ca", detail }         // bad format
 *   { eligible: false, reason: "not_a_mint", detail }         // CA exists but
 *                                                              // isn't a mint
 *
 * Mint resolution priority:
 *   1. body.target_mint (if provided)
 *   2. work_items.target_mint (if previously attested)
 *   3. TOKEN_MINTS[ticker] (legacy: $LASTSHFT, $USDT)
 *   4. Else → return needs_ca
 *
 * Runs the same verifyDevWallet() used by post-payment verification,
 * so the result is authoritative for any mint that resolves.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/db/client";
import { verifyDevWallet } from "@/lib/token-dev-verify";
import { TOKEN_MINTS } from "@/lib/constants";
import { detectChain, checkSolanaMint } from "@/lib/mint-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOLANA_RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.HELIUS_RPC_URL_PAYMENTS ||
  "https://api.mainnet-beta.solana.com";

const MULTI_CHAIN_MESSAGE =
  "We currently verify Solana tokens only. Multi-chain support is coming soon.";

export async function POST(req: NextRequest) {
  let body: { wallet?: string; work_item_id?: string; target_mint?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const wallet = body?.wallet?.trim();
  const workItemId = body?.work_item_id;
  const pastedMintRaw = body?.target_mint?.trim() || null;

  if (!wallet || !workItemId) {
    return NextResponse.json(
      { error: "wallet and work_item_id are required" },
      { status: 400 },
    );
  }

  // Basic Solana address validation for the wallet (base58, 32-44 chars).
  // Wallet is always Solana — this app only accepts Solana session wallets.
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json(
      { error: "invalid_wallet", detail: "Not a valid Solana address." },
      { status: 400 },
    );
  }

  const db = supabaseService();
  const { data: wi } = await db
    .from("work_items")
    .select("ticker, target_mint")
    .eq("id", workItemId)
    .maybeSingle();

  const rawTicker = wi?.ticker;
  if (!rawTicker) {
    return NextResponse.json(
      { eligible: false, reason: "no_ticker", detail: "Work item has no associated token." },
      { status: 200 },
    );
  }

  const ticker = rawTicker.replace(/^\$/, "");

  // ─── Resolve the mint to verify against ─────────────────────────────────
  //
  // Priority order documented at top of file. We pick the FIRST source
  // that yields a mint, then validate it (Solana format + getAccountInfo
  // for operator-pasted addresses) before running the dev check.

  let mintToCheck: string | null = null;
  let mintSource: "body" | "stored" | "legacy" | null = null;

  if (pastedMintRaw) {
    // Operator pasted a CA in this request. Detect chain first — EVM
    // addresses get a clear "multi-chain coming" rejection rather than
    // running through a Solana-only verifier that will obviously fail.
    const chain = detectChain(pastedMintRaw);
    if (chain === "evm") {
      return NextResponse.json({
        eligible: false,
        reason: "unsupported_chain",
        detail: MULTI_CHAIN_MESSAGE,
      });
    }
    if (chain !== "solana") {
      return NextResponse.json({
        eligible: false,
        reason: "invalid_ca",
        detail: "That doesn't look like a valid Solana contract address.",
      });
    }

    // Solana format passed — confirm it's a real mint account before
    // hitting the heavier dev-verify pipeline.
    const mintCheck = await checkSolanaMint(SOLANA_RPC_URL, pastedMintRaw);
    if (!mintCheck.valid) {
      return NextResponse.json({
        eligible: false,
        reason: mintCheck.reason === "not_a_mint" ? "not_a_mint" : "invalid_ca",
        detail: mintCheck.detail ?? "Contract address could not be verified on-chain.",
      });
    }

    mintToCheck = pastedMintRaw;
    mintSource = "body";
  } else if (wi?.target_mint) {
    // Operator previously attested a CA for this work item — reuse it.
    mintToCheck = wi.target_mint;
    mintSource = "stored";
  } else {
    // Fall back to legacy TOKEN_MINTS for the canonical hardcoded tickers.
    const legacyMint = TOKEN_MINTS[ticker as keyof typeof TOKEN_MINTS];
    if (legacyMint && legacyMint !== "native") {
      mintToCheck = legacyMint;
      mintSource = "legacy";
    }
  }

  // No mint resolved by any source → ask the operator for a CA.
  if (!mintToCheck) {
    return NextResponse.json({
      eligible: false,
      reason: "needs_ca",
      ticker,
      detail: `We couldn't auto-find ${ticker}. Paste the contract address to continue.`,
    });
  }

  // ─── Run the real on-chain dev check ────────────────────────────────────
  const result = await verifyDevWallet(mintToCheck, wallet);

  const eligible =
    result.mintAuthority.ok === true ||
    result.deployer.ok === true ||
    result.founder.ok === true;

  // Persist target_mint to work_items when:
  //   - The operator just provided/confirmed a CA (mintSource === "body"),
  //     so future calls reuse it without re-asking
  //   - We don't overwrite legacy/already-stored values (no-op)
  // We persist on BOTH eligible and not-eligible — the attestation is
  // about which mint represents this work item, not whether the wallet
  // passed. Operator might come back with a different wallet.
  if (mintSource === "body") {
    await db
      .from("work_items")
      .update({ target_mint: mintToCheck })
      .eq("id", workItemId);
  }

  return NextResponse.json({
    eligible,
    mint: mintToCheck,
    checks: {
      mintAuthority: { ok: result.mintAuthority.ok, detail: result.mintAuthority.detail },
      deployer: { ok: result.deployer.ok, detail: result.deployer.detail },
      founder: { ok: result.founder.ok, detail: result.founder.detail },
    },
  });
}
