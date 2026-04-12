/**
 * GET /api/proof/tx-status?signature=...&started=...
 *
 * Polls the Solana RPC for transaction confirmation status. Returns
 * the confirmation ladder: broadcasted → confirming → confirmed | failed.
 *
 * Response shape matches the mock at /api/mock/proof/tx-status:
 *   200 { ok: true, signature, status, elapsed_ms, solscan_url? }
 *   200 { ok: false, status: "failed", reason: "blockhash_expired" | "tx_reverted" }
 *   503 { ok: false, reason: "rpc_degraded" }
 */

import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = process.env.HELIUS_RPC_URL_PAYMENTS || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const signature = url.searchParams.get("signature") ?? "";
    const started = Number(url.searchParams.get("started") ?? Date.now());
    const elapsed = Date.now() - started;

    if (!signature) {
      return json({ ok: false, reason: "missing_signature" }, 400);
    }

    const connection = new Connection(RPC_URL, "confirmed");

    let statusResult;
    try {
      const results = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: elapsed > 30000, // search history after 30s
      });
      statusResult = results?.value?.[0];
    } catch (err) {
      console.error("[tx-status] RPC getSignatureStatuses failed:", err);
      return json({ ok: false, reason: "rpc_degraded" }, 503);
    }

    // No status yet — still broadcasting/pending
    if (!statusResult) {
      // If we've been waiting too long (>120s), the blockhash likely expired
      if (elapsed > 120000) {
        return json({
          ok: false,
          signature,
          status: "failed",
          reason: "blockhash_expired",
          elapsed_ms: elapsed,
          solscan_url: null,
        });
      }

      return json({
        ok: true,
        signature,
        status: elapsed < 2000 ? "broadcasted" : "confirming",
        elapsed_ms: elapsed,
        solscan_url: null,
      });
    }

    // Transaction errored on-chain
    if (statusResult.err) {
      return json({
        ok: false,
        signature,
        status: "failed",
        reason: "tx_reverted",
        error: JSON.stringify(statusResult.err),
        elapsed_ms: elapsed,
        solscan_url: `https://solscan.io/tx/${signature}`,
      });
    }

    // Check confirmation level
    const slot = statusResult.slot;
    const confirmationStatus = statusResult.confirmationStatus;

    if (confirmationStatus === "finalized" || confirmationStatus === "confirmed") {
      return json({
        ok: true,
        signature,
        status: "confirmed",
        confirmationStatus,
        slot,
        elapsed_ms: elapsed,
        solscan_url: `https://solscan.io/tx/${signature}`,
      });
    }

    // "processed" — still confirming
    return json({
      ok: true,
      signature,
      status: "confirming",
      confirmationStatus,
      slot,
      elapsed_ms: elapsed,
      solscan_url: null,
    });
  } catch (err) {
    console.error("[tx-status] unexpected error:", err);
    return json({ ok: false, reason: "unknown" }, 500);
  }
}
