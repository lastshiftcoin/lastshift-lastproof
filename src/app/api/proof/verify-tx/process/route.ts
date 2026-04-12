/**
 * POST /api/proof/verify-tx/process
 *
 * Cron consumer: picks up queued proof verifications, verifies them
 * against Helius RPC, and records proofs on success.
 *
 * Runs every 5 seconds via Vercel Cron. Processes up to 10 per batch.
 * Protected by CRON_SECRET.
 *
 * 6 verification checks:
 *   1. Transaction exists on-chain
 *   2. Sender matches connected wallet pubkey
 *   3. Recipient is the AR treasury wallet
 *   4. Amount within tolerance of expected price
 *   5. Transaction within 10 minutes of submission
 *   6. Signature not already used (dedup)
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabaseService } from "@/lib/db/client";
import { insertProof } from "@/lib/proofs-store";
import { priceFor, toleranceForUsd, type PaymentToken, type PaymentKindPriced } from "@/lib/pricing";
import { getTokenUsdRate } from "@/lib/token-rates";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RPC_URL =
  process.env.HELIUS_RPC_URL_PAYMENTS ||
  process.env.HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const TREASURY =
  process.env.LASTPROOF_AR_WALLET || process.env.TREASURY_WALLET || "";

const BATCH_SIZE = 10;
const MAX_TX_AGE_SECONDS = 600; // 10 minutes

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface VerificationRow {
  id: string;
  signature: string;
  pubkey: string;
  path: string;
  token: string;
  work_item_id: string;
  profile_id: string;
  attempt_number: number;
}

type CheckResult =
  | { ok: true }
  | { ok: false; check: string; detail: string };

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = supabaseService();
  const start = Date.now();

  // Pick up queued rows
  const { data: rows, error: fetchErr } = await db
    .from("proof_verifications")
    .select("id, signature, pubkey, path, token, work_item_id, profile_id, attempt_number")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr || !rows || rows.length === 0) {
    return json({ processed: 0, ms: Date.now() - start });
  }

  // Mark as processing (claim)
  const ids = rows.map((r: VerificationRow) => r.id);
  await db
    .from("proof_verifications")
    .update({ status: "processing" })
    .in("id", ids);

  const connection = new Connection(RPC_URL, "confirmed");
  let processed = 0;
  let verified = 0;
  let failed = 0;

  for (const row of rows as VerificationRow[]) {
    const result = await verifyTransaction(connection, row, db);
    processed++;

    if (result.ok) {
      // Insert proof row
      const kind: "proof" | "dev_verification" =
        row.path === "dev" ? "dev_verification" : "proof";
      const proof = insertProof({
        profileId: row.profile_id,
        workItemId: row.work_item_id,
        kind,
        txSignature: row.signature,
        payerWallet: row.pubkey,
      });

      await db
        .from("proof_verifications")
        .update({
          status: "verified",
          proof_id: proof.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      verified++;
    } else {
      await db
        .from("proof_verifications")
        .update({
          status: "failed",
          failure_check: result.check,
          failure_detail: result.detail,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      failed++;
    }
  }

  console.log(
    `[verify-tx/process] batch done: ${processed} processed, ${verified} verified, ${failed} failed, ${Date.now() - start}ms`,
  );

  return json({ processed, verified, failed, ms: Date.now() - start });
}

async function verifyTransaction(
  connection: Connection,
  row: VerificationRow,
  db: ReturnType<typeof supabaseService>,
): Promise<CheckResult> {
  // ─── Check 1: Transaction exists on-chain ──────────────────────────
  let tx: Awaited<ReturnType<typeof connection.getTransaction>>;
  try {
    tx = await connection.getTransaction(row.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: row.attempt_number >= 2 ? 0 : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      check: "tx_fetch",
      detail: `Failed to fetch transaction: ${(err as Error).message}`,
    };
  }

  if (!tx || !tx.meta) {
    return {
      ok: false,
      check: "tx_not_found",
      detail: "Transaction not found on-chain. Make sure it has been confirmed.",
    };
  }

  if (tx.meta.err) {
    return {
      ok: false,
      check: "tx_failed",
      detail: "Transaction failed on-chain. Check your wallet for details.",
    };
  }

  // ─── Check 2: Sender matches connected wallet ─────────────────────
  // Legacy messages have .accountKeys, versioned (v0) messages use .staticAccountKeys
  const msg = tx.transaction.message;
  const rawKeys = "accountKeys" in msg ? msg.accountKeys : msg.staticAccountKeys;
  const accountKeys = rawKeys.map((k: PublicKey | string) =>
    typeof k === "string" ? k : k.toBase58(),
  );
  // The fee payer is always account index 0
  const feePayer = accountKeys[0];
  if (feePayer !== row.pubkey) {
    return {
      ok: false,
      check: "wrong_sender",
      detail: `Transaction was sent from ${feePayer.slice(0, 6)}…${feePayer.slice(-4)}, not your connected wallet. Send from your connected wallet.`,
    };
  }

  // ─── Check 3: Recipient is AR treasury wallet ─────────────────────
  if (!TREASURY) {
    return {
      ok: false,
      check: "config_error",
      detail: "Treasury wallet not configured. Contact support.",
    };
  }

  const treasuryIdx = accountKeys.indexOf(TREASURY);
  if (treasuryIdx === -1) {
    // For SPL transfers, the treasury's ATA may be in the account list
    // instead of the treasury directly. Check post-balances for treasury.
    const hasTransferToTreasury = await checkTransferToTreasury(
      tx,
      accountKeys,
      row.token as PaymentToken,
    );
    if (!hasTransferToTreasury) {
      return {
        ok: false,
        check: "wrong_recipient",
        detail: `Payment must be sent to the LASTPROOF treasury wallet. Copy the address from the proof modal.`,
      };
    }
  }

  // ─── Check 4: Amount within tolerance ─────────────────────────────
  const token = row.token as PaymentToken;
  const kind: PaymentKindPriced =
    row.path === "dev" ? "dev_verification" : "proof";
  const expectedUsd = priceFor(kind, token);
  const usdRate = await getTokenUsdRate(token);
  const expectedTokenAmount = expectedUsd / usdRate;
  const toleranceUsd = Math.max(toleranceForUsd(expectedUsd), expectedUsd * 0.05);
  const toleranceTokenAmount = toleranceUsd / usdRate;

  const transferAmount = extractTransferAmount(tx, accountKeys, token);
  if (transferAmount === null) {
    return {
      ok: false,
      check: "amount_not_found",
      detail: "Could not find a matching transfer in this transaction.",
    };
  }

  if (Math.abs(transferAmount - expectedTokenAmount) > toleranceTokenAmount) {
    const decimals = TOKEN_DECIMALS[token];
    return {
      ok: false,
      check: "wrong_amount",
      detail: `Expected ~${expectedTokenAmount.toFixed(decimals > 6 ? 4 : 2)} ${token} ($${expectedUsd.toFixed(2)}), got ${transferAmount.toFixed(decimals > 6 ? 4 : 2)} ${token}. Check the amount and try again.`,
    };
  }

  // ─── Check 5: Transaction within 10 minutes ───────────────────────
  if (tx.blockTime) {
    const txAgeSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;
    if (txAgeSeconds > MAX_TX_AGE_SECONDS) {
      const mins = Math.floor(txAgeSeconds / 60);
      return {
        ok: false,
        check: "tx_too_old",
        detail: `Transaction is ${mins} minutes old. Payments must be submitted within 10 minutes.`,
      };
    }
    if (txAgeSeconds < -60) {
      // Future transaction (clock skew tolerance: 60s)
      return {
        ok: false,
        check: "tx_future",
        detail: "Transaction timestamp is in the future. Try again in a moment.",
      };
    }
  }

  // ─── Check 6: Signature not already used ──────────────────────────
  const { data: existingProof } = await db
    .from("proofs")
    .select("id")
    .eq("tx_signature", row.signature)
    .limit(1)
    .single();

  if (existingProof) {
    return {
      ok: false,
      check: "already_used",
      detail: "This transaction signature has already been used for a proof.",
    };
  }

  return { ok: true };
}

/**
 * Check if any balance change in the tx credits the treasury or its ATAs.
 * Handles both SOL native transfers and SPL token transfers.
 */
async function checkTransferToTreasury(
  tx: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  accountKeys: string[],
  token: PaymentToken,
): Promise<boolean> {
  if (!tx.meta) return false;

  if (token === "SOL") {
    // Check SOL balance changes — treasury should have a positive delta
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i] === TREASURY) {
        const delta = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
        if (delta > 0) return true;
      }
    }
    return false;
  }

  // SPL token: check preTokenBalances / postTokenBalances for treasury's ATA
  const preTokenBalances = tx.meta.preTokenBalances ?? [];
  const postTokenBalances = tx.meta.postTokenBalances ?? [];
  const mint = TOKEN_MINTS[token];
  if (mint === "native") return false;

  for (const post of postTokenBalances) {
    if (post.mint !== mint) continue;
    if (post.owner !== TREASURY) continue;
    // Find matching pre-balance
    const pre = preTokenBalances.find(
      (p) => p.accountIndex === post.accountIndex && p.mint === mint,
    );
    const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString ?? "0") : 0;
    const postAmount = parseFloat(post.uiTokenAmount.uiAmountString ?? "0");
    if (postAmount > preAmount) return true;
  }

  return false;
}

/**
 * Extract the transfer amount (in UI units) from the transaction.
 * For SOL: looks at balance deltas on the treasury account.
 * For SPL: looks at token balance deltas on the treasury's ATA.
 */
function extractTransferAmount(
  tx: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  accountKeys: string[],
  token: PaymentToken,
): number | null {
  if (!tx.meta) return null;

  if (token === "SOL") {
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i] === TREASURY) {
        const delta = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
        return delta > 0 ? delta : null;
      }
    }
    // Treasury not in direct account list — check all positive deltas
    // to non-fee-payer accounts
    return null;
  }

  // SPL token
  const preTokenBalances = tx.meta.preTokenBalances ?? [];
  const postTokenBalances = tx.meta.postTokenBalances ?? [];
  const mint = TOKEN_MINTS[token];
  if (mint === "native") return null;

  for (const post of postTokenBalances) {
    if (post.mint !== mint) continue;
    if (post.owner !== TREASURY) continue;
    const pre = preTokenBalances.find(
      (p) => p.accountIndex === post.accountIndex && p.mint === mint,
    );
    const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString ?? "0") : 0;
    const postAmount = parseFloat(post.uiTokenAmount.uiAmountString ?? "0");
    const delta = postAmount - preAmount;
    return delta > 0 ? delta : null;
  }

  return null;
}
