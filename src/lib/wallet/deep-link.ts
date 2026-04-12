/**
 * Wallet environment detection + mobile deep-link schemes.
 *
 * Per official docs:
 *   - Phantom: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 *   - Solflare: https://docs.solflare.com/solflare/technical/deeplinks
 *   - Backpack: https://docs.backpack.app/deeplinks/other-methods/browse
 *   - Solana MWA: https://docs.solanamobile.com/developers/mobile-wallet-adapter
 *
 * Three environments:
 *   "desktop"         — standard browser with extension support
 *   "in-app-browser"  — inside a wallet's built-in browser (provider injected)
 *   "mobile-browser"  — regular mobile browser (Chrome/Safari) — needs deep links or MWA
 *
 * All 3 wallets (Phantom, Solflare, Backpack) have published browse deep
 * links that open the current URL in their in-app browser.
 *
 * On Android: MWA handles connection natively via local WebSocket — no
 * deep links needed. The wallet adapter handles this automatically.
 *
 * On iOS: browse deep links are used to bounce into the wallet's in-app
 * browser where the standard adapter flow works.
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
    backpack?: { connect?: unknown };
    solana?: { connect?: unknown };
  };

  const hasPhantom = typeof w.phantom?.solana?.connect === "function";
  const hasSolflare = typeof w.solflare?.connect === "function";
  const hasBackpack = typeof w.backpack?.connect === "function";
  const hasGeneric = typeof w.solana?.connect === "function";

  if (hasPhantom || hasSolflare || hasBackpack || hasGeneric) {
    return "in-app-browser";
  }

  return "mobile-browser";
}

/**
 * Detect if we're on Android (MWA-capable).
 * On Android Chrome, the wallet adapter handles mobile connections via MWA
 * (local WebSocket to wallet app) — no deep links, no page reload.
 */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detect if we're on iOS (needs browse deep links).
 * iOS does not support MWA. The only path is the browse deep link
 * which opens the URL in the wallet's in-app browser.
 */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ─── Per-wallet metadata + deep links ─────────────────────────────────────

export interface WalletMeta {
  id: KnownWallet;
  label: string;
  /** Returns a deep-link URL that opens the current page in the wallet's in-app browser. */
  buildDeepLink: (currentUrl: string) => string;
  /** All 3 wallets have browse deep links. */
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
  backpack: {
    id: "backpack",
    label: "Backpack",
    buildDeepLink: (url) =>
      `https://backpack.app/ul/v1/browse/${enc(url)}?ref=${enc(new URL(url).origin)}`,
    hasBrowseLink: true,
    mobileSub: "OPENS IN BACKPACK APP",
  },
};

export const WALLET_ORDER: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "backpack",
];
