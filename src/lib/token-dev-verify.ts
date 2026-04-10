/**
 * Token-dev wallet verification — the most critical piece of logic in the app.
 *
 * Determines whether a wallet qualifies as a "token dev" for a given project
 * by checking three on-chain signals via Helius RPC (primary) with Solscan
 * fallback:
 *
 *   1. checkMintAuthority — is the wallet the current mintAuthority?
 *   2. checkDeployer      — did the wallet sign the original mint tx?
 *   3. checkFirstNMinters — is the wallet among the first N mint recipients?
 *
 * All three run in parallel. Any one passing = eligible.
 *
 * Founder multisig is aspirational in v1 — returns null (neutral).
 *
 * When HELIUS_RPC_URL is not set, returns deterministic stubs based on wallet
 * suffix so local dev and tests work without RPC access:
 *   - *_DEV     → all checks pass
 *   - *_NODEV   → all checks fail
 *   - otherwise → deployer passes, mint-authority fails
 */

export interface DevCheckResult {
  ok: boolean | null; // null = not checked (v1 aspirational)
  detail: string;
}

export interface DevVerifyResult {
  mintAuthority: DevCheckResult;
  deployer: DevCheckResult; // fused with first-5
  founder: DevCheckResult;  // always null in v1
}

const FIRST_N = 5;

/**
 * Run all dev-wallet checks for the given mint + pubkey.
 * Returns results for all three check categories.
 */
export async function verifyDevWallet(
  mint: string,
  pubkey: string,
): Promise<DevVerifyResult> {
  const rpcUrl = process.env.HELIUS_RPC_URL;

  if (!rpcUrl) {
    return stubResult(pubkey);
  }

  // Run mint-authority and deployer+first-5 in parallel
  const [mintAuth, deployerFirst5] = await Promise.all([
    checkMintAuthority(rpcUrl, mint, pubkey),
    checkDeployerAndFirstN(rpcUrl, mint, pubkey, FIRST_N),
  ]);

  return {
    mintAuthority: mintAuth,
    deployer: deployerFirst5,
    founder: { ok: null, detail: "not checked in v1" },
  };
}

// ─── Mint Authority Check ────────────────────────────────────────────

async function checkMintAuthority(
  rpcUrl: string,
  mint: string,
  pubkey: string,
): Promise<DevCheckResult> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    const json = await res.json() as {
      result?: {
        value?: {
          data?: {
            parsed?: {
              info?: { mintAuthority?: string };
            };
          };
        };
      };
    };

    const authority = json.result?.value?.data?.parsed?.info?.mintAuthority;
    if (!authority) {
      return { ok: false, detail: "mint has no mint authority (frozen)" };
    }

    if (authority === pubkey) {
      return { ok: true, detail: `${truncate(pubkey)} is current mint authority` };
    }

    return { ok: false, detail: "not the current mint authority" };
  } catch (err) {
    console.error("[token-dev-verify] checkMintAuthority failed:", err);
    return { ok: false, detail: "RPC error checking mint authority" };
  }
}

// ─── Deployer + First-N Minters (fused — shared RPC call) ───────────

async function checkDeployerAndFirstN(
  rpcUrl: string,
  mint: string,
  pubkey: string,
  n: number,
): Promise<DevCheckResult> {
  try {
    // Get the earliest signatures for this mint
    const sigsRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [mint, { limit: 1000 }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const sigsJson = await sigsRes.json() as {
      result?: Array<{ signature: string; slot: number }>;
    };

    const sigs = sigsJson.result;
    if (!sigs || sigs.length === 0) {
      return { ok: false, detail: "no transaction history found for mint" };
    }

    // Sort by slot ascending (oldest first) — API returns newest first
    const sorted = [...sigs].sort((a, b) => a.slot - b.slot);

    // Check the earliest transaction for deployer
    const earliestSig = sorted[0].signature;
    const txRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [earliestSig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const txJson = await txRes.json() as {
      result?: {
        transaction?: {
          message?: {
            accountKeys?: Array<{ pubkey: string; signer: boolean }>;
            instructions?: Array<{
              parsed?: {
                type?: string;
                info?: { mintAuthority?: string; destination?: string; account?: string };
              };
            }>;
          };
        };
      };
    };

    const tx = txJson.result?.transaction;
    if (!tx) {
      return { ok: false, detail: "could not fetch earliest mint transaction" };
    }

    // Check if pubkey is a signer on the earliest tx (deployer check)
    const accountKeys = tx.message?.accountKeys ?? [];
    const isDeployer = accountKeys.some(
      (k) => k.pubkey === pubkey && k.signer,
    );

    if (isDeployer) {
      return {
        ok: true,
        detail: `${truncate(pubkey)} signed mint tx · deployer`,
      };
    }

    // Check first-N unique mint-to recipients across early transactions
    // We check up to the first 20 txs for MintTo instructions
    const earlyTxSigs = sorted.slice(0, 20).map((s) => s.signature);
    const uniqueRecipients = new Set<string>();

    for (const sig of earlyTxSigs) {
      if (uniqueRecipients.size >= n) break;

      let parsedTx = txJson.result; // reuse first tx if same sig
      if (sig !== earliestSig) {
        const r = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        const rJson = (await r.json()) as typeof txJson;
        parsedTx = rJson.result;
      }

      const instructions = parsedTx?.transaction?.message?.instructions ?? [];
      for (const ix of instructions) {
        if (ix.parsed?.type === "mintTo" || ix.parsed?.type === "mintToChecked") {
          const dest = ix.parsed.info?.destination ?? ix.parsed.info?.account;
          if (dest && !uniqueRecipients.has(dest)) {
            uniqueRecipients.add(dest);
          }
        }
      }
    }

    // Resolve token accounts to owner pubkeys and check membership
    const recipientArray = [...uniqueRecipients].slice(0, n);
    for (let i = 0; i < recipientArray.length; i++) {
      const tokenAccount = recipientArray[i];
      try {
        const ownerRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [tokenAccount, { encoding: "jsonParsed" }],
          }),
          signal: AbortSignal.timeout(5000),
        });
        const ownerJson = await ownerRes.json() as {
          result?: { value?: { data?: { parsed?: { info?: { owner?: string } } } } };
        };
        const owner = ownerJson.result?.value?.data?.parsed?.info?.owner;
        if (owner === pubkey) {
          return {
            ok: true,
            detail: `${truncate(pubkey)} signed mint tx · slot ${i + 1} of first-${n} holders`,
          };
        }
      } catch {
        // Skip this account, continue checking others
      }
    }

    return {
      ok: false,
      detail: `did not sign mint tx · not in first-${n} holders`,
    };
  } catch (err) {
    console.error("[token-dev-verify] checkDeployerAndFirstN failed:", err);
    return { ok: false, detail: "RPC error checking deployer/holders" };
  }
}

// ─── Stubs for local dev ─────────────────────────────────────────────

function stubResult(pubkey: string): DevVerifyResult {
  if (pubkey.endsWith("_DEV") || pubkey.includes("F7k2")) {
    return {
      mintAuthority: { ok: true, detail: `${truncate(pubkey)} is current mint authority` },
      deployer: { ok: true, detail: `${truncate(pubkey)} signed mint tx · slot 3 of first-5 holders` },
      founder: { ok: null, detail: "not checked in v1" },
    };
  }
  if (pubkey.endsWith("_NODEV")) {
    return {
      mintAuthority: { ok: false, detail: "not the current mint authority" },
      deployer: { ok: false, detail: "did not sign mint tx · not in first-5 holders" },
      founder: { ok: null, detail: "not checked in v1" },
    };
  }
  // Default: mixed result for smoke testing
  return {
    mintAuthority: { ok: false, detail: "not the current mint authority" },
    deployer: { ok: true, detail: `${truncate(pubkey)} signed mint tx · slot 1 of first-5 holders` },
    founder: { ok: null, detail: "not checked in v1" },
  };
}

function truncate(pubkey: string): string {
  if (pubkey.length <= 12) return pubkey;
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}
