/**
 * DEV preflight qualification gate.
 *
 * Before a user is allowed to PAY for a DEV verification, we verify the
 * paying wallet is a legitimate "dev" for THE SPECIFIC TOKEN being
 * proofed. Per the locked flow, a qualifying wallet must be ONE of:
 *
 *   1. Mint / update authority on the token
 *   2. An on-chain "creator" listed in the token's metadata
 *   3. The originator of the initial LP funding (covered by #1/#2 for
 *      bonding-curve launches; flagged as TODO for AMMs)
 *   4. One of the earliest N signers on the mint address (signals
 *      founder wallet for bonding-curve launches where the deployer
 *      mints supply to themselves in the first few txs)
 *
 * This module is the SINGLE gate. Both the UI preflight button and the
 * webhook handler call it — the webhook double-checks because a
 * front-end-only gate is trivially bypassable.
 *
 * STUB vs REAL:
 *   - In tests / when `HELIUS_RPC_URL` is not set, we fall back to a
 *     deterministic wallet-suffix stub so existing test fixtures keep
 *     working without hitting the network.
 *   - When `HELIUS_RPC_URL` IS set AND a `mint` is supplied, we run
 *     the real Helius DAS (`getAsset`) + RPC (`getSignaturesForAddress`)
 *     checks. If either network call fails we fail CLOSED (reason
 *     `rpc_unavailable`) — we never approve a badge when we can't verify.
 */

export type PreflightReason =
  | "ok"
  | "not_checked"
  | "mint_not_found"
  | "not_deployer"
  | "not_founder"
  | "not_lp_originator"
  | "not_early_minter"
  | "insufficient_lastshft"
  | "wallet_too_new"
  | "insufficient_activity"
  | "rpc_unavailable";

export interface PreflightResult {
  qualified: boolean;
  reason: PreflightReason;
  details?: Record<string, unknown>;
}

export const DEV_MIN_LASTSHFT = 10_000;
export const DEV_MIN_WALLET_AGE_DAYS = 30;
export const DEV_MIN_TX_COUNT = 50;
/** How many early signers on the mint we consider "founder window". */
export const DEV_EARLY_MINTER_WINDOW = 10;

export interface PreflightInput {
  wallet: string;
  /** Token mint address the payer is claiming dev status for. Optional for
   *  back-compat; without it we fall through to the wallet-history stub. */
  mint?: string | null;
}

/**
 * Back-compat overload: old callers passed a bare wallet string. New
 * callers should pass `{ wallet, mint }`.
 */
export async function runDevPreflight(
  input: string | PreflightInput,
): Promise<PreflightResult> {
  const { wallet, mint } =
    typeof input === "string" ? { wallet: input, mint: null } : input;

  if (!wallet) return { qualified: false, reason: "not_checked" };

  const rpcUrl = process.env.HELIUS_RPC_URL;
  const useReal =
    !!rpcUrl && !!mint && process.env.NODE_ENV !== "test";

  if (!useReal) return runStub(wallet);
  return runReal({ wallet, mint: mint!, rpcUrl: rpcUrl! });
}

// ─── Stub path (tests + pre-Helius dev) ─────────────────────────────────────

function runStub(wallet: string): PreflightResult {
  if (wallet.endsWith("_DEV")) {
    return {
      qualified: true,
      reason: "ok",
      details: { stub: true, lastshft: 50_000, ageDays: 365, txCount: 1200 },
    };
  }
  if (wallet.endsWith("_NEW")) {
    return { qualified: false, reason: "wallet_too_new", details: { stub: true, ageDays: 3 } };
  }
  if (wallet.endsWith("_BROKE")) {
    return {
      qualified: false,
      reason: "insufficient_lastshft",
      details: { stub: true, lastshft: 0 },
    };
  }
  return {
    qualified: false,
    reason: "insufficient_activity",
    details: { stub: true, txCount: 4 },
  };
}

// ─── Real Helius path ───────────────────────────────────────────────────────

interface HeliusAsset {
  id: string;
  authorities?: Array<{ address: string; scopes: string[] }>;
  creators?: Array<{ address: string; share: number; verified: boolean }>;
  ownership?: { owner: string };
}

interface RpcEnvelope<T> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown,
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc_http_${res.status}`);
  const json = (await res.json()) as RpcEnvelope<T>;
  if (json.error) throw new Error(`rpc_err_${json.error.code}:${json.error.message}`);
  if (json.result === undefined) throw new Error("rpc_no_result");
  return json.result;
}

async function runReal(opts: {
  wallet: string;
  mint: string;
  rpcUrl: string;
}): Promise<PreflightResult> {
  const { wallet, mint, rpcUrl } = opts;

  let asset: HeliusAsset | null = null;
  try {
    asset = await rpcCall<HeliusAsset>(rpcUrl, "getAsset", { id: mint });
  } catch (err) {
    return {
      qualified: false,
      reason: "rpc_unavailable",
      details: { step: "getAsset", error: (err as Error).message },
    };
  }
  if (!asset) return { qualified: false, reason: "mint_not_found" };

  // 1. Authority check — most direct "this wallet deployed / controls the mint".
  const authAddrs = (asset.authorities ?? []).map((a) => a.address);
  if (authAddrs.includes(wallet)) {
    return { qualified: true, reason: "ok", details: { matched: "authority" } };
  }

  // 2. Creator check — verified creators from on-chain metadata.
  const creatorAddrs = (asset.creators ?? [])
    .filter((c) => c.verified)
    .map((c) => c.address);
  if (creatorAddrs.includes(wallet)) {
    return { qualified: true, reason: "ok", details: { matched: "creator" } };
  }

  // 3. Early-minter check — pull the first signers on the mint address and
  //    see if this wallet is in that window. This captures bonding-curve
  //    launches where the deployer is the fee-payer on the first N txs.
  let sigs: Array<{ signature: string; err: unknown | null }> = [];
  try {
    sigs = await rpcCall<typeof sigs>(rpcUrl, "getSignaturesForAddress", [
      mint,
      { limit: 1000 },
    ]);
  } catch (err) {
    return {
      qualified: false,
      reason: "rpc_unavailable",
      details: { step: "getSignaturesForAddress", error: (err as Error).message },
    };
  }
  // Helius returns newest-first; take the OLDEST N successful txs.
  const oldestWindow = sigs
    .filter((s) => !s.err)
    .slice(-DEV_EARLY_MINTER_WINDOW);

  for (const s of oldestWindow) {
    let tx: { transaction?: { message?: { accountKeys?: string[] } } } | null = null;
    try {
      tx = await rpcCall(rpcUrl, "getTransaction", [
        s.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
    } catch {
      continue; // best-effort window scan
    }
    const keys = tx?.transaction?.message?.accountKeys ?? [];
    // First key is the fee payer per Solana tx layout.
    if (keys[0] === wallet) {
      return {
        qualified: true,
        reason: "ok",
        details: { matched: "early_minter", signature: s.signature },
      };
    }
  }

  // 4. No match on any rule — not a dev for this token.
  return {
    qualified: false,
    reason: "not_deployer",
    details: {
      mint,
      authoritiesChecked: authAddrs.length,
      creatorsChecked: creatorAddrs.length,
      earlyWindowChecked: oldestWindow.length,
    },
  };
}
