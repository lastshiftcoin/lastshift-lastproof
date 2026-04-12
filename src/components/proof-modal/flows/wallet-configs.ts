/**
 * Per-wallet connection configs for the proof modal.
 *
 * Each wallet has its own connection strategy based on its official
 * developer documentation. The config is consumed by ProofModal's
 * wallet picker (Step 1) to determine behavior per environment.
 *
 * Sources:
 *   Phantom: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 *   Solflare: https://docs.solflare.com/solflare/technical/deeplinks
 *   Jupiter: https://dev.jup.ag/
 *   Binance: https://developers.binance.com/docs/binance-w3w/introduction
 */

import type { KnownWallet } from "@/lib/wallet-policy";
import { WALLET_META } from "@/lib/wallet/deep-link";

export interface WalletFlowConfig {
  id: KnownWallet;
  /** Display name in the picker. */
  label: string;
  /** Desktop subtitle. */
  desktopSub: string;
  /** Mobile subtitle. */
  mobileSub: string;
  /** Mobile action type. */
  mobileAction: "browse-deeplink" | "app-link";
  /** Build the mobile URL for this wallet. */
  buildMobileUrl: (currentUrl: string) => string;
  /** Mobile CTA label. */
  mobileCta: string;
  /** Adapter name to select() on desktop/in-app. */
  adapterName: string;
}

export const WALLET_CONFIGS: Record<KnownWallet, WalletFlowConfig> = {
  phantom: {
    id: "phantom",
    label: "Phantom",
    desktopSub: "BROWSER EXTENSION + MOBILE",
    mobileSub: WALLET_META.phantom.mobileSub,
    mobileAction: "browse-deeplink",
    buildMobileUrl: WALLET_META.phantom.buildDeepLink,
    mobileCta: "OPEN IN APP",
    adapterName: "Phantom",
  },
  solflare: {
    id: "solflare",
    label: "Solflare",
    desktopSub: "BROWSER EXTENSION + MOBILE",
    mobileSub: WALLET_META.solflare.mobileSub,
    mobileAction: "browse-deeplink",
    buildMobileUrl: WALLET_META.solflare.buildDeepLink,
    mobileCta: "OPEN IN APP",
    adapterName: "Solflare",
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter",
    desktopSub: "BROWSER EXTENSION + MOBILE",
    mobileSub: WALLET_META.jupiter.mobileSub,
    mobileAction: "app-link",
    buildMobileUrl: WALLET_META.jupiter.buildDeepLink,
    mobileCta: "GET APP",
    adapterName: "Jupiter",
  },
  binance: {
    id: "binance",
    label: "Binance Wallet",
    desktopSub: "BROWSER EXTENSION + MOBILE",
    mobileSub: WALLET_META.binance.mobileSub,
    mobileAction: "app-link",
    buildMobileUrl: WALLET_META.binance.buildDeepLink,
    mobileCta: "GET APP",
    adapterName: "Binance Wallet",
  },
};

export const WALLET_FLOW_ORDER: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "jupiter",
  "binance",
];
