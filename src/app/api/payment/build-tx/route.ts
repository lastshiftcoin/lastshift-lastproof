/**
 * POST /api/payment/build-tx
 *
 * Generic payment transaction builder. Accepts only { quote_id } —
 * everything else (kind, token, amount, reference) comes from the
 * quote row. Used by subscription, handle_change, and mint flows.
 *
 * Proof flow continues to use /api/proof/build-tx (proof-specific
 * memo format). Both routes share the same buildSolanaTx() plumbing.
 *
 *   200 { ok: true, tx_base64, expected_signer, memo }
 *   402 { ok: false, reason: "insufficient_balance" }
 *   410 { ok: false, reason: "quote_expired_hard" }
 *   409 { ok: false, reason: "lock_lost" }
 *   503 { ok: false, reason: "rpc_degraded" }
 *   500 { ok: false, reason: "unknown" }
 */

import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { readSession } from "@/lib/session";
import { getQuote } from "@/lib/quotes-store";
import { buildSolanaTx } from "@/lib/build-solana-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
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
    const session = await readSession();
    if (!session) {
      return json({ ok: false, reason: "no_session" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      quote_id?: string;
    };

    if (!body.quote_id) {
      return json({ ok: false, reason: "missing_quote_id" }, 400);
    }

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

    if (!TREASURY) {
      console.error("[payment/build-tx] TREASURY wallet not configured");
      return json({ ok: false, reason: "unknown" }, 500);
    }

    const payerPubkey = new PublicKey(session.walletAddress);
    const treasuryPubkey = new PublicKey(TREASURY);
    const connection = new Connection(RPC_URL, "confirmed");

    // Kind-aware memo: lp:v1:<kind>:<quote_id>
    const memo = `lp:v1:${quote.kind}:${quote.id}`;

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
    console.error("[payment/build-tx] unexpected error:", err);
    return json({ ok: false, reason: "unknown" }, 500);
  }
}
