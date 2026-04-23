/**
 * POST /api/payment/broadcast
 *
 * Generic payment broadcast. Accepts a wallet-signed transaction
 * (base64), submits it to the Solana RPC, returns the signature.
 * Identical logic to /api/proof/broadcast — shared for all payment kinds.
 *
 *   200 { ok: true, signature, status: "broadcasted" }
 *   400 { ok: false, reason: "signature_invalid" }
 *   503 { ok: false, reason: "rpc_degraded" }
 *   500 { ok: false, reason: "unknown" }
 */

import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = process.env.HELIUS_RPC_URL_PAYMENTS || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";

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
      signed_tx_base64?: string;
    };

    if (!body.signed_tx_base64) {
      return json({ ok: false, reason: "signature_invalid" }, 400);
    }

    let rawTx: Buffer;
    try {
      rawTx = Buffer.from(body.signed_tx_base64, "base64");
      if (rawTx.length === 0) throw new Error("empty");
    } catch {
      return json({ ok: false, reason: "signature_invalid" }, 400);
    }

    const connection = new Connection(RPC_URL, "confirmed");

    let signature: string;
    try {
      signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      console.error("[payment/broadcast] sendRawTransaction failed:", msg);

      if (
        msg.includes("Signature verification failed") ||
        msg.includes("invalid signature") ||
        msg.includes("Transaction signature verification")
      ) {
        return json({ ok: false, reason: "signature_invalid" }, 400);
      }
      if (
        msg.includes("blockhash not found") ||
        msg.includes("Blockhash not found")
      ) {
        return json({ ok: false, reason: "blockhash_expired" }, 400);
      }
      if (msg.includes("insufficient funds") || msg.includes("Insufficient")) {
        return json({ ok: false, reason: "insufficient_balance" }, 402);
      }

      return json({ ok: false, reason: "rpc_degraded" }, 503);
    }

    return json({
      ok: true,
      signature,
      status: "broadcasted",
    });
  } catch (err) {
    console.error("[payment/broadcast] unexpected error:", err);
    return json({ ok: false, reason: "unknown" }, 500);
  }
}
