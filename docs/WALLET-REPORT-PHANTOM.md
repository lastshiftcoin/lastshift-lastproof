# PHANTOM WALLET — Complete Integration Report

## 1. Overview

Phantom is the most widely used Solana wallet (~10M+ users). It has a Chrome/Firefox/Edge extension for desktop and native apps for iOS and Android.

**Official docs**: https://docs.phantom.com
**Deep links**: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
**Browse deep link**: https://docs.phantom.com/phantom-deeplinks/other-methods/browse
**MWA confirmed**: Yes — listed at https://wallets.solanamobile.com/

**Adapter package**: `@solana/wallet-adapter-phantom` (v0.9.27 installed)
**Adapter source**: `node_modules/@solana/wallet-adapter-phantom/src/adapter.ts` (307 lines)

---

## 2. Desktop Flow (Chrome Extension)

### How it works (from adapter source code)

1. **Detection**: Constructor calls `scopePollingDetectionStrategy()` which polls for `window.isPhantomInstalled && window.phantom?.solana?.isPhantom`. When found, sets `readyState = Installed`.

2. **Connect**: `connect()` calls `window.phantom.solana.connect()` → Phantom extension shows approval popup → user approves → `publicKey` returned → `connect` event emitted.

3. **Sign transaction**: `signTransaction(tx)` calls `wallet.signTransaction(tx)` → Phantom extension shows transaction approval popup → user approves → signed transaction returned.

4. **Sign and send**: `sendTransaction()` calls `wallet.signAndSendTransaction(tx, sendOptions)` → Phantom extension signs and submits to RPC → returns signature.

### What the user sees

- Click "Phantom" → extension popup appears asking to approve connection
- Click "Approve" → connected, public key available
- Later: click "Sign" → extension popup appears showing transaction details
- Click "Approve" → transaction signed

### Error states

- Extension not installed → `readyState = NotDetected`, shows "NOT INSTALLED"
- User rejects connection → `WalletConnectionError` thrown
- User rejects signature → error thrown, mapped to `user_rejected`

### Desktop steps for LASTPROOF proof flow

```
Step 1: Select wallet (Phantom selected)
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

### How it works (from adapter + MWA source code)

**Android uses Mobile Wallet Adapter (MWA), NOT deep links.**

The adapter detection chain:
1. `getEnvironment()` in `@solana/wallet-adapter-react` checks user agent for Android + not WebView → returns `MOBILE_WEB`
2. `WalletProvider` auto-creates a `SolanaMobileWalletAdapter` instance
3. This adapter uses the `@solana-mobile/mobile-wallet-adapter-protocol` which:
   - Fires an Android intent via `solana-wallet://` scheme
   - Phantom app receives the intent, starts a local WebSocket server on localhost
   - Web app connects to `ws://localhost:{port}/solana-wallet`
   - All communication happens over encrypted WebSocket
   - **Page stays loaded in Chrome — NO redirect, NO page reload, NO state loss**

4. `getIsSupported()` check: `window.isSecureContext && /android/i.test(navigator.userAgent)` — requires HTTPS

**Critical: the Phantom adapter itself does NOT fire the browse deep link on Android.** The `isIosAndRedirectable()` check only returns true on iOS. On Android, the MWA path handles everything.

### What the user sees on Android

- Click "Phantom" → Android switches to Phantom app briefly (intent fires)
- Phantom shows connection approval screen
- User approves → Chrome returns to foreground, WebSocket established
- Page is exactly as they left it — modal still open, state preserved
- Later: click "Sign" → Phantom app opens again with transaction details
- User approves → Chrome returns, transaction signed

### The MWA WebSocket flow (from actual source code)

```
1. startSession() called
2. getAssociateAndroidIntentURL() builds: solana-wallet://v1/associate/local?association={key}&port={port}
3. launchAssociation() calls window.location.assign(url) — triggers Android intent
4. getDetectionPromise() waits for browser "blur" event (wallet app opened) or 3s timeout (not found)
5. connectWebSocket() connects to ws://localhost:{port}/solana-wallet
6. ECDH key exchange over WebSocket (encrypted channel)
7. authorize() sends auth request → wallet shows approval → returns pubkey + authToken
8. All subsequent operations (sign, signAndSend) go over the same WebSocket
```

### Error states on Android

- Phantom not installed → `blur` event never fires → 3s timeout → `ERROR_WALLET_NOT_FOUND`
- User rejects → wallet sends rejection response over WebSocket
- Chrome kills background tab → WebSocket connection lost → reconnect needed
- Non-HTTPS page → `ERROR_SECURE_CONTEXT_REQUIRED` (our Vercel deployment is HTTPS, so this is fine)

### Android steps for LASTPROOF proof flow

```
Step 1: Select wallet (Phantom selected)
Step 2: Connect — click "CONNECT WALLET" → Android intent → Phantom app → approve → back to Chrome
Step 3: Path select (collab/dev)
Step 4: Comment (140 char)
Step 5: Token select (LASTSHFT/SOL/USDT)
Step 6: Eligibility stream (SSE)
Step 7: Review + live price
Step 8: Sign — Android intent → Phantom app → approve transaction → back to Chrome
Step 9: Outcome (confirmed/failed)
```

**Total: 9 screens (same as desktop — MWA preserves page state)**

---

## 4. Mobile Flow — iOS

### How it works (from adapter source code)

1. **Detection**: Constructor calls `isIosAndRedirectable()` which checks for `iphone|ipad` + `safari` in user agent. If true → `readyState = Loadable`.

2. **Connect**: `connect()` checks `readyState === Loadable` → fires browse deep link:
   ```
   window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`
   ```
   This navigates away from the page entirely. The current page is gone.

3. **Re-entry**: Phantom opens, loads the URL in its in-app browser. Inside the in-app browser:
   - `window.phantom.solana` is injected
   - `readyState` becomes `Installed` (detected via polling)
   - The page loads fresh — all React state is lost
   - `autoConnect()` reads `walletName` from localStorage (within Phantom's browser context) → if set, calls `connect()` automatically

4. **Important**: `autoConnect` is DISABLED on iOS when `readyState === Loadable` (the adapter's `autoConnect()` method explicitly skips Loadable state). But once inside the in-app browser, `readyState = Installed`, so autoConnect WILL fire if the WalletProvider has `autoConnect={true}`.

**Our WalletProvider has `autoConnect={false}` (set in provider.tsx line 59).** This means after the bounce, the user must manually click connect again inside Phantom's browser.

### What the user sees on iOS

- Click "Phantom" → page navigates away → Phantom app opens → page loads in Phantom's in-app browser
- Page loads fresh (new React render, no state) — user sees the profile page, NOT the proof modal
- User must click "VERIFY THIS WORK" again → modal opens → Phantom shows as DETECTED
- User clicks "Phantom" → connect popup inside in-app browser → approve
- Flow continues from step 3 onward

### The bounce problem on iOS

The browse deep link causes a full page navigation. All state is lost:
- Modal was open → now closed
- Wallet was selected → forgotten
- Path was picked → forgotten

**Solution**: Encode state into URL query params before the bounce. When the page reloads inside Phantom's browser, read params and auto-restore the modal.

### iOS steps for LASTPROOF proof flow

```
Step 1: Select wallet (Phantom selected)
Step 2: Deep link fires → Phantom app opens → page loads in Phantom's in-app browser
Step 3: Page detects Phantom in-app browser → auto-opens proof modal → shows "CONNECT WALLET"
Step 4: Connect — click "CONNECT WALLET" → in-app browser popup → approve
Step 5: Path select (collab/dev)
Step 6: Comment (140 char)
Step 7: Token select (LASTSHFT/SOL/USDT)
Step 8: Eligibility stream (SSE)
Step 9: Review + live price
Step 10: Sign — in-app browser popup → approve transaction
Step 11: Outcome (confirmed/failed)
```

**Total: 11 screens (2 extra for bounce + re-entry connect)**

**NOTE**: Steps 2-3 happen automatically from the user's perspective (they just see Phantom open and the page load). But the code path is different enough that these need their own screen files for debugging.

---

## 5. Differences From Current Code

| Area | Current code | What should be |
|------|-------------|----------------|
| **Detection** | Custom `detectWalletEnvironment()` checks `window.phantom?.solana?.connect` | Should let the adapter handle it — adapter already has `isIosAndRedirectable()` and `scopePollingDetectionStrategy()` |
| **Android mobile** | Custom deep-link rendering | Should use MWA (adapter handles it via `SolanaMobileWalletAdapter`) — NO deep links needed |
| **iOS mobile** | Same deep-link code as Android | Should handle the bounce properly — URL state persistence + auto-restore |
| **autoConnect** | Set to `false` in provider.tsx | Correct for the explicit proof flow. But after iOS bounce, user must manually click connect |
| **Signing** | Uses `adapter.signTransaction()` | Correct — backend builds tx, client signs, backend broadcasts |

---

## 6. Maintenance & Updates

**How often Phantom changes things**: Phantom updates their extension ~monthly. Deep link formats have been stable since 2022. MWA protocol is versioned (v1). The adapter package follows semver.

**What to watch for**:
- Phantom adapter version updates in `@solana/wallet-adapter-phantom` — check changelogs for breaking changes
- Phantom deprecating `signTransaction()` in favor of `signAndSendTransaction()` (they already recommend the latter but both work)
- iOS universal link behavior changes in Safari/iOS updates
- MWA protocol version changes (currently v1)

**Update frequency**: Check quarterly. Phantom's deep link format hasn't changed in 3+ years.

---

## 7. Emergency Debug Plan

### Desktop: Phantom extension not connecting
1. Check `window.phantom?.solana?.isPhantom` in browser console
2. Check `readyState` — should be `Installed`
3. Check for competing adapters (two wallets fighting for `window.solana`)
4. Verify HTTPS (required for Phantom connect)

### Android: MWA not working
1. Check `getIsSupported()` — is it Android + secure context?
2. Check Phantom app is installed and updated
3. Check `blur` event fires (wallet app opening) — if not, intent isn't reaching Phantom
4. Check WebSocket connection to localhost — may be blocked by browser or network security
5. Fallback: show the browse deep link as a manual option

### iOS: Browse deep link not opening Phantom
1. Check `isIosAndRedirectable()` — is it returning true?
2. Check Phantom app is installed
3. Universal links require the page to NOT have `target="_blank"` — verify
4. Check URL encoding — the current URL must be fully encoded
5. Fallback: show a "Copy URL and paste in Phantom" instruction

### General: Transaction signing fails
1. Check `build-tx` endpoint returns valid `tx_base64`
2. Check `expected_signer` matches connected pubkey
3. Check the quote hasn't expired
4. Check Helius RPC is responding
5. Check treasury wallet has the correct ATA for the token

---

## 8. Code Plan — Screen Files

### Desktop (9 screens)

```
src/components/proof-modal/flows/phantom/desktop/
├── PhantomDesktopFlow.tsx         ← orchestrator (step state, hook wiring)
├── Step1Select.tsx                ← "You selected Phantom" confirmation
├── Step2Connect.tsx               ← "CONNECT WALLET" button → extension popup
├── Step3Path.tsx                  ← collab/dev cards
├── Step4Comment.tsx               ← 140 char textarea
├── Step5Token.tsx                 ← LASTSHFT/SOL/USDT picker
├── Step6Eligibility.tsx           ← terminal-style SSE stream
├── Step7Review.tsx                ← review card + live price
├── Step8Sign.tsx                  ← signing ladder (build → sign → broadcast → confirm)
└── Step9Outcome.tsx               ← confirmed or failed with recovery CTAs
```

### Android Mobile (9 screens)

```
src/components/proof-modal/flows/phantom/android/
├── PhantomAndroidFlow.tsx         ← orchestrator
├── Step1Select.tsx                ← "You selected Phantom"
├── Step2Connect.tsx               ← "CONNECT WALLET" → MWA intent → Phantom app → approve → return
├── Step3Path.tsx
├── Step4Comment.tsx
├── Step5Token.tsx
├── Step6Eligibility.tsx
├── Step7Review.tsx
├── Step8Sign.tsx                  ← MWA intent → Phantom app → approve → return
└── Step9Outcome.tsx
```

### iOS Mobile (11 screens)

```
src/components/proof-modal/flows/phantom/ios/
├── PhantomIosFlow.tsx             ← orchestrator (handles bounce re-entry)
├── Step1Select.tsx                ← "You selected Phantom"
├── Step2Bounce.tsx                ← "Opening Phantom..." → fires browse deep link → page navigates away
├── Step3ReEntry.tsx               ← auto-detect in-app browser → restore modal state from URL params
├── Step4Connect.tsx               ← "CONNECT WALLET" inside Phantom's in-app browser
├── Step5Path.tsx
├── Step6Comment.tsx
├── Step7Token.tsx
├── Step8Eligibility.tsx
├── Step9Review.tsx
├── Step10Sign.tsx
└── Step11Outcome.tsx
```

---

## 9. How Phantom Deploys Proofs in Our System

The proof flow is identical regardless of platform once the wallet is connected:

1. **Eligibility** → `POST /api/proof/eligibility` with `pubkey`, `work_item_id` → SSE stream checks uniqueness, slot, balance, (dev: mint authority, deployer)
2. **Quote issued** → eligibility returns `ProofQuote` with `quote_id`, `amount`, `expires_at`
3. **Build-tx** → `POST /api/proof/build-tx` with `quote_id` → returns `tx_base64` (Solana transaction: SOL/SPL transfer + memo + reference key)
4. **Sign** → `adapter.signTransaction(Transaction.from(tx_base64))` → Phantom signs → returns signed tx
5. **Broadcast** → `POST /api/proof/broadcast` with `signed_tx_base64` → submits to Helius RPC → returns `signature`
6. **Poll** → `GET /api/proof/tx-status?signature=...` every 1s until confirmed or failed
7. **Webhook** → Helius webhook fires when treasury receives payment → `POST /api/payments/webhook` → validates amount against quote → inserts proof row with `payer_wallet` → recalculates tier
8. **UI** → proof modal shows confirmed with Solscan link → profile proof count updates on next page load

---

## 10. Testing Plan

### Desktop Test
1. Open `lastshift-lastproof.vercel.app/@lastshiftfounder` in Chrome with Phantom extension
2. Use a DIFFERENT wallet than your profile's wallet (self-proof blocked)
3. Click VERIFY THIS WORK → modal opens
4. Select Phantom → Step 2 Connect → extension popup → approve
5. Select Collaborator path → write comment → select $LASTSHFT
6. Eligibility runs → all checks pass → review shows price
7. Click Sign → extension popup → approve transaction
8. Wait for confirmation → Solscan link appears
9. Close modal → check profile: proof count incremented, new row in verifications table
10. Check Supabase: new row in `proofs` table with `payer_wallet` set

### Android Test (Samsung S25)
1. Open same URL in Chrome on Samsung
2. Click VERIFY THIS WORK → modal opens
3. Select Phantom → Step 2 Connect → Phantom app opens → approve → back to Chrome
4. Modal still open (MWA preserved state) → continue through steps 3-7
5. Click Sign → Phantom app opens → approve → back to Chrome
6. Confirmation → Solscan link → close modal → verify proof on profile

### iOS Test (if available)
1. Open same URL in Safari on iPhone
2. Select Phantom → deep link fires → Phantom app opens → page loads in Phantom browser
3. Page detects in-app browser → auto-opens modal (if URL state persistence implemented)
4. Connect → approve → continue through proof flow
5. Sign → approve → confirmation

---

## 11. Final Checklist

- [ ] Desktop: Phantom extension detected, connect works, sign works, proof recorded
- [ ] Android: MWA connect works, page state preserved, sign works, proof recorded
- [ ] iOS: Browse deep link opens Phantom, re-entry restores modal, connect works in in-app browser, sign works, proof recorded
- [ ] Self-proof blocked (same wallet as profile owner → rejected at eligibility)
- [ ] Duplicate proof blocked (same wallet + same work item → rejected at eligibility)
- [ ] Dev path: mint authority / deployer checks pass for authorized wallets
- [ ] Quote expiry handled (expired → refresh CTA shown)
- [ ] All 10 failure codes render with correct recovery CTAs
- [ ] Helius webhook fires → proof row inserted → tier recalculated
- [ ] Proof appears on public profile verifications table
