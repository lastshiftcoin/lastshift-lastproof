# LASTPROOF — Security Notes

Canonical log of known-non-reachable vulnerabilities and the reasoning for why they don't block production. If a future audit report flags one of these, read here first before panicking.

Format: finding header, status, dep graph proof, mitigation. Append-only.

---

## `elliptic` — GHSA-848j-6mx2-7j84

**Status:** known, non-reachable, not blocking.
**Severity:** high (per `npm audit`).
**Advisory:** https://github.com/advisories/GHSA-848j-6mx2-7j84
**Title:** "Elliptic Uses a Cryptographic Primitive with a Risky Implementation"
**Version range flagged:** `*` (all versions in our tree at time of writing).
**First seen:** proof modal step 2 install (`@solana/wallet-adapter-*`), 2026-04-09.

### Why it's in the tree

`elliptic` reaches our `node_modules` exclusively through three legacy Solana wallet adapters we **do not mount**:

```
elliptic
├── @toruslabs/*  →  @solana/wallet-adapter-torus          ← NOT MOUNTED
├── @walletconnect/* + @reown/* →  @solana/wallet-adapter-walletconnect  ← NOT MOUNTED
└── browserify-sign / crypto-browserify / tiny-secp256k1 / create-ecdh
        └── @trezor/connect* →  @solana/wallet-adapter-trezor            ← NOT MOUNTED
```

### Why it's not reachable at runtime

LASTPROOF's proof modal mounts **only** Phantom and Solflare via their standalone adapter packages (`@solana/wallet-adapter-phantom`, `@solana/wallet-adapter-solflare`). Jupiter and Binance connect at runtime via **Wallet Standard auto-discovery** (`useStandardWalletAdapters()` inside `@solana/wallet-adapter-react`'s `WalletProvider`), which scans `window.navigator.wallets` for injected Wallet Standard-compliant providers — no explicit adapter class, no import path through the barrel, no `elliptic` code reached.

The Torus, Trezor, and WalletConnect adapters are never imported from anywhere in `src/`. `elliptic` exists in `node_modules` but is unreachable dead code from the bundler's perspective.

### Mitigation (shipped)

1. **Drop the barrel import.** Do NOT `import { ... } from "@solana/wallet-adapter-wallets"`. The barrel at `@solana/wallet-adapter-wallets/src/index.ts` already re-exports only Phantom + Solflare today (checked 2026-04-09) but that could change on a minor bump. Importing from the barrel creates a drift risk.

2. **Import adapters individually.**
   ```ts
   import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
   import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
   ```
   Pass `[new PhantomWalletAdapter(), new SolflareWalletAdapter()]` as the `wallets` prop to `<WalletProvider>`. Jupiter and Binance are discovered automatically via Wallet Standard at runtime — no explicit instantiation required.

3. **Do not run `npm audit fix --force`.** The forced fix downgrades `@solana/wallet-adapter-wallets` to `0.16.1`, which breaks the transaction-building side of the house. Manual patching only, coordinated between backend + frontend.

### What would make this reachable

If any of these three things happen, this note becomes invalid and the finding MUST be re-triaged:

- We add Torus, Trezor, or WalletConnect to the wallet picker (policy change — would also require a `wallet-policy.ts` update).
- We import from `@solana/wallet-adapter-wallets` barrel instead of individual adapter packages.
- Someone CommonJS-requires `@solana/wallet-adapter-wallets` (bypasses tree-shaking).

Set a reminder to re-run `npm audit --omit=dev` at release-branch cut and confirm the only `high` finding is still `elliptic`.

### Other open findings (non-blocking)

As of 2026-04-09, `npm audit` also reports 27 low + 2 moderate vulnerabilities in the Solana dep graph. These are typical of the ecosystem (WalletConnect v1 legacy `bn.js`, Torus's `bip32` pins, etc.) and all trace through the same three non-mounted adapter packages above. Same mitigation applies: dead code, unreachable, triage at release-branch cut.

---
