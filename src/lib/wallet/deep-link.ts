/**
 * Wallet environment detection + mobile deep-link schemes.
 *
 * Per official docs:
 *   - Phantom: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 *   - Solflare: https://docs.solflare.com/solflare/technical/deeplinks
 *   - Solana MWA: https://docs.solanamobile.com/developers/mobile-wallet-adapter
 *   - wallet-adapter: https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md
 *
 * Three environments:
 *   "desktop"         — standard browser with extension support
 *   "in-app-browser"  — inside a wallet's built-in browser (provider injected)
 *   "mobile-browser"  — regular mobile browser (Chrome/Safari) — needs deep links
 *
 * Phantom + Solflare have published browse deep links that open the
 * current URL in their in-app browser. Jupiter and Binance do not —
 * they link to the app/product page with instructions.
 */

import type { KnownWallet } from "@/lib/wallet-policy";

// ─── Environment detection ───────────────────────────────────────────────

export type WalletEnv = "desktop" | "in-app-browser" | "mobile-browser";

/**
 * Detect the wallet environment. Called once on mount (useMemo).
 *
 * On mobile, Wallet Standard registers wallets as "detected" even when
 * they can't inject into Chrome. The only reliable signal for "we're
 * inside a wallet's in-app browser" is checking for a functional
 * injected provider with a callable connect() method.
 */
export function detectWalletEnvironment(): WalletEnv {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobile) return "desktop";

  // Check for functional injected providers (not just Wallet Standard registration)
  const w = window as unknown as {
    phantom?: { solana?: { connect?: unknown } };
    solflare?: { connect?: unknown };
    solana?: { connect?: unknown };
  };

  const hasPhantom = typeof w.phantom?.solana?.connect === "function";
  const hasSolflare = typeof w.solflare?.connect === "function";
  const hasGeneric = typeof w.solana?.connect === "function";

  if (hasPhantom || hasSolflare || hasGeneric) {
    return "in-app-browser";
  }

  return "mobile-browser";
}

/**
 * @deprecated Use detectWalletEnvironment() instead.
 * Kept for backward compatibility during migration.
 */
export function shouldUseDeepLinks(): boolean {
  return detectWalletEnvironment() === "mobile-browser";
}

// ─── Per-wallet metadata + deep links ─────────────────────────────────────

export interface WalletMeta {
  id: KnownWallet;
  label: string;
  /** Returns a deep-link URL that opens the current page in the wallet's in-app browser. */
  buildDeepLink: (currentUrl: string) => string;
  /** Whether this wallet has a real browse deep link (vs app store fallback). */
  hasBrowseLink: boolean;
  /** Mobile subtitle shown in the wallet picker. */
  mobileSub: string;
}

const enc = (s: string) => encodeURIComponent(s);

export const WALLET_META: Record<KnownWallet, WalletMeta> = {
  phantom: {
    id: "phantom",
    label: "Phantom",
    buildDeepLink: (url) =>
      `https://phantom.app/ul/browse/${enc(url)}?ref=${enc(new URL(url).origin)}`,
    hasBrowseLink: true,
    mobileSub: "OPENS IN PHANTOM APP",
  },
  solflare: {
    id: "solflare",
    label: "Solflare",
    buildDeepLink: (url) =>
      `https://solflare.com/ul/v1/browse/${enc(url)}?ref=${enc(new URL(url).origin)}`,
    hasBrowseLink: true,
    mobileSub: "OPENS IN SOLFLARE APP",
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter Mobile",
    buildDeepLink: () => "https://jup.ag/mobile",
    hasBrowseLink: false,
    mobileSub: "OPEN URL IN JUPITER'S BROWSER",
  },
  binance: {
    id: "binance",
    label: "Binance Wallet",
    buildDeepLink: () => "https://www.binance.com/en/web3wallet",
    hasBrowseLink: false,
    mobileSub: "OPEN URL IN BINANCE'S BROWSER",
  },
};

export const WALLET_ORDER: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "jupiter",
  "binance",
];
