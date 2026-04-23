/**
 * Per-wallet connection configs for the proof modal.
 *
 * Each wallet has its own connection strategy per platform, based on
 * official developer documentation:
 *   Phantom: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 *   Solflare: https://docs.solflare.com/solflare/technical/deeplinks
 *   Backpack: https://docs.backpack.app/deeplinks/other-methods/browse
 *
 * See docs/WALLET-REPORT-*.md for complete integration reports.
 */

import type { KnownWallet } from "@/lib/wallet-policy";
import { WALLET_META } from "@/lib/wallet/deep-link";

export interface WalletFlowConfig {
  id: KnownWallet;
  label: string;
  /** Adapter name to select() on desktop/in-app browser. */
  adapterName: string;
  /** Browse deep link builder for iOS. */
  buildBrowseLink: (currentUrl: string) => string;
}

export const WALLET_CONFIGS: Record<KnownWallet, WalletFlowConfig> = {
  phantom: {
    id: "phantom",
    label: "Phantom",
    adapterName: "Phantom",
    buildBrowseLink: WALLET_META.phantom.buildDeepLink,
  },
  solflare: {
    id: "solflare",
    label: "Solflare",
    adapterName: "Solflare",
    buildBrowseLink: WALLET_META.solflare.buildDeepLink,
  },
  backpack: {
    id: "backpack",
    label: "Backpack",
    adapterName: "Backpack",
    buildBrowseLink: WALLET_META.backpack.buildDeepLink,
  },
};

export const WALLET_FLOW_ORDER: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "backpack",
];
