/**
 * scripts/verify-lastshft-mint.ts
 *
 * One-shot sanity check that the LASTSHFT mint hard-coded in
 * `src/lib/constants.ts` actually exists on Solana mainnet and has the
 * decimals we assume. Run this:
 *
 *   - Once at onboarding to confirm the mint is real
 *   - In CI against mainnet to catch drift (LASTSHFT mint change,
 *     decimals never change for a real SPL token but let's be sure)
 *   - Before any release that touches pricing math
 *
 * Usage:
 *   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=... \
 *     npx tsx scripts/verify-lastshft-mint.ts
 *
 * This calls `getAccountInfo` on the mint address and decodes the SPL
 * Mint account layout manually — no `@solana/web3.js` dependency — so
 * the script stays small and CI-safe.
 *
 * SPL Mint account layout (82 bytes):
 *   off 0   (4)  mintAuthorityOption
 *   off 4   (32) mintAuthority
 *   off 36  (8)  supply (u64 LE)
 *   off 44  (1)  decimals           ← what we verify
 *   off 45  (1)  isInitialized
 *   off 46  (4)  freezeAuthorityOption
 *   off 50  (32) freezeAuthority
 */

import { LASTSHFT_MINT, TOKEN_DECIMALS } from "../src/lib/constants";

const RPC_URL = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL;

async function main() {
  if (!RPC_URL) {
    console.error("ERROR: set HELIUS_RPC_URL (or SOLANA_RPC_URL) in env.");
    process.exit(1);
  }

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [LASTSHFT_MINT, { encoding: "base64" }],
  };

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`RPC error: ${res.status} ${res.statusText}`);
    process.exit(2);
  }

  const json = (await res.json()) as {
    result?: { value?: { data?: [string, string]; owner?: string } };
    error?: { message?: string };
  };
  if (json.error) {
    console.error("RPC returned error:", json.error.message);
    process.exit(2);
  }

  const value = json.result?.value;
  if (!value) {
    console.error(`Mint ${LASTSHFT_MINT} not found on-chain.`);
    process.exit(3);
  }

  const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  if (value.owner !== SPL_TOKEN_PROGRAM && value.owner !== TOKEN_2022_PROGRAM) {
    console.error(
      `Mint ${LASTSHFT_MINT} is owned by ${value.owner}, ` +
        `not the SPL Token program. Not a real token.`,
    );
    process.exit(4);
  }

  const [b64] = value.data ?? [];
  if (!b64) {
    console.error("Missing account data.");
    process.exit(5);
  }
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 45) {
    console.error(`Account data too short: ${bytes.length} bytes.`);
    process.exit(6);
  }

  const decimalsOnChain = bytes[44];
  const decimalsExpected = TOKEN_DECIMALS.LASTSHFT;

  console.log(`Mint:        ${LASTSHFT_MINT}`);
  console.log(`Owner:       ${value.owner}`);
  console.log(`Decimals:    on-chain=${decimalsOnChain} expected=${decimalsExpected}`);

  if (decimalsOnChain !== decimalsExpected) {
    console.error(
      `\n❌ DECIMAL MISMATCH — update constants.ts LASTSHFT to ${decimalsOnChain}`,
    );
    process.exit(7);
  }

  console.log("\n✅ LASTSHFT mint verified.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(99);
});
