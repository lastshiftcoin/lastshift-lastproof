/**
 * Shared proof verification logic — used by both Helius webhook (primary)
 * and cron consumer (fallback).
 *
 * 5 on-chain checks + 2 post-extraction checks:
 *   1. TX exists on-chain + no meta.err
 *   2. Recipient is treasury (SOL balance delta or SPL token balance delta)
 *   3. Amount within tolerance of expected price
 *   4. TX within session window (blockTime >= session_opened_at)
 *   5. Signature not already used (dedup → silent success)
 *   --- after checks pass ---
 *   6. Self-proof check (extracted sender vs owner terminal_wallet)
 *   7. Dev-path eligibility (token-dev-verify against extracted sender)
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabaseService } from "@/lib/db/client";
import { insertProof } from "@/lib/proofs-store";
import { recalcProfileTier } from "@/lib/tier-recalc";
import { priceFor, toleranceForUsd, type PaymentToken, type PaymentKindPriced } from "@/lib/pricing";
import { getTokenUsdRate } from "@/lib/token-rates";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/constants";
import { verifyDevWallet } from "@/lib/token-dev-verify";

export const RPC_URL =
  process.env.HELIUS_RPC_URL_PAYMENTS ||
  process.env.HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const TREASURY =
  process.env.LASTPROOF_AR_WALLET || process.env.TREASURY_WALLET || "";

export interface VerificationRow {
  id: string;
  signature: string;
  pubkey: string | null;
  path: string;
  token: string;
  work_item_id: string;
  profile_id: string;
  attempt_number: number;
  comment: string | null;
  session_opened_at: string | null;
}

export type VerifyResult =
  | { ok: true; extractedSender: string; proofId: string; isDuplicate: boolean }
  | { ok: false; check: string; detail: string };

/**
 * Run full verification pipeline for a queued proof_verification row.
 * Shared by webhook handler and cron consumer.
 */
export async function verifyAndRecordProof(
  row: VerificationRow,
  connection?: Connection,
): Promise<VerifyResult> {
  const db = supabaseService();
  const conn = connection ?? new Connection(RPC_URL, "confirmed");

  // ─── Check 5 (early): Signature already used → silent success ─────
  const { data: existingProof } = await db
    .from("proofs")
    .select("id, payer_wallet")
    .eq("tx_signature", row.signature)
    .limit(1)
    .single();

  if (existingProof) {
    return {
      ok: true,
      extractedSender: existingProof.payer_wallet ?? "",
      proofId: existingProof.id,
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
  const accountKeys = rawKeys.map((k: PublicKey | string) =>
    typeof k === "string" ? k : k.toBase58(),
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
  const kind: PaymentKindPriced = row.path === "dev" ? "dev_verification" : "proof";
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
    // TX must be AFTER session opened. 60s future tolerance for clock skew.
    if (tx.blockTime < sessionOpenedAtSec - 60) {
      return { ok: false, check: "tx_before_session", detail: "Transaction predates verification session." };
    }
  }

  // ─── Post-check: Write extracted sender back ──────────────────────
  await db
    .from("proof_verifications")
    .update({ pubkey: feePayer })
    .eq("id", row.id);

  // ─── Post-check 6: Self-proof prevention ──────────────────────────
  const { data: workItem } = await db
    .from("work_items")
    .select("profile_id")
    .eq("id", row.work_item_id)
    .single();

  if (workItem) {
    const { data: profile } = await db
      .from("profiles")
      .select("operator_id")
      .eq("id", workItem.profile_id)
      .single();

    if (profile) {
      const { data: operator } = await db
        .from("operators")
        .select("terminal_wallet")
        .eq("id", profile.operator_id)
        .single();

      if (operator && operator.terminal_wallet === feePayer) {
        return { ok: false, check: "self_proof", detail: "Profile owner cannot verify their own work." };
      }
    }
  }

  // ─── Post-check 7: Dev-path eligibility ───────────────────────────
  //
  // Mint resolution priority (must match dev-check route):
  //   1. work_items.target_mint — operator-attested CA (set at dev-check time)
  //   2. TOKEN_MINTS[ticker]    — legacy hardcoded tickers ($LASTSHFT, $USDT)
  //   3. else → reject with `dev_mint_missing` so the operator knows to
  //      go back through dev-check (which prompts for a CA)
  if (row.path === "dev") {
    const { data: wi } = await db
      .from("work_items")
      .select("ticker, target_mint")
      .eq("id", row.work_item_id)
      .single();

    const rawTicker = wi?.ticker;
    if (!rawTicker) {
      return { ok: false, check: "dev_not_qualified", detail: "Work item has no associated token." };
    }

    // Strip $ prefix — work items store "$LASTSHFT" but TOKEN_MINTS keys are "LASTSHFT"
    const ticker = rawTicker.replace(/^\$/, "");

    let mintAddress: string | null = null;
    if (wi?.target_mint) {
      mintAddress = wi.target_mint;
    } else {
      const legacy = TOKEN_MINTS[ticker as keyof typeof TOKEN_MINTS];
      if (legacy && legacy !== "native") {
        mintAddress = legacy;
      }
    }

    if (!mintAddress) {
      // No CA attested AND no legacy hardcoded mint. Operator skipped
      // (or pre-dates) the dev-check CA flow. Return a distinct check
      // code with a helpful detail; the modal renders the detail
      // verbatim via DENIAL_MESSAGES fallthrough.
      return {
        ok: false,
        check: "dev_mint_missing",
        detail: `Add the contract address for ${ticker} on this work item before submitting a dev proof.`,
      };
    }

    const devResult = await verifyDevWallet(mintAddress, feePayer);
    const anyPass =
      devResult.mintAuthority.ok === true ||
      devResult.deployer.ok === true ||
      devResult.founder.ok === true;

    if (!anyPass) {
      return { ok: false, check: "dev_not_qualified", detail: "Wallet not qualified for dev verification." };
    }
  }

  // ─── Insert proof row ─────────────────────────────────────────────
  const proofKind: "proof" | "dev_verification" = row.path === "dev" ? "dev_verification" : "proof";
  const proof = insertProof({
    profileId: row.profile_id,
    workItemId: row.work_item_id,
    kind: proofKind,
    txSignature: row.signature,
    payerWallet: feePayer,
    note: row.comment ? row.comment.slice(0, 500) : null,
  });

  // Set is_dev on work item if dev path
  if (row.path === "dev") {
    await db
      .from("work_items")
      .update({ is_dev: true })
      .eq("id", row.work_item_id);
  }

  // Recompute tier
  await recalcProfileTier(row.profile_id);

  return {
    ok: true,
    extractedSender: feePayer,
    proofId: proof.id,
    isDuplicate: false,
  };
}

/**
 * Check if any balance change in the tx credits the treasury or its ATAs.
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
