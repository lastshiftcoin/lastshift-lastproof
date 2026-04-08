# HELIUS-WEBHOOK-VERIFICATION.md

Verified against [Helius Webhooks docs](https://www.helius.dev/docs/webhooks) and [Helius Webhook Transaction Types](https://www.helius.dev/docs/webhooks/transaction-types).

## Event payload (Enhanced webhook)

Helius delivers an **array** of event objects per POST. Each object has these top-level fields:

| Field | Type | Notes |
|---|---|---|
| `signature` | string | Transaction signature (base58). |
| `slot` | number | Slot the tx landed in. |
| `timestamp` | number | Unix seconds. |
| `type` | string | Enhanced tx type (`TRANSFER`, `SWAP`, `NFT_SALE`, `UNKNOWN`, ...). |
| `source` | string | Program/source (`SYSTEM_PROGRAM`, `MAGIC_EDEN`, `JUPITER`, ...). |
| `fee` | number | Lamports. |
| `feePayer` | string | Base58 pubkey. |
| `description` | string | Human-readable summary. |
| `nativeTransfers` | array | `{ fromUserAccount, toUserAccount, amount }` (amount in lamports). |
| `tokenTransfers` | array | `{ fromUserAccount, toUserAccount, fromTokenAccount, toTokenAccount, tokenAmount, mint, tokenStandard }`. `tokenAmount` is the **uiAmount** (decimal-scaled). |
| `accountData` | array | `{ account, nativeBalanceChange, tokenBalanceChanges: [{ userAccount, tokenAccount, mint, rawTokenAmount: { tokenAmount, decimals } }] }`. |
| `instructions` | array | Parsed instructions (see below). |
| `events` | object | Protocol-specific decoded events (e.g. `events.nft`, `events.swap`). |
| `transactionError` | object \| null | `null` on success. |

### Instruction object shape

**Confirmed**: each instruction object in `instructions[]` has the form

```json
{
  "accounts": ["<base58 pubkey>", "..."],
  "data": "<base58 instruction data>",
  "programId": "<base58 program id>",
  "innerInstructions": [ /* same shape, recursive */ ]
}
```

> Important: in Helius **Enhanced** webhook instructions, `accounts` is an **array of base58 pubkey strings** — already dereferenced from the transaction's account keys table. This differs from the **Raw** webhook format where `accounts` is an array of numeric indices into the `message.accountKeys` table. If LASTPROOF is parsing `accounts[i]` as a string, the webhook MUST be configured as **Enhanced**, not Raw.

## Authentication / verification

- Helius does **not** sign webhooks with HMAC or an asymmetric key.
- At webhook-creation time you pass an `authHeader` string. Helius includes it verbatim as the HTTP `Authorization` header on every POST to your URL.
- Verification on your endpoint: check `request.headers['authorization'] === process.env.HELIUS_WEBHOOK_SECRET`. Reject otherwise.
- Store the secret in env and use a constant-time comparison.
- There is no replay protection at the transport layer; use `signature` for idempotency and dedupe on the database.

Source: [Helius — Create Webhook API reference](https://www.helius.dev/docs/api-reference/webhooks/create-webhook).

## LASTPROOF guidance

- Configure webhook as **Enhanced** so `instructions[].accounts` are strings.
- Filter for `type === "TRANSFER"` AND `tokenTransfers[].mint` in the allowlist (USDC / USDT / LASTSHFT).
- Match the payment by scanning `instructions[].accounts` for the quote's `reference` pubkey (it will be present as a read-only key on the transfer instruction per Solana Pay spec).
- Use `signature` as the dedupe key — Helius may redeliver on 5xx responses.
