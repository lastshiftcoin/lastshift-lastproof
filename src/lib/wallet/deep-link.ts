/**
 * Mobile deep-link schemes for the four allowlisted wallets.
 *
 * Generalized from `mobile-phantom-wallet-fix.md` at repo root. On
 * mobile Safari/Chrome, wallet extensions don't exist — the user has
 * to open the page *inside* the wallet's built-in browser. We detect
 * mobile + "no injected provider" and render deep-link buttons that
 * bounce the user into the wallet app's in-app browser pointed back
 * at the current URL.
 *
 * Phantom + Solflare have public `ul/browse/{url}` schemes. Jupiter
 * and Binance don't publish equivalents — for those we fall back to
 * their app-store link (user installs, then retries on desktop or
 * their in-app browser). Revisit once those teams publish real
 * universal links.
 */

import type { KnownWallet } from "@/lib/wallet-policy";

export interface WalletMeta {
  id: KnownWallet;
  label: string;
  /** Returns a deep-link URL that should open the current page inside the wallet's in-app browser. */
  buildDeepLink: (currentUrl: string) => string;
}

const enc = (s: string) => encodeURIComponent(s);

export const WALLET_META: Record<KnownWallet, WalletMeta> = {
  phantom: {
    id: "phantom",
    label: "Phantom",
    // Pattern from mobile-phantom-wallet-fix.md
    buildDeepLink: (url) =>
      `https://phantom.app/ul/browse/${enc(url)}?ref=${enc(new URL(url).origin)}`,
  },
  solflare: {
    id: "solflare",
    label: "Solflare",
    // Solflare's public universal link — mirror of phantom pattern.
    buildDeepLink: (url) => `https://solflare.com/ul/v1/browse/${enc(url)}?ref=${enc(new URL(url).origin)}`,
  },
  jupiter: {
    id: "jupiter",
    label: "Jupiter Mobile",
    // No published browse scheme — send to app page. Revisit.
    buildDeepLink: () => "https://jup.ag/mobile",
  },
  binance: {
    id: "binance",
    label: "Binance Wallet",
    // Binance Web3 Wallet lives inside the main Binance app. No
    // universal browse link — send to product page. Revisit.
    buildDeepLink: () => "https://www.binance.com/en/web3wallet",
  },
};

export const WALLET_ORDER: ReadonlyArray<KnownWallet> = [
  "phantom",
  "solflare",
  "jupiter",
  "binance",
];

/**
 * True when we should render deep-link buttons instead of adapter
 * buttons: mobile UA + no injected Solana provider on `window`.
 */
export function shouldUseDeepLinks(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobile) return false;
  // If any wallet has injected, adapter path will work inside the
  // in-app browser — no need to bounce.
  const w = window as unknown as { phantom?: { solana?: unknown }; solflare?: unknown };
  const hasInjected = Boolean(w.phantom?.solana || w.solflare);
  return !hasInjected;
}
