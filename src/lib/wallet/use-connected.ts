"use client";

/**
 * useConnected — thin wrapper over @solana/wallet-adapter-react's
 * useWallet() that runs every connection through the wallet-policy
 * classifier before exposing it to the proof modal.
 *
 * Why the wrapper: the picker only needs (a) "is a wallet connected
 * right now?" and (b) "is it on our allowlist?". Components should
 * never reach into `useWallet()` directly and make their own policy
 * decisions — the allowlist must live in ONE place (wallet-policy.ts).
 *
 * Returns `null` when disconnected, otherwise `{ adapterName, pubkey,
 * canonical, supportsTransferRequestUri }`. `canonical` is null when
 * the connected wallet falls off the allowlist (should be unreachable
 * in practice since the picker only surfaces allowlisted wallets, but
 * we still gate defensively in case a user reconnects a legacy wallet
 * via browser extension).
 */

import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { classifyWallet, type KnownWallet } from "@/lib/wallet-policy";

export interface ConnectedWallet {
  adapterName: string;
  pubkey: string;
  canonical: KnownWallet;
  supportsTransferRequestUri: boolean;
}

export function useConnected(): ConnectedWallet | null {
  const { wallet, publicKey, connected } = useWallet();

  return useMemo(() => {
    if (!connected || !wallet || !publicKey) return null;
    const adapterName = wallet.adapter.name;
    const c = classifyWallet(adapterName);
    if (c.tier !== "allowed" || !c.canonical) return null;
    return {
      adapterName,
      pubkey: publicKey.toBase58(),
      canonical: c.canonical,
      supportsTransferRequestUri: c.supportsTransferRequestUri,
    };
  }, [connected, wallet, publicKey]);
}
