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
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { readSession } from "@/lib/session";
import { getQuote } from "@/lib/quotes-store";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/constants";

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
    // Auth
    const session = await readSession();
    if (!session) {
      return json({ ok: false, reason: "no_session" }, 401);
    }

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

    if (!TREASURY) {
      console.error("[build-tx] TREASURY wallet not configured");
      return json({ ok: false, reason: "unknown" }, 500);
    }

    const payerPubkey = new PublicKey(session.walletAddress);
    const treasuryPubkey = new PublicKey(TREASURY);
    const connection = new Connection(RPC_URL, "confirmed");

    // Build memo string
    const handle = body.handle ?? "unknown";
    const ticker = body.ticker ?? "$LASTSHFT";
    const path = body.path ?? "collab";
    const memo = `lp:v1:${handle}:${ticker}:${path}:${quote.id}`;

    // Build transaction
    const tx = new Transaction();

    // Get recent blockhash
    let blockhash: string;
    let lastValidBlockHeight: number;
    try {
      const bh = await connection.getLatestBlockhash("confirmed");
      blockhash = bh.blockhash;
      lastValidBlockHeight = bh.lastValidBlockHeight;
    } catch (err) {
      console.error("[build-tx] RPC getLatestBlockhash failed:", err);
      return json({ ok: false, reason: "rpc_degraded" }, 503);
    }

    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = payerPubkey;

    if (quote.token === "SOL") {
      // Native SOL transfer
      const lamports = Math.round(quote.expectedToken * LAMPORTS_PER_SOL);

      // Check balance
      try {
        const balance = await connection.getBalance(payerPubkey);
        // Need lamports + ~5000 for tx fee
        if (balance < lamports + 10000) {
          return json(
            {
              ok: false,
              reason: "insufficient_balance",
              needed: (lamports / LAMPORTS_PER_SOL).toFixed(6),
              have: (balance / LAMPORTS_PER_SOL).toFixed(6),
            },
            402,
          );
        }
      } catch (err) {
        console.error("[build-tx] balance check failed:", err);
        return json({ ok: false, reason: "rpc_degraded" }, 503);
      }

      tx.add(
        SystemProgram.transfer({
          fromPubkey: payerPubkey,
          toPubkey: treasuryPubkey,
          lamports,
        }),
      );
    } else {
      // SPL token transfer (USDT or LASTSHFT)
      const mintStr = TOKEN_MINTS[quote.token];
      if (!mintStr || mintStr === "native") {
        return json({ ok: false, reason: "unknown" }, 500);
      }
      const mintPubkey = new PublicKey(mintStr);
      const decimals = TOKEN_DECIMALS[quote.token];
      const amount = BigInt(Math.round(quote.expectedToken * 10 ** decimals));

      // Derive ATAs
      const payerAta = await getAssociatedTokenAddress(
        mintPubkey,
        payerPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const treasuryAta = await getAssociatedTokenAddress(
        mintPubkey,
        treasuryPubkey,
        true, // allowOwnerOffCurve for treasury (might be PDA)
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Check payer token balance
      try {
        const payerAccount = await connection.getTokenAccountBalance(payerAta);
        const payerBalance = BigInt(payerAccount.value.amount);
        if (payerBalance < amount) {
          const needed = Number(amount) / 10 ** decimals;
          const have = Number(payerBalance) / 10 ** decimals;
          return json(
            {
              ok: false,
              reason: "insufficient_balance",
              needed: needed.toFixed(decimals),
              have: have.toFixed(decimals),
            },
            402,
          );
        }
      } catch (err) {
        // Token account might not exist
        console.error("[build-tx] token balance check failed:", err);
        return json(
          {
            ok: false,
            reason: "insufficient_balance",
            needed: (Number(amount) / 10 ** decimals).toFixed(decimals),
            have: "0",
          },
          402,
        );
      }

      tx.add(
        createTransferInstruction(
          payerAta,
          treasuryAta,
          payerPubkey,
          amount,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Add memo instruction (SPL Memo v2)
    const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    tx.add({
      keys: [{ pubkey: payerPubkey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    });

    // Add quote reference as a read-only account key so Helius webhook
    // can correlate the on-chain tx back to this quote. Solana Pay spec
    // requires this as a non-signer, non-writable account on the
    // transfer instruction — we add it as a separate "no-op" reference.
    // The reference is already a base58 pubkey from generateReferenceBase58().
    try {
      const refPubkey = new PublicKey(quote.reference);
      // Add as a no-op instruction that just references the key
      tx.add({
        keys: [{ pubkey: refPubkey, isSigner: false, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from("ref", "utf-8"),
      });
    } catch {
      // Non-fatal if reference isn't a valid pubkey
      console.warn("[build-tx] could not add reference key:", quote.reference);
    }

    // Serialize (without signature — payer hasn't signed yet)
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const tx_base64 = serialized.toString("base64");

    return json({
      ok: true,
      tx_base64,
      expected_signer: payerPubkey.toBase58(),
      memo,
    });
  } catch (err) {
    console.error("[build-tx] unexpected error:", err);
    return json({ ok: false, reason: "unknown" }, 500);
  }
}
