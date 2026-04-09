/**
 * Wallet allowlist + Solana Pay capability classification.
 *
 * LASTPROOF accepts payments from four wallets, presented as equal-tier
 * in the UI per the proof-modal wireframe. This file is the single
 * source of truth for allowlist + Solana Pay URI capability.
 *
 * Locked allowlist (user decision):
 *   Phantom, Jupiter Mobile, Solflare, Binance App (Web3 wallet)
 *
 * Historical note: an earlier version split these into TIER_1_VERIFIED
 * (Phantom, Solflare) vs TIER_2_UNVERIFIED (Jupiter, Binance) and emitted
 * `warnUser: true` for the latter. The wireframe direction is now
 * "all four equal" — no warning badges in the picker. The `warnUser`
 * flag is retained for telemetry/dev-console logging only and must NOT
 * drive user-facing copy in the proof modal picker.
 *
 * `supportsTransferRequestUri` still differentiates capability:
 * Phantom + Solflare use the Solana Pay URI deep-link; Jupiter + Binance
 * fall back to a Transaction Request flow. This is a backend routing
 * decision, invisible to the picker UI.
 */

export type WalletTier = "allowed" | "blocked";

export interface WalletClassification {
  canonical: KnownWallet | null;
  tier: WalletTier;
  supportsTransferRequestUri: boolean;
  warnUser: boolean;
  reason?: string;
}

export type KnownWallet = "phantom" | "solflare" | "jupiter" | "binance";

/**
 * Adapter-name strings as emitted by @solana/wallet-adapter-wallets.
 * Lowercased at lookup time for loose matching.
 */
const ADAPTER_NAME_MAP: Record<string, KnownWallet> = {
  phantom: "phantom",
  solflare: "solflare",
  "jupiter mobile": "jupiter",
  jupiter: "jupiter",
  "binance wallet": "binance",
  "binance web3 wallet": "binance",
  binance: "binance",
};

/** Wallets that support Solana Pay Transfer Request URI deep-links. */
const URI_CAPABLE = new Set<KnownWallet>(["phantom", "solflare"]);

export function classifyWallet(adapterName: string | null | undefined): WalletClassification {
  if (!adapterName) {
    return {
      canonical: null,
      tier: "blocked",
      supportsTransferRequestUri: false,
      warnUser: false,
      reason: "no_wallet_connected",
    };
  }
  const canonical = ADAPTER_NAME_MAP[adapterName.trim().toLowerCase()] ?? null;
  if (!canonical) {
    return {
      canonical: null,
      tier: "blocked",
      supportsTransferRequestUri: false,
      warnUser: false,
      reason: "wallet_not_on_allowlist",
    };
  }
  return {
    canonical,
    tier: "allowed",
    supportsTransferRequestUri: URI_CAPABLE.has(canonical),
    // Telemetry-only flag. Must NOT drive picker UI copy — per the
    // wireframe, all four wallets are presented as equal.
    warnUser: !URI_CAPABLE.has(canonical),
  };
}

export function isAllowlisted(adapterName: string | null | undefined): boolean {
  return classifyWallet(adapterName).tier === "allowed";
}

export const ALLOWLIST: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "jupiter",
  "binance",
];
