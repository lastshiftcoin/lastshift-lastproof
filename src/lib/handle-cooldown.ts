/**
 * Handle change cooldown check — pure. 90-day window between successful
 * handle changes. Publish-time handle-set does NOT count as a change
 * (only subsequent paid changes count).
 */

import { HANDLE_CHANGE_COOLDOWN_DAYS } from "./pricing";
import { lastHandleChange } from "./handle-history-store";

export interface CooldownResult {
  eligible: boolean;
  lastChangedAt: string | null;
  nextEligibleAt: string | null;
  daysRemaining: number;
}

export function checkHandleCooldown(profileId: string, now: Date = new Date()): CooldownResult {
  const last = lastHandleChange(profileId);
  if (!last) {
    return { eligible: true, lastChangedAt: null, nextEligibleAt: null, daysRemaining: 0 };
  }
  const lastMs = new Date(last.changedAt).getTime();
  const cooldownMs = HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const nextMs = lastMs + cooldownMs;
  if (now.getTime() >= nextMs) {
    return {
      eligible: true,
      lastChangedAt: last.changedAt,
      nextEligibleAt: new Date(nextMs).toISOString(),
      daysRemaining: 0,
    };
  }
  const daysRemaining = Math.ceil((nextMs - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    eligible: false,
    lastChangedAt: last.changedAt,
    nextEligibleAt: new Date(nextMs).toISOString(),
    daysRemaining,
  };
}
