# LASTPROOF Pricing (LOCKED)

Source of truth for every price, discount, tolerance, and cooldown in
LASTPROOF. Anything charging the user flows through `lib/pricing.ts`
which imports these exact numbers. Changing a price means changing it
here AND in `lib/pricing.ts` — nowhere else.

## Base prices (USD)

All items are denominated in USD. On-chain amounts are computed at
quote-issue time against a token/USD rate with a short TTL lock.

| Item              | Kind               | SOL / USDT | $LASTSHFT (40% off) |
| ----------------- | ------------------ | ---------- | ------------------- |
| Proof             | `proof`            | $1.00      | $0.60               |
| DEV proof         | `dev_verification` | $5.00      | $3.00               |
| Monthly profile   | `subscription`     | $10.00     | $6.00               |
| Handle change     | `handle_change`    | **$100**   | **$60**             |

**$LASTSHFT discount: 40% flat, all items.** The discount is the only
reason to hold the token; it must be honored without exception on
qualifying payments.

## Handle change — elevated price + cooldown

Handle changes are deliberately expensive AND rate-limited. This is
a TRUST-BUILD decision, not a revenue one. Users who churn handles
poison the reputation graph for peers who trusted the prior handle.

- **Price: $100 in SOL/USDT, $60 in $LASTSHFT.** Double every other
  item's base price.
- **Cooldown: 90 days between successful handle changes.** Attempts
  within the cooldown are rejected at quote time with
  `handle_cooldown_active` and include the `nextEligibleAt` ISO.
- **Public history:** every prior handle is preserved in
  `handle_history` and rendered as "formerly @foo" on the public
  profile view. The financial speed bump is only half the deterrent;
  the public audit trail is the other half.
- **One in-flight at a time:** a pending `handle_change` quote blocks
  new quotes for the same profile until it expires or confirms.

## Accepted tokens

| Token     | Mint                                                     | Notes                                     |
| --------- | -------------------------------------------------------- | ----------------------------------------- |
| $LASTSHFT | `5zHrdYRtUzjkQwnq6HkS6Vq7KCeEQPysmaUmwKqfFLqB`           | 40% discount on every item                |
| SOL       | native                                                   | Full price                                |
| USDT      | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`           | Full price                                |

## Tolerance & quotes

- **Tolerance:** `max(expectedUsd * 0.02, $0.05)` — ±2% or 5¢, whichever
  is larger. Overpayment always accepted.
- **Minimum accepted:** $0.25. Anything below is `dust`, rejected.
- **Quote TTL by token:**
  - USDT: **300 s** (stablecoin, low drift)
  - SOL: **60 s**
  - $LASTSHFT: **60 s**
- **Quote lock:** issued once, valid until `expiresAt`. Payments
  referencing an expired quote return `quote_expired` — user re-quotes.
- **Token mismatch:** if the incoming tx is in a different token than
  the quote specified, reject `discount_token_mismatch`. Do NOT silently
  convert — that would pay the discounted $LASTSHFT price in SOL and
  leak 40% per tx.

## Rejection reasons (webhook)

| Reason                    | When                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `quote_not_found`         | Draft references a quoteId we never issued                      |
| `quote_expired`           | Quote TTL elapsed before tx confirmed                           |
| `discount_token_mismatch` | Paid token ≠ quoted token                                       |
| `underpayment`            | `paidUsd < expectedUsd − tolerance`                             |
| `dust`                    | `paidUsd < MIN_ACCEPTED_USD ($0.25)`                            |
| `handle_cooldown_active`  | Handle change attempted within 90 days of previous change       |

## Constants (code mirror)

```ts
export const BASE_PRICES_USD = {
  proof: 1.00,
  dev_verification: 5.00,
  subscription: 10.00,
  handle_change: 100.00,
} as const;

export const LASTSHFT_DISCOUNT = 0.40;

export const PRICE_TOLERANCE_PCT     = 0.02;
export const PRICE_TOLERANCE_ABS_USD = 0.05;
export const MIN_ACCEPTED_USD        = 0.25;

export const QUOTE_TTL_SEC = {
  USDT: 300,
  SOL:  60,
  LASTSHFT: 60,
} as const;

export const HANDLE_CHANGE_COOLDOWN_DAYS = 90;
```
