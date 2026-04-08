# WALLET-COMPAT.md

Solana Pay Transfer Request URI support across the four wallets LASTPROOF cares about.

## Phantom

- **Solana Pay Transfer Request URI:** Supported. Phantom is one of the original reference implementations of the Solana Pay spec.
- **Deep link scheme:** `https://phantom.app/ul/...` (universal link, recommended) and `phantom://` scheme. Solana Pay URIs use the neutral `solana:` scheme, which Phantom registers as a handler on mobile.
- **Reference keys:** Preserved in the transfer instruction (spec-compliant).
- **SPL token + memo quirks:** None known at the spec level. Phantom correctly derives ATAs from `spl-token` + recipient and emits the SPL Memo instruction before the transfer when `memo` is present.
- **Wallet-adapter name string:** `"Phantom"` (from `@solana/wallet-adapter-phantom`, `PhantomWalletAdapter.name`).
- **Sources:**
  - [Phantom Deeplinks guide](https://phantom.com/learn/blog/the-complete-guide-to-phantom-deeplinks)
  - [Phantom developer docs — Solana](https://docs.phantom.com/solana/integrating-phantom)
  - [Solana Pay spec](https://docs.solanapay.com/spec)

## Solflare

- **Solana Pay Transfer Request URI:** Supported. Solflare implements the `solana:` URI scheme and displays the parsed transfer for user approval.
- **Deep link scheme:** `https://solflare.com/ul/...` (universal link) and `solflare://ul/{path}?{params}` (custom scheme). Solflare's deep-link sample app is public on GitHub.
- **Reference keys:** Preserved (spec-compliant).
- **SPL token + memo quirks:** None documented. Known historical issue: older Solflare mobile versions did not always show memo text in UI, but the on-chain instruction was correct.
- **Wallet-adapter name string:** `"Solflare"` (from `@solana/wallet-adapter-solflare`, `SolflareWalletAdapter.name`).
- **Sources:**
  - [Solflare Deeplinks docs](https://docs.solflare.com/solflare/technical/deeplinks)
  - [solflare-wallet/deep-link-sample-app](https://github.com/solflare-wallet/deep-link-sample-app)
  - [Solflare — Using the Solana Wallet Adapter](https://docs.solflare.com/solflare/technical/integrate-solflare/using-the-solana-wallet-adapter)

## Jupiter Mobile

- **Solana Pay Transfer Request URI:** **Unconfirmed from primary sources.** Jupiter's marketing page and support articles describe "shareable payment links" but do NOT state `solana:` URI handler registration. Jupiter Mobile is primarily a Jupiter-swap front-end wallet; Solana Pay parity with Phantom/Solflare is not documented.
- **Deep link scheme:** Not publicly documented as of this research.
- **Reference keys:** Unknown — requires live device test.
- **Quirks:** Unverified. Treat as **unsupported by default** until a LASTPROOF QA pass confirms.
- **Wallet-adapter name string:** Jupiter Mobile does NOT ship a dedicated wallet-adapter; on mobile it relies on the wallet's MWA (Mobile Wallet Adapter) registration or on scanning QR codes via its camera.
- **Source:** [Jupiter Mobile](https://jup.ag/mobile), [Jupiter Support Center](https://support.jup.ag/)

## Binance App (Web3 Wallet)

- **Solana Pay Transfer Request URI:** **Not confirmed.** Binance Web3 Wallet added Solana network support and handles SPL transfers, but Binance's announcements and developer docs do NOT mention Solana Pay URI handling. Compare with Bitget Wallet which explicitly advertises built-in Solana Pay — Binance does not.
- **Deep link scheme:** Binance App uses `bnc://` and `https://app.binance.com/...` universal links for in-app navigation, but there is no documented `solana:` handler registration.
- **Reference keys:** Unknown.
- **Quirks:** Binance Web3 Wallet is custodial-adjacent and runs inside the Binance superapp; transaction flows go through Binance's in-app signer, which may or may not honor memo instructions and extra reference keys on SPL transfers. **Assume unsupported until verified.**
- **Wallet-adapter name string:** No official `@solana/wallet-adapter` package. Detection relies on `window.BinanceChain` / in-app UA sniffing or WalletConnect.
- **Source:** [Binance Web3 Wallet Solana integration announcement](https://www.binance.com/en/support/announcement/binance-web3-wallet-completes-integration-of-solana-network-4193f1d593d541a18e766c5f4c46831d), [developers.binance.com](https://developers.binance.com/)

## Summary matrix

| Wallet | `solana:` URI | Reference keys | SPL + memo | Adapter name |
|---|---|---|---|---|
| Phantom | yes | yes | yes | `"Phantom"` |
| Solflare | yes | yes | yes | `"Solflare"` |
| Jupiter Mobile | unverified | unverified | unverified | (none) |
| Binance App | unverified / likely no | unverified | unverified | (none) |
