# FINDINGS.md

Documentation-verification sweep summary for LASTPROOF. All facts below are derived from the four companion docs in this directory.

## Confirmed bugs in current code

### 1. `src/lib/constants.ts` — USDC/USDT label mixup (pre-known)

Per the brief, `constants.ts` has `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` labeled as **USDT**, but the brief also claims this was originally bound to the USDC symbol. The verified canonical mapping is:

```
USDC = EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v   // 6 decimals, Circle-issued
USDT = Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB   // 6 decimals, Tether-issued
```

Fix: open `src/lib/constants.ts` and ensure both constants are present and each bound to the correct mint + correct 6-decimal value. See TOKEN-REGISTRY.md.

### 2. `src/lib/quotes-store.ts` — fake hex reference (pre-known)

The Solana Pay spec requires `reference` to be a **base58-encoded 32-byte pubkey**, not hex. Any hex-encoded reference will either be rejected by spec-compliant wallets or silently mis-parsed. The fix is to generate a fresh `Keypair.generate().publicKey.toBase58()` per quote and persist it on the quote row. See SOLANA-PAY-VERIFICATION.md section 1.

## New bugs / risks discovered during research

### 3. LASTSHFT decimals not verified on-chain

`TOKEN-REGISTRY.md` notes that Solana Explorer is SPA-rendered and the decoded token metadata was not retrievable via HTML fetch. LASTPROOF should call `getMint()` once against the mainnet mint `5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB`, record the decimals in `constants.ts`, and add a sanity-check at app startup.

### 4. Helius webhook mode assumption (Enhanced vs Raw)

In Helius **Enhanced** webhooks, `instructions[].accounts` is an array of **base58 pubkey strings**. In **Raw** webhooks, it is an array of **numeric indices** into `message.accountKeys`. LASTPROOF code that does `instruction.accounts.includes(referenceKey)` implicitly assumes Enhanced mode. Action: verify the webhook was created with `"webhookType": "enhanced"` (not `"raw"`), and add a runtime type guard. See HELIUS-WEBHOOK-VERIFICATION.md.

### 5. Helius auth header is a plain string, not HMAC

Webhook authenticity is verified ONLY by a static `Authorization` header value set at webhook-creation time. There is no HMAC signature. Therefore:

- The secret must be long, random, and stored in env.
- Comparison must be constant-time.
- Dedupe on `signature` because there is no replay protection.

### 6. Unverified wallet coverage (Jupiter Mobile, Binance)

Neither Jupiter Mobile nor Binance Web3 Wallet has documented Solana Pay Transfer Request URI support. LASTPROOF should not assume parity with Phantom/Solflare. See WALLET-COMPAT.md and WALLET-POLICY.md. Recommend a warning modal at connect time.

### 7. Repeated `reference` param construction

If LASTPROOF ever adds multiple references to a URI, it MUST use `URLSearchParams.append("reference", ref)` in a loop, NOT `set`, because the Solana Pay spec allows repetition and wallets preserve order.

## Required new files

| Path | Purpose |
|---|---|
| `src/lib/solana-pay.ts` | Centralize Transfer Request URI construction: base58 reference generation, `URLSearchParams` with repeated `reference`, `spl-token`/`amount`/`label`/`message`/`memo` handling. Consumed by quote creation + QR rendering. |
| `src/lib/wallet-policy.ts` | `classifyWallet()` and `isSolanaPaySupported()` helpers; tier sets for verified / unverified wallets. Consumed by connect gate, quote gate, and UI warning banners. |
| `src/lib/helius-webhook.ts` | TypeScript types for the Enhanced webhook payload (signature, feePayer, tokenTransfers, instructions with `accounts: string[]`, etc.), plus an `authorize(request)` helper that constant-time-compares the `Authorization` header against `process.env.HELIUS_WEBHOOK_SECRET`, plus a `findReferenceInEvent(event, refBase58)` helper. |

## Required code changes (no code written in this sweep)

1. Fix `constants.ts` USDC/USDT binding and add verified LASTSHFT decimals.
2. Replace hex reference generation in `quotes-store.ts` with base58 32-byte pubkey.
3. Wire `src/lib/solana-pay.ts` into the quote → QR path.
4. Wire `src/lib/wallet-policy.ts` into the connect button / header.
5. Harden the Helius webhook route with constant-time auth header check and enforce Enhanced shape.

## Source index

- [Solana Pay spec](https://docs.solanapay.com/spec)
- [anza-xyz/solana-pay](https://github.com/anza-xyz/solana-pay)
- [Helius Webhooks](https://www.helius.dev/docs/webhooks)
- [Helius Create Webhook API](https://www.helius.dev/docs/api-reference/webhooks/create-webhook)
- [Circle — USDC on Solana](https://www.circle.com/multi-chain-usdc/solana)
- [Tether — Supported Protocols](https://tether.to/en/supported-protocols/)
- [Phantom Deeplinks](https://phantom.com/learn/blog/the-complete-guide-to-phantom-deeplinks)
- [Solflare Deeplinks](https://docs.solflare.com/solflare/technical/deeplinks)
- [Jupiter Mobile](https://jup.ag/mobile)
- [Binance Web3 Wallet — Solana integration](https://www.binance.com/en/support/announcement/binance-web3-wallet-completes-integration-of-solana-network-4193f1d593d541a18e766c5f4c46831d)
