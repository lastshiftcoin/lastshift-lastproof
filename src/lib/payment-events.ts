/**
 * Payment side-effect dispatcher.
 *
 * Called ONCE per payment, only on the transition pending→confirmed. The
 * webhook handler is the single caller — it holds the idempotency gate
 * (upsert by tx_signature) so this module does not re-check.
 *
 * Each handler is a stub in skeleton #2. They get wired up in later skeletons:
 *
 *   subscription     → skeleton #3 (rollover math + write profiles.subscription_expires_at)
 *   proof            → skeleton #6 (insert proofs row, recalc tier)
 *   dev_verification → skeleton #6 (insert dev_verifications row, flip is_dev, recalc tier)
 *
 * Stubs log what they WOULD do so we can see the full payment→event chain
 * end-to-end before any real DB work exists.
 */

import type { PaymentRow } from "./payments-store";
import { getProfileById, updateProfile } from "./profiles-store";
import { rolloverOnPayment, deriveState } from "./subscription";
import { recalcProfileTier } from "./tier-recalc";
import { insertProof } from "./proofs-store";
import { insertNotification } from "./notifications-store";
import { runDevPreflight } from "./dev-preflight";
import { recordHandleChange } from "./handle-history-store";
import { checkHandleCooldown } from "./handle-cooldown";
import { listProfiles } from "./profiles-store";
import { listQuotes, markQuoteExpired } from "./quotes-store";

export interface DispatchResult {
  handled: boolean;
  kind: PaymentRow["kind"];
  note: string;
}

export async function dispatchPaymentConfirmed(row: PaymentRow): Promise<DispatchResult> {
  switch (row.kind) {
    case "subscription":
      return await handleSubscription(row);
    case "proof":
      return await handleProof(row);
    case "dev_verification":
      return await handleDevVerification(row);
    case "handle_change":
      return await handleHandleChange(row);
    case "mint":
      return await handleMint(row);
    default: {
      const _exhaustive: never = row.kind;
      return { handled: false, kind: row.kind, note: `unknown kind: ${_exhaustive}` };
    }
  }
}

// ─── Stubs — to be filled in by later skeletons ─────────────────────────────

async function handleSubscription(row: PaymentRow): Promise<DispatchResult> {
  // Skeleton #3: real rollover math, stub profile store.
  // Future skeletons layer on: notifications row (#4), validate cache bust (#1 wiring).
  if (!row.profileId) {
    console.warn(`[payment-events] SUBSCRIPTION missing profileId tx=${row.txSignature}`);
    return { handled: false, kind: "subscription", note: "profileId missing on payment row" };
  }
  const profile = await getProfileById(row.profileId);
  if (!profile) {
    console.warn(`[payment-events] SUBSCRIPTION profile not found id=${row.profileId} tx=${row.txSignature}`);
    return { handled: false, kind: "subscription", note: `profile ${row.profileId} not found` };
  }

  const now = new Date();
  const prevState = deriveState({ expiresAt: profile.subscriptionExpiresAt, now });
  const newExpiresAt = rolloverOnPayment({ expiresAt: profile.subscriptionExpiresAt, now });

  const updated = await updateProfile(profile.id, {
    subscriptionExpiresAt: newExpiresAt,
    subscriptionStartedAt: profile.subscriptionStartedAt ?? now.toISOString(),
    lastPaymentAt: now.toISOString(),
    isPaid: true,
  });

  const tierResult = await recalcProfileTier(profile.id, now);

  console.log(
    `[payment-events] SUBSCRIPTION confirmed — profile=${row.profileId} prev=${prevState} -> expires=${updated?.subscriptionExpiresAt} tier=${tierResult.previousTier}->${tierResult.newTier} tx=${row.txSignature}`,
  );
  return {
    handled: true,
    kind: "subscription",
    note: `${prevState} → paid; expires ${updated?.subscriptionExpiresAt}; tier ${tierResult.previousTier}→${tierResult.newTier}`,
  };
}

async function handleProof(row: PaymentRow): Promise<DispatchResult> {
  if (!row.profileId) {
    return { handled: false, kind: "proof", note: "profileId missing on payment row" };
  }
  const profile = await getProfileById(row.profileId);
  if (!profile) {
    return { handled: false, kind: "proof", note: `profile ${row.profileId} not found` };
  }

  insertProof({
    profileId: profile.id,
    workItemId: row.refId ?? null,
    kind: "proof",
    txSignature: row.txSignature,
  });

  insertNotification({
    profileId: profile.id,
    kind: "proof_received",
    body: `New proof received for work item ${row.refId ?? "(no ref)"}.`,
  });

  const tierResult = await recalcProfileTier(profile.id);
  console.log(
    `[payment-events] PROOF confirmed — profile=${profile.id} work_item=${row.refId} tier=${tierResult.previousTier}->${tierResult.newTier} tx=${row.txSignature}`,
  );
  return {
    handled: true,
    kind: "proof",
    note: `proof inserted; tier ${tierResult.previousTier}→${tierResult.newTier}`,
  };
}

async function handleHandleChange(row: PaymentRow): Promise<DispatchResult> {
  if (!row.profileId) {
    return { handled: false, kind: "handle_change", note: "profileId missing" };
  }
  const profile = await getProfileById(row.profileId);
  if (!profile) {
    return { handled: false, kind: "handle_change", note: `profile ${row.profileId} not found` };
  }

  // Cooldown re-check (defense in depth — quote-time check is the primary gate).
  const cooldown = await checkHandleCooldown(profile.id);
  if (!cooldown.eligible) {
    return {
      handled: false,
      kind: "handle_change",
      note: `cooldown_active nextEligibleAt=${cooldown.nextEligibleAt}`,
    };
  }

  // New handle comes from payment metadata via the quote's metadata.
  // In this skeleton the webhook passes it through payment row's refId.
  const newHandle = (row.refId ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,32}$/.test(newHandle)) {
    return {
      handled: false,
      kind: "handle_change",
      note: `invalid_new_handle:${newHandle}`,
    };
  }

  // Uniqueness — no other profile already owns it.
  const taken = (await listProfiles()).find((p) => p.handle === newHandle && p.id !== profile.id);
  if (taken) {
    return { handled: false, kind: "handle_change", note: `handle_taken:${newHandle}` };
  }

  // Race guard: expire any OTHER open handle_change quotes for this
  // profile. The quote route enforces single-in-flight at issue time,
  // but a TOCTOU between two near-simultaneous issue calls could slip
  // through. If a second payment later resolves to one of those stale
  // quotes, tolerance.validatePaymentAgainstQuote will reject it as
  // quote_expired rather than silently double-apply the change.
  for (const q of await listQuotes(profile.id)) {
    if (q.kind === "handle_change" && q.status === "open") {
      await markQuoteExpired(q.id);
    }
  }

  const oldHandle = profile.handle;
  await updateProfile(profile.id, { handle: newHandle });
  recordHandleChange({
    profileId: profile.id,
    oldHandle,
    newHandle,
    txSignature: row.txSignature,
  });

  insertNotification({
    profileId: profile.id,
    kind: "subscription_reactivated", // reuse slot — no dedicated enum yet
    body: `Handle changed from @${oldHandle} to @${newHandle}. Next eligible change in 90 days.`,
  });

  console.log(
    `[payment-events] HANDLE_CHANGE confirmed — profile=${profile.id} ${oldHandle}→${newHandle} tx=${row.txSignature}`,
  );
  // Recalc tier so handle_change observability matches other kinds
  // (subscription / proof / dev_verification all include a tier delta
  // in their note). Handle change does not itself move the tier, so
  // this is almost always a no-op — but returning the result in the
  // note keeps the webhook's processed[] shape uniform for logs.
  const tierResult = await recalcProfileTier(profile.id);
  return {
    handled: true,
    kind: "handle_change",
    note: `@${oldHandle} → @${newHandle}; tier ${tierResult.previousTier}→${tierResult.newTier}`,
  };
}

async function handleDevVerification(row: PaymentRow): Promise<DispatchResult> {
  if (!row.profileId) {
    return { handled: false, kind: "dev_verification", note: "profileId missing on payment row" };
  }
  const profile = await getProfileById(row.profileId);
  if (!profile) {
    return { handled: false, kind: "dev_verification", note: `profile ${row.profileId} not found` };
  }

  // Server-side preflight re-check — UI gate is advisory. If a wallet
  // paid but doesn't qualify, we REFUND-FLAG instead of granting the
  // badge. Refund machinery lands in a later skeleton; for now we mark
  // the payment as failed-by-gate via the note and do NOT insert the
  // dev_verification row.
  // Pull the token mint from the originating quote's metadata. Dev
  // verification quotes MUST carry `tokenMint` so the preflight can
  // check against the specific token; callers that omit it fall
  // through to the wallet-history stub path.
  let tokenMint: string | null = null;
  if (row.quoteId) {
    const { getQuote } = await import("./quotes-store");
    const q = await getQuote(row.quoteId);
    const mintFromMeta = q?.metadata?.tokenMint;
    if (typeof mintFromMeta === "string") tokenMint = mintFromMeta;
  }
  const pre = await runDevPreflight({
    wallet: profile.terminalWallet,
    mint: tokenMint,
  });
  if (!pre.qualified) {
    console.warn(
      `[payment-events] DEV_VERIFICATION rejected by preflight — wallet=${profile.terminalWallet} reason=${pre.reason} tx=${row.txSignature}`,
    );
    insertNotification({
      profileId: profile.id,
      kind: "dev_badge_earned",
      body: `DEV verification payment received but wallet did not pass qualification (${pre.reason}). Contact support for refund.`,
    });
    return {
      handled: false,
      kind: "dev_verification",
      note: `preflight_failed:${pre.reason}`,
    };
  }

  insertProof({
    profileId: profile.id,
    workItemId: row.refId ?? null,
    kind: "dev_verification",
    txSignature: row.txSignature,
  });

  await updateProfile(profile.id, { isDev: true });

  insertNotification({
    profileId: profile.id,
    kind: "dev_badge_earned",
    body: "DEV badge earned — your wallet passed qualification.",
  });

  const tierResult = await recalcProfileTier(profile.id);
  console.log(
    `[payment-events] DEV_VERIFICATION confirmed — profile=${profile.id} tier=${tierResult.previousTier}->${tierResult.newTier} tx=${row.txSignature}`,
  );
  return {
    handled: true,
    kind: "dev_verification",
    note: `dev badge granted; tier ${tierResult.previousTier}→${tierResult.newTier}`,
  };
}

async function handleMint(row: PaymentRow): Promise<DispatchResult> {
  // Mint payment confirmed — the work item is set to minted=true by the
  // dashboard mint endpoint after the user provides the txSignature.
  // This handler just logs the event. The actual minting flag was already
  // set optimistically by POST /api/dashboard/work-items/mint.
  console.log(
    `[payment-events] MINT confirmed — profile=${row.profileId} tx=${row.txSignature}`,
  );
  return {
    handled: true,
    kind: "mint",
    note: "mint payment confirmed",
  };
}
