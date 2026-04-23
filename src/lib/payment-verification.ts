/**
 * Payment verification logic — paste-verify pipeline for mint, subscription, handle_change.
 *
 * Mirrors proof-verification.ts pattern but adapted for payments:
 *   1. TX exists on-chain + no meta.err
 *   2. Recipient is treasury
 *   3. Amount within tolerance of expected price (by kind, not path)
 *   4. TX within session window (blockTime >= session_opened_at)
 *   5. Signature dedup (silent success if already in payments table)
 *   --- on success ---
 *   6. Insert payment row + dispatch side effects
 */

import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabaseService } from "@/lib/db/client";
import { priceFor, toleranceForUsd, type PaymentToken, type PaymentKindPriced } from "@/lib/pricing";
import { getTokenUsdRate } from "@/lib/token-rates";
import { TOKEN_MINTS } from "@/lib/constants";
import { upsertByTxSignature, type PaymentDraft } from "@/lib/payments-store";
import { dispatchPaymentConfirmed } from "@/lib/payment-events";

export const RPC_URL =
  process.env.HELIUS_RPC_URL_PAYMENTS ||
  process.env.HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const TREASURY =
  process.env.LASTPROOF_AR_WALLET || process.env.TREASURY_WALLET || "";

export interface PaymentVerificationRow {
  id: string;
  signature: string;
  pubkey: string | null;
  kind: PaymentKindPriced;
  token: string;
  profile_id: string;
  ref_id: string | null;
  attempt_number: number;
  session_opened_at: string | null;
}

export type PaymentVerifyResult =
  | { ok: true; extractedSender: string; paymentId: string; isDuplicate: boolean }
  | { ok: false; check: string; detail: string };

/**
 * Run full verification pipeline for a queued payment_verification row.
 * Shared by webhook handler and cron consumer.
 */
export async function verifyAndRecordPayment(
  row: PaymentVerificationRow,
  connection?: Connection,
): Promise<PaymentVerifyResult> {
  const db = supabaseService();
  const conn = connection ?? new Connection(RPC_URL, "confirmed");

  // ─── Check 5 (early): Signature already in payments → silent success ──
  const { data: existingPayment } = await db
    .from("payments")
    .select("id, payer_wallet")
    .eq("tx_signature", row.signature)
    .limit(1)
    .single();

  if (existingPayment) {
    return {
      ok: true,
      extractedSender: existingPayment.payer_wallet ?? "",
      paymentId: existingPayment.id,
      isDuplicate: true,
    };
  }

  // ─── Check 1: Transaction exists on-chain ─────────────────────────
  let tx: Awaited<ReturnType<typeof conn.getTransaction>>;
  try {
    tx = await conn.getTransaction(row.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: row.attempt_number >= 2 ? 0 : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      check: "rpc_error",
      detail: `Failed to fetch transaction: ${(err as Error).message}`,
    };
  }

  if (!tx || !tx.meta) {
    return { ok: false, check: "tx_not_found", detail: "Transaction not found on-chain." };
  }

  if (tx.meta.err) {
    return { ok: false, check: "tx_failed_onchain", detail: "Transaction failed on-chain." };
  }

  // Extract account keys (legacy vs versioned)
  const msg = tx.transaction.message;
  const rawKeys = "accountKeys" in msg ? msg.accountKeys : msg.staticAccountKeys;
  const accountKeys = rawKeys.map((k: unknown) =>
    typeof k === "string" ? k : (k as { toBase58: () => string }).toBase58(),
  );
  const feePayer = accountKeys[0]; // sender

  // ─── Check 2: Recipient is treasury ───────────────────────────────
  if (!TREASURY) {
    return { ok: false, check: "config_error", detail: "Treasury wallet not configured." };
  }

  const token = row.token as PaymentToken;
  const treasuryInKeys = accountKeys.indexOf(TREASURY) !== -1;
  if (!treasuryInKeys) {
    const hasTransfer = checkTransferToTreasury(tx, accountKeys, token);
    if (!hasTransfer) {
      return { ok: false, check: "wrong_recipient", detail: "Payment not sent to LASTPROOF treasury." };
    }
  }

  // ─── Check 3: Amount within tolerance ─────────────────────────────
  const kind = row.kind as PaymentKindPriced;
  const expectedUsd = priceFor(kind, token);
  const usdRate = await getTokenUsdRate(token);
  const expectedTokenAmount = expectedUsd / usdRate;
  const toleranceUsd = Math.max(toleranceForUsd(expectedUsd), expectedUsd * 0.05);
  const toleranceTokenAmount = toleranceUsd / usdRate;

  const transferAmount = extractTransferAmount(tx, accountKeys, token);
  if (transferAmount === null) {
    return { ok: false, check: "amount_not_found", detail: "Could not find matching transfer." };
  }

  if (transferAmount < expectedTokenAmount - toleranceTokenAmount) {
    return { ok: false, check: "amount_too_low", detail: "Amount does not match required payment." };
  }
  if (transferAmount > expectedTokenAmount + toleranceTokenAmount) {
    return { ok: false, check: "amount_too_high", detail: "Amount does not match required payment." };
  }

  // ─── Check 4: TX within session window ────────────────────────────
  if (tx.blockTime && row.session_opened_at) {
    const sessionOpenedAtSec = Math.floor(new Date(row.session_opened_at).getTime() / 1000);
    if (tx.blockTime < sessionOpenedAtSec - 60) {
      return { ok: false, check: "tx_before_session", detail: "Transaction predates payment session." };
    }
  }

  // ─── Write extracted sender back ──────────────────────────────────
  await db
    .from("payment_verifications")
    .update({ pubkey: feePayer })
    .eq("id", row.id);

  // ─── Insert payment row + dispatch side effects ───────────────────
  const amountUsd = transferAmount * usdRate;
  const draft: PaymentDraft = {
    kind: row.kind as PaymentDraft["kind"],
    refId: row.ref_id,
    operatorId: null,
    profileId: row.profile_id,
    payerWallet: feePayer,
    token: token,
    amountUsd: +amountUsd.toFixed(2),
    amountToken: transferAmount,
    discountApplied: token === "LASTSHFT",
    quoteId: null,
    txSignature: row.signature,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  };

  const upsert = await upsertByTxSignature(draft);

  if (upsert.created && upsert.row.status === "confirmed") {
    try {
      await dispatchPaymentConfirmed(upsert.row);
    } catch (err) {
      console.error(`[payment-verification] dispatch failed for ${row.signature}:`, err);
    }
  }

  return {
    ok: true,
    extractedSender: feePayer,
    paymentId: upsert.row.id,
    isDuplicate: !upsert.created,
  };
}

/**
 * Check if any balance change in the tx credits the treasury.
 */
function checkTransferToTreasury(
  tx: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  accountKeys: string[],
  token: PaymentToken,
): boolean {
  if (!tx.meta) return false;

  if (token === "SOL") {
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

  const preTokenBalances = tx.meta.preTokenBalances ?? [];
  const postTokenBalances = tx.meta.postTokenBalances ?? [];
  const mint = TOKEN_MINTS[token];
  if (mint === "native") return false;

  for (const post of postTokenBalances) {
    if (post.mint !== mint) continue;
    if (post.owner !== TREASURY) continue;
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
    return null;
  }

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
