# BACKPACK WALLET — Complete Integration Report

## 1. Overview

Backpack is a multi-chain wallet (Solana, Ethereum, Sui) known for xNFTs and the Backpack Exchange. Chrome extension + native iOS/Android apps.

**Official docs**: https://docs.backpack.app
**Deep links**: https://docs.backpack.app/deeplinks
**Browse deep link**: https://docs.backpack.app/deeplinks/other-methods/browse
**Connect deep link**: https://docs.backpack.app/deeplinks/provider-methods/connect
**MWA confirmed**: Yes — listed at https://wallets.solanamobile.com/

**Adapter package**: No explicit `@solana/wallet-adapter-backpack` package. Backpack registers via **Wallet Standard** — it auto-appears in the wallet adapter when the extension or in-app browser is active.
**No adapter source to read** — Backpack implements the Wallet Standard interface directly in their extension/app.

---

## 2. Desktop Flow (Chrome Extension)

### How it works

1. **Detection**: Backpack extension registers itself via the Wallet Standard (`navigator.wallets`). The `useStandardWalletAdapters()` hook inside `@solana/wallet-adapter-react` picks it up automatically. It appears as `"Backpack"` in the wallets array.

2. **Connect**: Standard Wallet Standard flow — `select("Backpack")` → `connect()` → Backpack extension shows approval popup → user approves → public key returned.

3. **Sign transaction**: Backpack implements `SolanaSignTransaction` feature of the Wallet Standard — `signTransaction()` works.

4. **Sign and send**: Backpack implements `SolanaSignAndSendTransaction` — `sendTransaction()` works.

### What the user sees

Same as Phantom/Solflare: extension popup for connect, separate popup for sign.

### Key difference from Phantom/Solflare

- **No explicit adapter instantiation needed** — Backpack uses Wallet Standard auto-discovery. Our `WalletBoundary` in `provider.tsx` only instantiates `PhantomWalletAdapter()` and `SolflareWalletAdapter()` explicitly. Backpack auto-registers if the extension is installed.
- **Our `classifyWallet()` in `wallet-policy.ts` must recognize "Backpack"** — currently the allowlist has phantom, solflare, jupiter, binance. **Backpack needs to be added.**
- **`WALLET_META` and `WALLET_ORDER` in `deep-link.ts` need a backpack entry.**

### Desktop steps for LASTPROOF proof flow

```
Step 1: Select wallet (Backpack selected)
Step 2: Connect — click "CONNECT WALLET" → extension popup → approve
Step 3: Path select (collab/dev)
Step 4: Comment (140 char)
Step 5: Token select (LASTSHFT/SOL/USDT)
Step 6: Eligibility stream (SSE)
Step 7: Review + live price
Step 8: Sign — extension popup → approve transaction
Step 9: Outcome (confirmed/failed)
```

**Total: 9 screens**

---

## 3. Mobile Flow — Android (Samsung S25)

### How it works

**Same as Phantom/Solflare on Android — uses MWA.**

Backpack is confirmed MWA-compatible (listed at wallets.solanamobile.com). The MWA flow is wallet-agnostic:
1. `SolanaMobileWalletAdapter` fires `solana-wallet://` Android intent
2. Backpack app receives the intent, starts local WebSocket
3. Web app connects via `ws://localhost:{port}/solana-wallet`
4. No page reload, no state loss

### What the user sees on Android

Same as Phantom/Solflare — brief app switch to Backpack, approve, return to Chrome.

### Android steps for LASTPROOF proof flow

```
Step 1: Select wallet (Backpack selected)
Step 2: Connect — click "CONNECT WALLET" → MWA intent → Backpack app → approve → return
Step 3: Path select (collab/dev)
Step 4: Comment (140 char)
Step 5: Token select (LASTSHFT/SOL/USDT)
Step 6: Eligibility stream (SSE)
Step 7: Review + live price
Step 8: Sign — MWA intent → Backpack app → approve → return
Step 9: Outcome (confirmed/failed)
```

**Total: 9 screens**

---

## 4. Mobile Flow — iOS

### How it works

Backpack has a browse deep link (confirmed in their docs):
```
https://backpack.app/ul/v1/browse/<url-encoded-target>?ref=<url-encoded-origin>
```

**However**: unlike Phantom and Solflare, Backpack does NOT have an explicit adapter package with `isIosAndRedirectable()` handling. Backpack uses Wallet Standard auto-discovery, which means:

1. On iOS Safari, no Backpack extension is installed → Wallet Standard doesn't find Backpack → it won't appear in the wallet list at all
2. The browse deep link must be handled by OUR code (not the adapter)
3. We need to always show Backpack as an option and fire the browse deep link manually on iOS

**This is the key difference from Phantom/Solflare on iOS**: for those wallets, the adapter itself fires the browse deep link when `connect()` is called. For Backpack, we must build this ourselves.

### What the user sees on iOS

Same bounce pattern as Phantom/Solflare:
- Click "Backpack" → our code fires browse deep link → Backpack app opens → page loads in Backpack's in-app browser
- Page loads fresh (state lost) → detect in-app browser → auto-open modal
- Backpack provider is injected via Wallet Standard → shows as detected
- Connect → approve → flow continues

### iOS steps for LASTPROOF proof flow

```
Step 1: Select wallet (Backpack selected)
Step 2: Deep link fires → Backpack app opens → page loads in Backpack's in-app browser
Step 3: Page detects Backpack in-app browser → auto-opens proof modal → shows "CONNECT WALLET"
Step 4: Connect — click "CONNECT WALLET" → in-app browser Wallet Standard connect → approve
Step 5: Path select (collab/dev)
Step 6: Comment (140 char)
Step 7: Token select (LASTSHFT/SOL/USDT)
Step 8: Eligibility stream (SSE)
Step 9: Review + live price
Step 10: Sign — in-app browser → approve transaction
Step 11: Outcome (confirmed/failed)
```

**Total: 11 screens**

---

## 5. Differences From Current Code

| Area | Current code | What should be |
|------|-------------|----------------|
| **Allowlist** | `wallet-policy.ts` has phantom, solflare, jupiter, binance | **Add "backpack"** to `KnownWallet` type, `ADAPTER_NAME_MAP`, and classification |
| **WALLET_META** | `deep-link.ts` has phantom, solflare, jupiter, binance | **Replace jupiter+binance with backpack** — add browse deep link builder |
| **WALLET_ORDER** | `[phantom, solflare, jupiter, binance]` | **Change to `[phantom, solflare, backpack]`** |
| **Provider** | Instantiates PhantomWalletAdapter + SolflareWalletAdapter | **No change needed** — Backpack auto-registers via Wallet Standard |
| **wallet-configs.ts** | Has configs for all 4 old wallets | **Replace jupiter+binance with backpack** |
| **Android** | Custom deep-link code | MWA handles it (same as Phantom/Solflare) |
| **iOS** | N/A for Backpack currently | **Must build custom browse deep link handling** — the adapter doesn't do it for us |

### Backpack-specific integration work

1. Add `"backpack"` to `KnownWallet` type union in `wallet-policy.ts`
2. Add Backpack to `ADAPTER_NAME_MAP`: `"backpack" → "backpack"`
3. Add Backpack to `WALLET_META` in `deep-link.ts` with browse deep link builder
4. Update `WALLET_ORDER` to `[phantom, solflare, backpack]`
5. On iOS: manually fire browse deep link (adapter doesn't handle it like Phantom/Solflare do)
6. On desktop/Android: Wallet Standard auto-discovery handles everything — just need the classification to pass

---

## 6. Maintenance & Updates

**Wallet Standard**: Backpack implements this — auto-detected. No adapter package to maintain.

**What to watch for**:
- Backpack extension updates may change the adapter name string (currently "Backpack") — if it changes, `classifyWallet()` breaks
- Browse deep link format changes (`backpack.app/ul/v1/browse/`) — currently v1, versioned
- Backpack may release an official adapter package in the future — would replace our manual classification
- MWA protocol updates

**Update frequency**: Less maintenance than Phantom/Solflare since there's no adapter package to update. Just monitor the adapter name string and deep link format.

---

## 7. Emergency Debug Plan

### Desktop: Backpack not showing in wallet list
1. Check if Backpack extension is installed → it must register via Wallet Standard
2. Check `useWallet().wallets` — look for an adapter with name "Backpack"
3. Check `classifyWallet("Backpack")` — if it returns `tier: "blocked"`, Backpack is filtered out (we need to add it to the allowlist)
4. Check for Wallet Standard conflicts — other wallets might interfere

### Android: MWA not connecting to Backpack
1. Check Backpack app is installed and supports MWA
2. MWA is wallet-agnostic — if Phantom MWA works, Backpack MWA should too
3. Check if Backpack app version supports MWA (older versions might not)

### iOS: Browse deep link not opening Backpack
1. Check Backpack app is installed on the device
2. Verify URL format: `https://backpack.app/ul/v1/browse/{encoded-url}?ref={encoded-origin}`
3. No `target="_blank"` — universal links need same-window navigation
4. Fallback: show "Open Backpack app and navigate to this URL" instruction

---

## 8. Code Plan — Screen Files

### Desktop (9 screens)
```
src/components/proof-modal/flows/backpack/desktop/
├── BackpackDesktopFlow.tsx
├── Step1Select.tsx
├── Step2Connect.tsx          ← Wallet Standard connect (extension popup)
├── Step3Path.tsx
├── Step4Comment.tsx
├── Step5Token.tsx
├── Step6Eligibility.tsx
├── Step7Review.tsx
├── Step8Sign.tsx
└── Step9Outcome.tsx
```

### Android Mobile (9 screens)
```
src/components/proof-modal/flows/backpack/android/
├── BackpackAndroidFlow.tsx
├── Step1Select.tsx
├── Step2Connect.tsx          ← MWA intent (same mechanism as Phantom/Solflare)
├── Step3Path.tsx
├── Step4Comment.tsx
├── Step5Token.tsx
├── Step6Eligibility.tsx
├── Step7Review.tsx
├── Step8Sign.tsx
└── Step9Outcome.tsx
```

### iOS Mobile (11 screens)
```
src/components/proof-modal/flows/backpack/ios/
├── BackpackIosFlow.tsx
├── Step1Select.tsx
├── Step2Bounce.tsx           ← OUR code fires backpack.app/ul/v1/browse/ (adapter doesn't)
├── Step3ReEntry.tsx
├── Step4Connect.tsx          ← Wallet Standard connect inside Backpack's in-app browser
├── Step5Path.tsx
├── Step6Comment.tsx
├── Step7Token.tsx
├── Step8Eligibility.tsx
├── Step9Review.tsx
├── Step10Sign.tsx
└── Step11Outcome.tsx
```

---

## 9. How Backpack Deploys Proofs in Our System

Identical to Phantom and Solflare. The Wallet Standard abstraction means `signTransaction()` works the same way. Same API endpoints, same webhook flow, same proof insertion.

The only difference is the adapter name string — `classifyWallet("Backpack")` must return `canonical: "backpack"` for the connection to be recognized.

---

## 10. Testing Plan

### Desktop Test
1. Install Backpack extension in Chrome
2. Open profile, click VERIFY THIS WORK
3. Backpack should appear in wallet list (via Wallet Standard auto-discovery)
4. Select Backpack → connect → proof flow → confirmed

### Android Test (Samsung S25)
1. Install Backpack app on Samsung
2. Open profile in Chrome, click VERIFY THIS WORK
3. Select Backpack → MWA intent fires → Backpack app opens → approve → return
4. Continue proof flow → confirmed

### iOS Test
1. Install Backpack app on iPhone
2. Open profile in Safari, click VERIFY THIS WORK
3. Select Backpack → browse deep link fires → Backpack app opens → page loads in in-app browser
4. Detect in-app browser → auto-open modal → connect → proof flow → confirmed

---

## 11. Final Checklist

- [ ] `wallet-policy.ts` updated: "backpack" in KnownWallet + ADAPTER_NAME_MAP
- [ ] `deep-link.ts` updated: backpack in WALLET_META + WALLET_ORDER
- [ ] Jupiter and Binance removed from allowlist/wallet order
- [ ] Desktop: Backpack auto-detected via Wallet Standard, connect works, sign works, proof recorded
- [ ] Android: MWA connect works with Backpack app, page state preserved, proof recorded
- [ ] iOS: Our browse deep link code fires for Backpack, re-entry works, proof recorded
- [ ] All failure codes render correctly
- [ ] Webhook fires → proof recorded → tier recalculated
