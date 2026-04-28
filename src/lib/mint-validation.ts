/**
 * Mint address validation + chain detection.
 *
 * Used by /api/proof/dev-check and post-payment proof-verification when
 * an operator pastes a contract address (CA) for their token. We:
 *
 *   1. Detect the chain by address format. Solana addresses are
 *      base58-encoded 32–44 chars; EVM addresses are 0x + 40 hex chars.
 *   2. For Solana, do a one-shot RPC `getAccountInfo` to confirm the
 *      address actually belongs to a mint account on-chain — catches
 *      typos and "user pasted their wallet by mistake" cases cleanly.
 *
 * Multi-chain note (2026-04-28): only Solana is verified end-to-end
 * today. EVM addresses are detected and rejected upstream with a
 * "multi-chain support coming soon" message; we don't try to verify
 * deployer status on EVM chains in this version. The chain detector
 * is here so the rejection can be specific ("we see this is an EVM
 * address") rather than generic ("invalid address").
 */

export type Chain = "solana" | "evm" | "unknown";

const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/** Detect which chain an address belongs to by format alone. */
export function detectChain(rawAddress: string): Chain {
  const addr = rawAddress.trim();
  if (EVM_RE.test(addr)) return "evm";
  if (SOLANA_BASE58_RE.test(addr)) return "solana";
  return "unknown";
}

export interface SolanaMintCheckResult {
  valid: boolean;
  /**
   * Failure reason — one of:
   *   - "rpc_error"      — network / RPC unreachable
   *   - "not_an_account" — address is well-formed but no account exists
   *   - "not_a_mint"     — account exists but isn't a mint (e.g. wallet,
   *                        token account, program account)
   *   - "format"         — caller already filtered by detectChain, but
   *                        defensive in case caller skipped the check
   */
  reason?: "rpc_error" | "not_an_account" | "not_a_mint" | "format";
  detail?: string;
}

/**
 * One-shot Solana RPC `getAccountInfo` to confirm `mint` is a real
 * mint account. Distinguishes mint accounts from wallets and from
 * SPL token accounts (which also live at a Solana address but aren't
 * mints).
 *
 * Returns valid=true only for accounts where the parsed data type is
 * "mint". Catches the most common operator-error cases without
 * needing to try the full dev-verify pipeline (which is expensive).
 */
export async function checkSolanaMint(
  rpcUrl: string,
  mint: string,
): Promise<SolanaMintCheckResult> {
  if (!SOLANA_BASE58_RE.test(mint.trim())) {
    return { valid: false, reason: "format", detail: "Not a valid Solana address." };
  }

  let res: Response;
  try {
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint.trim(), { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    return {
      valid: false,
      reason: "rpc_error",
      detail: err instanceof Error ? err.message : "RPC unreachable",
    };
  }

  if (!res.ok) {
    return { valid: false, reason: "rpc_error", detail: `RPC HTTP ${res.status}` };
  }

  let json: {
    result?: {
      value?: {
        data?: { parsed?: { type?: string; info?: unknown } };
      };
    };
  };
  try {
    json = await res.json();
  } catch (err) {
    return {
      valid: false,
      reason: "rpc_error",
      detail: err instanceof Error ? err.message : "Non-JSON RPC response",
    };
  }

  const value = json.result?.value;
  if (!value) {
    return {
      valid: false,
      reason: "not_an_account",
      detail: "No account exists at this address.",
    };
  }

  const parsedType = value.data?.parsed?.type;
  if (parsedType !== "mint") {
    return {
      valid: false,
      reason: "not_a_mint",
      detail: `Address is a ${parsedType ?? "non-mint"} account, not a token mint.`,
    };
  }

  return { valid: true };
}
