/**
 * Wallet allowlist + Solana Pay capability classification.
 *
 * LASTPROOF only accepts payments from wallets we have *verified* against
 * primary documentation. Anything else is either warned or blocked at
 * connect time. This file is the single source of truth.
 *
 * Locked allowlist (user decision):
 *   Phantom, Jupiter Mobile, Solflare, Binance App (Web3 wallet)
 *
 * Capability tiers (from docs/research/WALLET-COMPAT.md):
 *   - TIER_1_VERIFIED: Phantom, Solflare — documented Solana Pay support,
 *     reference keys preserved, SPL + memo handled per spec.
 *   - TIER_2_UNVERIFIED: Jupiter Mobile, Binance App — no public docs
 *     confirm Solana Pay URI handling. We still accept payments from
 *     these (they can sign raw txs we build), but we show a warning and
 *     fall back to a manual Transaction Request flow instead of the URI
 *     deep-link for the best UX.
 *   - BLOCKED: everything else.
 */

export type WalletTier = "verified" | "unverified" | "blocked";

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

const TIER_1_VERIFIED = new Set<KnownWallet>(["phantom", "solflare"]);
const TIER_2_UNVERIFIED = new Set<KnownWallet>(["jupiter", "binance"]);

export function classifyWallet(adapterName: string | null | undefined): WalletClassification {
  if (!adapterName) {
    return {
      canonical: null,
      tier: "blocked",
      supportsTransferRequestUri: false,
      warnUser: true,
      reason: "no_wallet_connected",
    };
  }
  const canonical = ADAPTER_NAME_MAP[adapterName.trim().toLowerCase()] ?? null;
  if (!canonical) {
    return {
      canonical: null,
      tier: "blocked",
      supportsTransferRequestUri: false,
      warnUser: true,
      reason: "wallet_not_on_allowlist",
    };
  }
  if (TIER_1_VERIFIED.has(canonical)) {
    return {
      canonical,
      tier: "verified",
      supportsTransferRequestUri: true,
      warnUser: false,
    };
  }
  if (TIER_2_UNVERIFIED.has(canonical)) {
    return {
      canonical,
      tier: "unverified",
      supportsTransferRequestUri: false, // use Transaction Request fallback
      warnUser: true,
      reason: "solana_pay_uri_unverified",
    };
  }
  return {
    canonical: null,
    tier: "blocked",
    supportsTransferRequestUri: false,
    warnUser: true,
    reason: "wallet_not_on_allowlist",
  };
}

export function isAllowlisted(adapterName: string | null | undefined): boolean {
  const c = classifyWallet(adapterName);
  return c.tier === "verified" || c.tier === "unverified";
}

export const ALLOWLIST: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "jupiter",
  "binance",
];
