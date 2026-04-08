# WALLET-POLICY.md

Recommended wallet detection / allowlist policy for LASTPROOF.

## Objective

At connect time and at quote time, LASTPROOF should:

1. Allow wallets we have verified against Solana Pay.
2. Warn (or block) on wallets where reference-key preservation or SPL-memo handling is unverified.
3. Gracefully handle mobile deep-linking.

## Allowlist (tier 1 — verified)

```ts
const SOLANA_PAY_VERIFIED = new Set([
  "Phantom",   // @solana/wallet-adapter-phantom → PhantomWalletAdapter.name
  "Solflare",  // @solana/wallet-adapter-solflare → SolflareWalletAdapter.name
]);
```

These are matched against the `wallet.adapter.name` string from `@solana/wallet-adapter-react`'s `useWallet()` hook.

## Watchlist (tier 2 — unverified, warn)

```ts
const SOLANA_PAY_UNVERIFIED = new Set([
  "Jupiter Mobile",
  "Binance",       // or "BinanceWallet"
  "Binance Wallet",
]);
```

For wallets in this set, the UI should show a non-blocking warning: "Your wallet may not fully support Solana Pay. If the payment does not confirm within 2 minutes, retry with Phantom or Solflare."

## Mobile deep-link detection

On mobile, LASTPROOF should:

1. Build the canonical `solana:` URI (see SOLANA-PAY-VERIFICATION.md).
2. Render it as both a QR code AND an `<a href="solana:...">` tap target — the OS will route to the registered handler (Phantom or Solflare, most commonly).
3. As a fallback, offer explicit wallet-specific universal links:
   - Phantom: `https://phantom.app/ul/browse/<encoded-dapp-url>?ref=<encoded-ref>`
   - Solflare: `https://solflare.com/ul/v1/browse/<encoded-dapp-url>?ref=<encoded-ref>`
4. Detect in-app browsers via UA sniff for correct fallback:
   - Phantom: UA contains `Phantom`
   - Solflare: UA contains `Solflare`
   - Jupiter: UA contains `Jupiter` (best-effort)
   - Binance: UA contains `BNC/` or `BinanceApp`

## Proposed helper (new file — not written yet)

`src/lib/wallet-policy.ts`:

```ts
export type WalletTier = "verified" | "unverified" | "unknown";

export function classifyWallet(adapterName: string | undefined): WalletTier {
  if (!adapterName) return "unknown";
  if (["Phantom", "Solflare"].includes(adapterName)) return "verified";
  if (["Jupiter Mobile", "Binance", "Binance Wallet"].includes(adapterName)) return "unverified";
  return "unknown";
}

export function isSolanaPaySupported(adapterName: string | undefined): boolean {
  return classifyWallet(adapterName) === "verified";
}
```

## Connect-time gate

- If `classifyWallet() === "verified"` → proceed silently.
- If `"unverified"` → show warning modal; user must click "Continue anyway".
- If `"unknown"` → log to telemetry; allow but warn.

## Quote-time gate

Quote creation should embed the active wallet's tier into the quote so the webhook reconciler can, on mismatch, surface "payment sent from unverified wallet" as a diagnostic rather than a hard failure.
