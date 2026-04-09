"use client";

/**
 * WalletBoundary — app-wide Solana wallet provider.
 *
 * Mounted at src/app/(marketing)/layout.tsx so every public-surface flow
 * (proof modal, subscription payments, onboarding) shares one provider
 * instance. Do NOT scope this inside the proof modal tree — we'll rip it
 * out when subscription payments need the same context.
 *
 * Contract decisions (locked):
 * - ONLY Phantom + Solflare are instantiated explicitly. Jupiter and
 *   Binance register via Wallet Standard (navigator.wallets) and are
 *   auto-picked up by WalletProvider's useStandardWalletAdapters() hook.
 * - The @solana/wallet-adapter-wallets barrel is FORBIDDEN per
 *   docs/SECURITY-NOTES.md — it drags in Torus/Trezor/WalletConnect
 *   which make the `elliptic` GHSA-848j-6mx2-7j84 finding reachable.
 *   Always import adapters from per-wallet packages.
 * - autoConnect: false — the proof modal explicitly walks the user
 *   through wallet selection. No silent reconnect on page load.
 * - No wallet modal UI from @solana/wallet-adapter-react-ui. We render
 *   our own picker in ProofModal that matches the wireframe chrome.
 *
 * React 19 compat caveat: the adapter lib's declared peer range is
 * <19. Mount-time runtime compat is proven by loading this component in
 * the browser without errors. If it explodes, fall back to reading
 * navigator.wallets directly without <WalletProvider>.
 */

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import type { Adapter } from "@solana/wallet-adapter-base";

/**
 * Public mainnet RPC. Replace with Helius/Triton endpoint via env var
 * before production. The proof modal only reads balances for display;
 * the eligibility check + tx build happen server-side against our own
 * RPC, so this endpoint is non-critical for trust.
 */
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export function WalletBoundary({ children }: { children: React.ReactNode }) {
  const wallets = useMemo<Adapter[]>(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Jupiter + Binance auto-register via Wallet Standard.
      // DO NOT instantiate them explicitly — their classes don't exist
      // as explicit exports in the adapter lib.
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
