# SOLANA-PAY-VERIFICATION.md

Verified against [docs.solanapay.com/spec](https://docs.solanapay.com/spec) and [anza-xyz/solana-pay](https://github.com/anza-xyz/solana-pay).

## 1. Transfer Request URI

### Scheme

```
solana:<recipient>?<query>
```

`<recipient>` is the base58 public key of a native SOL account (NOT an associated token account), placed in the URI path.

### Parameters

| Param | Required | Format | Notes |
|---|---|---|---|
| `recipient` | yes (path) | base58 pubkey | Must be a system-program-owned account for native SOL, or the SOL owner of an ATA when used with `spl-token`. |
| `amount` | optional | non-negative decimal in user units | Leading zero required for `<1` (e.g. `0.01`). If omitted, wallet prompts. For SPL tokens, interpreted as `uiAmountString` (scaled by mint decimals). |
| `spl-token` | optional | base58 mint | Presence switches the request from SOL to SPL token transfer. Wallet derives the sender and recipient ATA from the mint + recipient. |
| `reference` | optional, repeatable | base58 32-byte | Included as read-only, non-signer account keys on the transfer instruction, **in the order provided**. Used for lookup via `getSignaturesForAddress`. Multiple `reference` params are allowed. |
| `label` | optional | URL-encoded UTF-8 | Human-readable source (brand, store). |
| `message` | optional | URL-encoded UTF-8 | Human-readable purpose (item, order id). |
| `memo` | optional | URL-encoded UTF-8 | Emitted as an SPL Memo instruction placed **immediately before** the transfer instruction in the transaction. |

### Reference field format (confirmed)

- Base58 encoding of a 32-byte array. Any valid Ed25519 public key shape works; the spec does not require it to be a curve-valid point. Most implementations use `Keypair.generate().publicKey.toBase58()` so it is unambiguously curve-valid.
- Wallets MUST include every `reference` as a read-only, non-signer key on the transfer instruction, in order.
- **NOT** hex. Any hex-encoded reference (e.g. 64 hex chars) is invalid and will either be rejected by the wallet or, worse, silently treated as an unrelated base58 string. See FINDINGS.md for the current `quotes-store.ts` bug.

### Example

```
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&reference=82iWiBNwE7qFweMXkmJSJr4XMzVwT3jgCyuF2K3sT1Wm&label=LASTPROOF&message=Order%20123
```

## 2. Transaction Request URI

### Scheme

```
solana:<link>
```

`<link>` is an absolute `https://` URL. URL-encode it only if it contains its own query parameters (encoding is otherwise skipped to keep QR codes compact).

### Flow

1. **GET** `<link>` — wallet fetches, shows the URL's host to the user.
2. **GET response** — JSON `{ "label": "<string>", "icon": "<svg|png|webp absolute url>" }`.
3. **POST** `<link>` with body `{ "account": "<base58 signer pubkey>" }`.
4. **POST response** — JSON `{ "transaction": "<base64 serialized tx>", "message": "<optional string>" }`.

Wallet behavior:
- Validates `feePayer` and `recentBlockhash` depending on whether the tx has existing signatures.
- Verifies any pre-existing signatures.
- Signs ONLY with the account it POSTed.
- Shows `message` to the user if present.

## 3. Notes for LASTPROOF

- Building the URI manually with `URLSearchParams` is fine, but the repeated `reference` param requires `params.append("reference", ref)` (NOT `set`).
- For LASTSHFT / USDC / USDT payments, always pass `spl-token=<mint>` plus `amount=<decimal uiAmount>`. Do NOT multiply by `10^decimals` in the URI — that is the wallet's job.
- Always include at least one `reference` so the backend watcher can correlate via `getSignaturesForAddress`.
- `label` and `message` are UX only; `memo` lands on-chain.
