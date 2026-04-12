# SOLFLARE WALLET — Complete Integration Report

## 1. Overview

Solflare is one of the original Solana wallets, known for staking and DeFi. Chrome extension + native iOS/Android apps.

**Official docs**: https://docs.solflare.com
**Deep links**: https://docs.solflare.com/solflare/technical/deeplinks
**Browse deep link**: `https://solflare.com/ul/v1/browse/{url}?ref={origin}`
**MWA confirmed**: Yes — listed at https://wallets.solanamobile.com/

**Adapter package**: `@solana/wallet-adapter-solflare` (installed, uses `@solflare-wallet/sdk`)
**Adapter source**: `node_modules/@solana/wallet-adapter-solflare/src/adapter.ts` (293 lines)

---

## 2. Desktop Flow (Chrome Extension)

### How it works (from adapter source code)

1. **Detection**: Constructor calls `scopePollingDetectionStrategy()` which polls for `window.solflare?.isSolflare || window.SolflareApp`. When found, sets `readyState = Installed`. **Key difference from Phantom**: Solflare starts with `readyState = Loadable` (not `NotDetected`). This is because Solflare uses its SDK (`@solflare-wallet/sdk`) as a fallback when the extension isn't installed — the SDK can open a web-based wallet.

2. **Connect**: `connect()` dynamically imports `@solflare-wallet/sdk`, creates a `Solflare` instance, calls `wallet.connect()` → extension popup OR SDK web wallet appears → user approves → `publicKey` returned.

3. **Sign transaction**: `signTransaction(tx)` calls `wallet.signTransaction(tx)` → popup → approve → signed tx returned.

4. **Sign and send**: `sendTransaction()` calls `wallet.signAndSendTransaction(tx, sendOptions)` → popup → approve → signature returned.

### What the user sees

Same as Phantom: extension popup for connect, separate popup for sign.

### Difference from Phantom adapter

- Solflare uses `@solflare-wallet/sdk` as a fallback — even without the extension, it can open a web-based wallet
- The SDK is dynamically imported (`import('@solflare-wallet/sdk')`) — adds ~50KB to the first connect
- `readyState` starts at `Loadable` not `NotDetected` — this means on iOS, the adapter goes straight to the browse deep link path (same as Phantom)

### Desktop steps for LASTPROOF proof flow

```
Step 1: Select wallet (Solflare selected)
Step 2: Connect — click "CONNECT WALLET" → extension popup (or SDK web wallet) → approve
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

### How it works (from adapter + MWA source code)

**Identical to Phantom on Android — uses MWA.**

The detection chain:
1. `getEnvironment()` detects Android + not WebView → `MOBILE_WEB`
2. `WalletProvider` creates `SolanaMobileWalletAdapter`
3. MWA fires `solana-wallet://` Android intent → Solflare app receives it → starts local WebSocket
4. Web app connects via `ws://localhost:{port}/solana-wallet`
5. **No page reload. No state loss. No deep links.**

Solflare is confirmed MWA-compatible (listed at wallets.solanamobile.com).

### What the user sees on Android

- Click "Solflare" → Android switches to Solflare app briefly
- Solflare shows approval → user approves → Chrome returns to foreground
- Page exactly as they left it
- Sign: same app-switch pattern

### Android steps for LASTPROOF proof flow

```
Step 1: Select wallet (Solflare selected)
Step 2: Connect — click "CONNECT WALLET" → MWA intent → Solflare app → approve → return
Step 3: Path select (collab/dev)
Step 4: Comment (140 char)
Step 5: Token select (LASTSHFT/SOL/USDT)
Step 6: Eligibility stream (SSE)
Step 7: Review + live price
Step 8: Sign — MWA intent → Solflare app → approve → return
Step 9: Outcome (confirmed/failed)
```

**Total: 9 screens**

---

## 4. Mobile Flow — iOS

### How it works (from adapter source code)

The Solflare adapter's `connect()` method (lines 97-101):
```ts
if (this.readyState === WalletReadyState.Loadable && isIosAndRedirectable()) {
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://solflare.com/ul/v1/browse/${url}?ref=${ref}`;
    return;
}
```

**Identical pattern to Phantom on iOS** — browse deep link, full page navigation, state loss, re-entry in Solflare's in-app browser.

### Difference from Phantom on iOS

- Solflare's `autoConnect()` behavior is slightly different (line 92-96):
  ```ts
  async autoConnect(): Promise<void> {
      if (!(this.readyState === WalletReadyState.Loadable && isIosAndRedirectable())) {
          await this.connect();
      }
  }
  ```
  This means autoConnect is skipped on iOS when Loadable — same as Phantom. User must manually click connect after the bounce.

- Solflare's in-app browser injects `window.solflare.isSolflare` — the polling strategy detects it and sets `readyState = Installed`.

### iOS steps for LASTPROOF proof flow

```
Step 1: Select wallet (Solflare selected)
Step 2: Deep link fires → Solflare app opens → page loads in Solflare's in-app browser
Step 3: Page detects Solflare in-app browser → auto-opens proof modal → shows "CONNECT WALLET"
Step 4: Connect — click "CONNECT WALLET" → in-app browser popup → approve
Step 5: Path select (collab/dev)
Step 6: Comment (140 char)
Step 7: Token select (LASTSHFT/SOL/USDT)
Step 8: Eligibility stream (SSE)
Step 9: Review + live price
Step 10: Sign — in-app browser popup → approve transaction
Step 11: Outcome (confirmed/failed)
```

**Total: 11 screens**

---

## 5. Differences From Current Code

| Area | Current code | What should be |
|------|-------------|----------------|
| **Detection** | Custom `detectWalletEnvironment()` | Let the adapter handle it |
| **Android** | Custom deep-link code | MWA handles it — no custom code needed |
| **iOS** | Same as Android | Handle bounce — URL state persistence + auto-restore |
| **SDK fallback** | Not leveraged | Solflare SDK web wallet could work as iOS fallback without deep link |

### Unique Solflare consideration

Solflare's SDK (`@solflare-wallet/sdk`) provides a web-based wallet fallback. On iOS where the deep link bounce is awkward, we could potentially use the SDK's web wallet mode instead of the browse deep link. This would avoid the bounce entirely. However, this is a different UX (web wallet popup vs native app) and may not be what users expect.

**Recommendation**: Use the browse deep link on iOS (matches Phantom behavior — users expect consistency). The SDK web wallet is a fallback if the deep link fails.

---

## 6. Maintenance & Updates

**Adapter**: `@solana/wallet-adapter-solflare` — follows semver, updates ~quarterly
**SDK**: `@solflare-wallet/sdk` — dynamically imported, version locked in adapter
**Deep links**: `solflare.com/ul/v1/browse/` — v1 has been stable since launch

**What to watch for**:
- Solflare SDK version updates (may change web wallet behavior)
- Deep link URL format changes (unlikely — versioned as v1)
- MWA protocol updates

---

## 7. Emergency Debug Plan

### Desktop: Solflare not connecting
1. Check `window.solflare?.isSolflare` in console
2. If extension not installed, adapter falls back to SDK web wallet — check if SDK imported successfully
3. Check for `WalletLoadError` (SDK import failed) or `WalletConfigError` (SDK instantiation failed)

### Android: MWA not working
Same as Phantom — MWA is wallet-agnostic:
1. Check `getIsSupported()` — Android + secure context
2. Check Solflare app installed and updated
3. Check `blur` event fires
4. Check WebSocket connection

### iOS: Browse deep link not opening Solflare
1. Check `isIosAndRedirectable()` returns true
2. Check Solflare app installed
3. No `target="_blank"` on the link
4. Fallback: try Solflare SDK web wallet mode

---

## 8. Code Plan — Screen Files

### Desktop (9 screens)
```
src/components/proof-modal/flows/solflare/desktop/
├── SolflareDesktopFlow.tsx
├── Step1Select.tsx
├── Step2Connect.tsx
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
src/components/proof-modal/flows/solflare/android/
├── SolflareAndroidFlow.tsx
├── Step1Select.tsx
├── Step2Connect.tsx          ← MWA intent (identical mechanism to Phantom Android)
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
src/components/proof-modal/flows/solflare/ios/
├── SolflareIosFlow.tsx
├── Step1Select.tsx
├── Step2Bounce.tsx           ← browse deep link to solflare.com/ul/v1/browse/
├── Step3ReEntry.tsx
├── Step4Connect.tsx
├── Step5Path.tsx
├── Step6Comment.tsx
├── Step7Token.tsx
├── Step8Eligibility.tsx
├── Step9Review.tsx
├── Step10Sign.tsx
└── Step11Outcome.tsx
```

---

## 9. How Solflare Deploys Proofs in Our System

Identical to Phantom once connected. Same API endpoints, same proof insertion logic, same webhook flow. The wallet adapter abstracts the signing — `adapter.signTransaction()` works the same regardless of which wallet is connected.

---

## 10. Testing Plan

### Desktop Test
Same as Phantom desktop but with Solflare extension installed.

### Android Test (Samsung S25)
Same as Phantom Android but Solflare app must be installed. MWA handles the connection.

### iOS Test
Same as Phantom iOS but deep link goes to `solflare.com/ul/v1/browse/`.

---

## 11. Final Checklist

Same checklist as Phantom — all proof logic is wallet-agnostic. Only the connection mechanism differs.

- [ ] Desktop: Solflare extension/SDK detected, connect works, sign works, proof recorded
- [ ] Android: MWA connect works, page state preserved, sign works, proof recorded
- [ ] iOS: Browse deep link opens Solflare, re-entry restores modal, connect works, sign works, proof recorded
- [ ] All failure codes render correctly
- [ ] Webhook fires → proof recorded → tier recalculated
