# HandleChangeModal — Builder Handoff

## What Needs to Change

The handle change flow currently splits across two places:
1. **Inline block in `IdentityCard.tsx`** (lines 325-433) — cooldown check, handle input, availability, validation
2. **`HandleChangeModal`** (4 screens) — payment-only flow after validation

This needs to consolidate into **one modal** that owns the entire flow.

---

## New Screen 1: Eligibility Check

First screen the user sees when the modal opens. Checks cooldown status.

### On mount (modal opens):
```
GET /api/dashboard/handle-change
→ { cooldown: { eligible: boolean, daysRemaining: number }, pricing: { baseUsd: number, lastshftUsd: number } }
```

### If `cooldown.eligible === false`:
- Show cooldown message: "Handle change on cooldown — {daysRemaining} days remaining"
- Show "Changes are limited to once every 90 days"
- No NEXT button — only CLOSE
- Use red/warning styling

### If `cooldown.eligible === true`:
- Show pricing info: "$100 base (or $60 with $LASTSHFT)"
- Show "90-day cooldown after each change"
- NEXT button enabled → proceeds to Screen 2

---

## New Screen 2: Handle Setup (styled like Onboarding)

**Match the visual style of Onboarding Step 2** (the handle claim screen). Reference:
- `src/components/dashboard/OnboardingModal.tsx` — the `step === 2` render block
- `src/components/dashboard/onboarding.css` — `.ob-handle-wrap`, `.ob-handle-prefix`, `.ob-handle-input`, `.ob-handle-status`

### UI Elements:
- `lastproof.app/` prefix + `@` symbol (like `ob-handle-prefix`)
- Handle input field (like `ob-handle-input`)
- Live availability status dot + label: CHECKING... / AVAILABLE (green) / TAKEN (red)
- Current handle shown above: "Current: @{oldHandle}"
- Debounced availability check (400ms):
  ```
  GET /api/onboarding/check-handle?handle={input}
  → { available: boolean }
  ```
- NEXT button enabled only when: `input.length >= 3 && available === true`

### On NEXT click:
```
POST /api/dashboard/handle-change
body: { newHandle: handleInput }
→ { validatedHandle: string }  (or error)
```
Error responses:
- `{ error: "cooldown_active", daysRemaining: N }` — bounce back to Screen 1
- `{ error: "handle_taken" }` — mark as taken, stay on Screen 2
- Other errors — show generic message

On success: store `validatedHandle`, proceed to Screen 3 (token select).

---

## How It Deploys (no infra changes)

This is a **client-side overlay** — same pattern as MintModal, ProofModal, OnboardingModal. No new routes, no redirect files, no `vercel.json` changes.

1. User clicks CHANGE in the URL bar → `handleChangeRequested = true`
2. `IdentityCard` sets `showHandleModal = true`
3. `HandleChangeModal` renders via `createPortal` to `document.body` as a fixed overlay
4. All API calls happen client-side (`fetch` to existing endpoints)
5. Dashboard URL stays `/manage/profile` the entire time

### After successful handle change:
- The handle change API updates `profiles.handle` in Supabase
- API returns the updated profile row
- `onSuccess` callback fires → `IdentityCard` calls `onProfileUpdate(updatedProfile)`
- `DashboardContent` re-renders with the new handle — URL bar shows `lastproof.app/@newhandle`, all profile links update
- Public profile automatically works at `/@newhandle` — the dynamic route `[handle]/page.tsx` looks up by handle in DB
- Old handle `/@oldhandle` — the `handle_history` table should have a row; verify the `[handle]` route checks for old handles and 301 redirects to the new one

### What the builder should verify:
- Does `POST /api/dashboard/handle-change` write to `handle_history` when the handle changes?
- Does `src/app/(marketing)/profile/[handle]/page.tsx` check `handle_history` for old handles and redirect?
- Does `onSuccess` receive the updated profile row to pass back up via `onProfileUpdate`?

---

## Props Change

```ts
// BEFORE
export interface HandleChangeModalProps {
  open: boolean;
  onClose: () => void;
  oldHandle: string;
  newHandle: string;        // ← required, pre-validated
  onSuccess?: () => void;
}

// AFTER
export interface HandleChangeModalProps {
  open: boolean;
  onClose: () => void;
  oldHandle: string;
  onSuccess?: () => void;
  // newHandle is no longer a prop — discovered internally via Screen 1
}
```

---

## Screen Count Update

| Screen | Before | After |
|--------|--------|-------|
| 1 | Token select | **Eligibility check** (NEW) |
| 2 | Send payment | **Handle setup** (NEW — styled like onboarding) |
| 3 | Paste TX | Token select |
| 4 | Outcome | Send payment |
| 5 | — | Paste TX |
| 6 | — | Outcome |

Update `HcStep` type: `type HcStep = 1 | 2 | 3 | 4 | 5 | 6;`

---

## IdentityCard Cleanup (after modal is updated)

Once the modal owns Screen 1, delete from `IdentityCard.tsx`:
- All handle change state (lines 124-137): `handleInput`, `handleAvailable`, `handleChecking`, `handleCooldown`, `handlePricing`, `handleChanging`, `showPaymentModal`, `validatedHandle`, `handleCheckTimer`
- Helper functions: `openHandleModal()`, `onHandleInputChange()`, `executeHandleChange()`
- The inline JSX block (lines 325-433)
- The old `showPaymentModal` HandleChangeModal render (lines 584-594)

Replace `openHandleModal()` call in the useEffect with just `setShowHandleModal(true)`.

The CHANGE button trigger from `DashboardContent.tsx` stays as-is — it sets `handleChangeRequested`, which IdentityCard passes through to open the modal.

---

## Files

| File | Action |
|------|--------|
| `src/components/handle-change-modal/HandleChangeModal.tsx` | Add Screens 1-2, update props, shift screen numbers |
| `src/components/handle-change-modal/handle-change-modal.css` | Add styles for eligibility + handle setup screens |
| `src/components/dashboard/IdentityCard.tsx` | Delete inline block + dead state after modal update |
| `src/components/dashboard/onboarding.css` | **Reference only** — Screen 2 handle input should match `ob-handle-wrap` visual style |
| `src/components/dashboard/OnboardingModal.tsx` | **Reference only** — `step === 2` block shows the handle claim pattern to copy |

---

## Cooldown Reset (for testing)

The founder account is currently on cooldown (89 days remaining). To reset for testing:

```sql
DELETE FROM handle_history
WHERE wallet_address = '<founder-wallet-address>';
```

Run in Supabase SQL Editor.
