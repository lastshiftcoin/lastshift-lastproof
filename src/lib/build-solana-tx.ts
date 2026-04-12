/**
 * Shared Solana transaction builder.
 *
 * Pure plumbing: SOL transfer, SPL transfer, ATA derivation, balance
 * check, memo, reference key, serialization. No business logic — callers
 * (proof build-tx, generic payment build-tx) provide the memo and amount.
 *
 * Extracted from /api/proof/build-tx/route.ts so both proof-specific and
 * generic payment routes share the same on-chain logic.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/constants";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface BuildSolanaTxArgs {
  payerPubkey: PublicKey;
  treasuryPubkey: PublicKey;
  /** "SOL" | "USDT" | "LASTSHFT" */
  token: string;
  /** Token-denominated amount (e.g. 0.001 SOL, 1.0 USDT). */
  expectedToken: number;
  /** On-chain memo string — callers build this per their own format. */
  memo: string;
  /** Solana Pay reference pubkey (base58). Added as a no-op instruction so Helius can correlate. */
  reference: string;
  connection: Connection;
}

export type BuildSolanaTxOk = {
  ok: true;
  tx_base64: string;
  expected_signer: string;
};

export type BuildSolanaTxErr = {
  ok: false;
  reason: "insufficient_balance" | "rpc_degraded" | "unknown";
  needed?: string;
  have?: string;
  status: number;
};

export type BuildSolanaTxResult = BuildSolanaTxOk | BuildSolanaTxErr;

export async function buildSolanaTx(args: BuildSolanaTxArgs): Promise<BuildSolanaTxResult> {
  const { payerPubkey, treasuryPubkey, token, expectedToken, memo, reference, connection } = args;

  const instructions: TransactionInstruction[] = [];

  // Get recent blockhash
  let blockhash: string;
  try {
    const bh = await connection.getLatestBlockhash("confirmed");
    blockhash = bh.blockhash;
  } catch (err) {
    console.error("[build-solana-tx] RPC getLatestBlockhash failed:", err);
    return { ok: false, reason: "rpc_degraded", status: 503 };
  }

  if (token === "SOL") {
    // Native SOL transfer
    const lamports = Math.round(expectedToken * LAMPORTS_PER_SOL);

    try {
      const balance = await connection.getBalance(payerPubkey);
      if (balance < lamports + 10000) {
        return {
          ok: false,
          reason: "insufficient_balance",
          needed: (lamports / LAMPORTS_PER_SOL).toFixed(6),
          have: (balance / LAMPORTS_PER_SOL).toFixed(6),
          status: 402,
        };
      }
    } catch (err) {
      console.error("[build-solana-tx] balance check failed:", err);
      return { ok: false, reason: "rpc_degraded", status: 503 };
    }

    instructions.push(
      SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: treasuryPubkey,
        lamports,
      }),
    );
  } else {
    // SPL token transfer (USDT or LASTSHFT)
    const mintStr = TOKEN_MINTS[token as keyof typeof TOKEN_MINTS];
    if (!mintStr || mintStr === "native") {
      return { ok: false, reason: "unknown", status: 500 };
    }
    const mintPubkey = new PublicKey(mintStr);
    const decimals = TOKEN_DECIMALS[token as keyof typeof TOKEN_DECIMALS];
    const amount = BigInt(Math.round(expectedToken * 10 ** decimals));

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
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    try {
      const payerAccount = await connection.getTokenAccountBalance(payerAta);
      const payerBalance = BigInt(payerAccount.value.amount);
      if (payerBalance < amount) {
        const needed = Number(amount) / 10 ** decimals;
        const have = Number(payerBalance) / 10 ** decimals;
        return {
          ok: false,
          reason: "insufficient_balance",
          needed: needed.toFixed(decimals),
          have: have.toFixed(decimals),
          status: 402,
        };
      }
    } catch (err) {
      console.error("[build-solana-tx] token balance check failed:", err);
      return {
        ok: false,
        reason: "insufficient_balance",
        needed: (Number(amount) / 10 ** decimals).toFixed(decimals),
        have: "0",
        status: 402,
      };
    }

    instructions.push(
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
  instructions.push(
    new TransactionInstruction({
      keys: [{ pubkey: payerPubkey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    }),
  );

  // Add quote reference as a no-op instruction so Helius webhook can
  // correlate the on-chain tx back to the quote via Solana Pay reference.
  try {
    const refPubkey = new PublicKey(reference);
    instructions.push(
      new TransactionInstruction({
        keys: [{ pubkey: refPubkey, isSigner: false, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from("ref", "utf-8"),
      }),
    );
  } catch {
    console.warn("[build-solana-tx] could not add reference key:", reference);
  }

  // Build a V0 VersionedTransaction. MWA on Android requires
  // VersionedTransaction — legacy Transaction.serialize() defaults to
  // requireAllSignatures:true which rejects unsigned transactions,
  // and the MWA adapter calls serialize() internally before sending
  // bytes to the wallet app. VersionedTransaction.serialize() has no
  // such check, so unsigned transactions transport correctly.
  const messageV0 = new TransactionMessage({
    payerKey: payerPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(messageV0);
  const serialized = Buffer.from(vtx.serialize());
  const tx_base64 = serialized.toString("base64");

  return {
    ok: true,
    tx_base64,
    expected_signer: payerPubkey.toBase58(),
  };
}
