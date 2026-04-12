/**
 * POST /api/proof/build-tx
 *
 * Builds a real Solana transaction for the given quote. Returns the
 * serialized transaction (base64), the expected signer pubkey, and
 * a memo string. The frontend deserializes, has the wallet sign it,
 * then POSTs the signed tx to /api/proof/broadcast.
 *
 * Response shape matches the mock at /api/mock/proof/build-tx exactly:
 *   200 { ok: true, tx_base64, expected_signer, memo }
 *   402 { ok: false, reason: "insufficient_balance" }
 *   409 { ok: false, reason: "lock_lost" | "dev_slot_taken" }
 *   410 { ok: false, reason: "quote_expired_hard" }
 *   503 { ok: false, reason: "rpc_degraded" }
 *   500 { ok: false, reason: "unknown" }
 */

import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getQuote } from "@/lib/quotes-store";
import { buildSolanaTx } from "@/lib/build-solana-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = process.env.HELIUS_RPC_URL_PAYMENTS || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY =
  process.env.LASTPROOF_AR_WALLET ||
  process.env.TREASURY_WALLET ||
  "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      quote_id?: string;
      handle?: string;
      ticker?: string;
      path?: string;
    };

    if (!body.quote_id) {
      return json({ ok: false, reason: "missing_quote_id" }, 400);
    }

    // Look up quote
    const quote = await getQuote(body.quote_id);
    if (!quote) {
      return json({ ok: false, reason: "quote_expired_hard" }, 410);
    }
    if (quote.status === "consumed") {
      return json({ ok: false, reason: "lock_lost" }, 409);
    }
    if (quote.status === "expired" || new Date(quote.expiresAt) < new Date()) {
      return json({ ok: false, reason: "quote_expired_hard" }, 410);
    }

    // Payer pubkey from the quote metadata — set during eligibility
    // when the prover connected their wallet. No session needed:
    // the proof flow is public, provers don't have LASTPROOF accounts.
    const payerWallet = (quote.metadata as { pubkey?: string } | undefined)?.pubkey;
    if (!payerWallet) {
      console.error("[build-tx] quote missing metadata.pubkey", quote.id);
      return json({ ok: false, reason: "unknown" }, 500);
    }

    if (!TREASURY) {
      console.error("[build-tx] TREASURY wallet not configured");
      return json({ ok: false, reason: "unknown" }, 500);
    }

    const payerPubkey = new PublicKey(payerWallet);
    const treasuryPubkey = new PublicKey(TREASURY);
    const connection = new Connection(RPC_URL, "confirmed");

    // Build proof-specific memo
    const handle = body.handle ?? "unknown";
    const ticker = body.ticker ?? "$LASTSHFT";
    const path = body.path ?? "collab";
    const memo = `lp:v1:${handle}:${ticker}:${path}:${quote.id}`;

    const result = await buildSolanaTx({
      payerPubkey,
      treasuryPubkey,
      token: quote.token,
      expectedToken: quote.expectedToken,
      memo,
      reference: quote.reference,
      connection,
    });

    if (!result.ok) {
      return json(
        { ok: false, reason: result.reason, needed: result.needed, have: result.have },
        result.status,
      );
    }

    return json({
      ok: true,
      tx_base64: result.tx_base64,
      expected_signer: result.expected_signer,
      memo,
    });
  } catch (err) {
    console.error("[build-tx] unexpected error:", err);
    return json({ ok: false, reason: "unknown" }, 500);
  }
}
