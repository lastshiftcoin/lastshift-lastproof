/**
 * Wallet allowlist + Solana Pay capability classification.
 *
 * LASTPROOF accepts payments from three wallets — the top 3 Solana
 * wallets by user count:
 *   Phantom, Solflare, Backpack
 *
 * Each wallet gets its own independent proof flow per platform
 * (desktop, Android MWA, iOS browse deep link). See docs/WALLET-REPORT-*.md
 * for complete integration reports.
 *
 * `supportsTransferRequestUri` differentiates capability:
 * Phantom + Solflare + Backpack all support Solana Pay URI deep-links.
 * This is a backend routing decision, invisible to the picker UI.
 */

export type WalletTier = "allowed" | "blocked";

export interface WalletClassification {
  canonical: KnownWallet | null;
  tier: WalletTier;
  supportsTransferRequestUri: boolean;
  warnUser: boolean;
  reason?: string;
}

export type KnownWallet = "phantom" | "solflare" | "backpack";

/**
 * Adapter-name strings as emitted by wallet extensions and Wallet Standard.
 * Lowercased at lookup time for loose matching.
 *
 * Phantom + Solflare: explicit adapter packages.
 * Backpack: auto-registers via Wallet Standard (no explicit adapter package).
 */
const ADAPTER_NAME_MAP: Record<string, KnownWallet> = {
  phantom: "phantom",
  solflare: "solflare",
  backpack: "backpack",
};

/** Wallets that support Solana Pay Transfer Request URI deep-links. */
const URI_CAPABLE = new Set<KnownWallet>(["phantom", "solflare", "backpack"]);

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
    warnUser: false,
  };
}

export function isAllowlisted(adapterName: string | null | undefined): boolean {
  return classifyWallet(adapterName).tier === "allowed";
}

export const ALLOWLIST: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "backpack",
];
