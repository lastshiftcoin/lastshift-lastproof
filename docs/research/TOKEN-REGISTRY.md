# TOKEN-REGISTRY.md

Verified mainnet SPL token mints relevant to LASTPROOF.

## USDC (Circle, native Solana)

- **Mint:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Decimals:** 6
- **Issuer:** Circle
- **Sources:**
  - [Circle — USDC on Solana](https://www.circle.com/multi-chain-usdc/solana)
  - [Solana Explorer — USDC](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
  - [Solscan — USDC](https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
  - Circle explicitly states that bridged USDC variants are NOT issued by Circle; this mint is the only Circle-issued native USDC on Solana mainnet.

## USDT (Tether, native Solana)

- **Mint:** `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **Decimals:** 6
- **Issuer:** Tether
- **Sources:**
  - [Tether — Supported Protocols](https://tether.to/en/supported-protocols/)
  - [Solana Explorer — USDT](https://explorer.solana.com/address/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB)
  - [Solscan — USDT](https://solscan.io/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB)

## LASTSHFT (project token)

- **Mint:** `5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB`
- **Decimals:** TO VERIFY on-chain via `getAccountInfo` / `getMint`. Explorer pages did not render decoded metadata in the fetched HTML (Solana Explorer is SPA-rendered). Canonical read: call `getMint(connection, new PublicKey("5zHr..."))` from `@solana/spl-token`. Recommended before shipping: persist the result in `constants.ts` with a code comment pointing to the tx/mint authority.
- **Sources:**
  - [Solana Explorer — 5zHr...FLqB](https://explorer.solana.com/address/5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB)

## BUG FLAG — `src/lib/constants.ts`

The current `src/lib/constants.ts` labels `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` as **USDT**. That is correct for the mint identity (it IS Tether), but the task brief claims the file has it labeled as USDC. Two possible states:

1. If constants.ts has `USDC = Es9vMF...` → **BUG**: that is USDT, not USDC. USDC is `EPjFWdd5...`.
2. If constants.ts has `USDT = Es9vMF...` → **correct mint, correct label**.

A reviewer must open the file and confirm which symbol is bound to which address. The safe canonical mapping is:

```
USDC  = EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  // 6 decimals
USDT  = Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB  // 6 decimals
```
