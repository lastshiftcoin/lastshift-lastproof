/**
 * Helius Enhanced Webhook — typed payload + replay guard.
 *
 * Companion to `helius-verify.ts` (which does the constant-time
 * Authorization-header compare). This file adds:
 *
 *   1. Canonical TypeScript types for the Enhanced webhook shape,
 *      verified against primary docs (see docs/research/HELIUS-WEBHOOK-VERIFICATION.md).
 *   2. A `findReferenceInEvent` helper that pulls every pubkey
 *      referenced in any instruction — which is exactly where Solana
 *      Pay reference keys live.
 *   3. A lightweight in-process replay guard. Helius auth is a static
 *      Authorization header with NO HMAC and NO timestamp, so we must
 *      protect ourselves from replay by deduping on tx signature
 *      within a sliding window. (Idempotency via the payments store
 *      already dedupes confirmed rows; this catches the narrower
 *      window of "same signature re-POSTed before row is committed".)
 *
 * IMPORTANT: the instructions[].accounts shape below is the ENHANCED
 * mode shape (array of base58 pubkey strings). Raw mode uses numeric
 * indices and would break every parser downstream. The webhook MUST
 * be created with `"webhookType": "enhanced"`.
 */

export interface HeliusNativeTransferV1 {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // lamports
}

export interface HeliusTokenTransferV1 {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number; // UI-scaled by Helius
  mint: string;
}

export interface HeliusInstructionV1 {
  /** ENHANCED-mode: base58 pubkey strings. RAW-mode would be number[]. */
  accounts: string[];
  programId: string;
  data: string;
  innerInstructions?: HeliusInstructionV1[];
}

export interface HeliusEnhancedEvent {
  signature: string;
  feePayer: string;
  timestamp: number; // seconds
  slot?: number;
  fee?: number;
  nativeTransfers?: HeliusNativeTransferV1[];
  tokenTransfers?: HeliusTokenTransferV1[];
  instructions?: HeliusInstructionV1[];
  transactionError?: unknown;
  type?: string;
  source?: string;
  description?: string;
}

/**
 * Runtime type guard — cheap, non-exhaustive, catches the Enhanced-vs-Raw
 * foot-gun. If accounts is numeric the webhook was misconfigured.
 */
export function isEnhancedEvent(ev: unknown): ev is HeliusEnhancedEvent {
  if (!ev || typeof ev !== "object") return false;
  const e = ev as HeliusEnhancedEvent;
  if (typeof e.signature !== "string") return false;
  if (typeof e.feePayer !== "string") return false;
  if (typeof e.timestamp !== "number") return false;
  if (e.instructions && e.instructions.length > 0) {
    const first = e.instructions[0];
    if (!Array.isArray(first.accounts)) return false;
    if (first.accounts.length > 0 && typeof first.accounts[0] !== "string") {
      return false; // raw mode — numeric indices
    }
  }
  return true;
}

/**
 * Walk every instruction + inner instruction and collect the full set
 * of pubkeys. Solana Pay references are included as read-only, non-signer
 * account keys on the transfer instruction, so this set is the lookup
 * space for reference resolution.
 */
export function collectReferencedKeys(ev: HeliusEnhancedEvent): Set<string> {
  const keys = new Set<string>();
  const walk = (ix: HeliusInstructionV1) => {
    for (const acc of ix.accounts) keys.add(acc);
    for (const inner of ix.innerInstructions ?? []) walk(inner);
  };
  for (const ix of ev.instructions ?? []) walk(ix);
  return keys;
}

// ─── Replay guard ───────────────────────────────────────────────────────────

const REPLAY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Hard cap so a Helius burst (or an adversarial flood) cannot grow the
 * replay map without bound. When we exceed the cap we evict the oldest
 * half in one pass — O(n log n) once per overflow, O(1) amortized.
 */
const REPLAY_MAX_ENTRIES = 10_000;
const seen = new Map<string, number>(); // signature → ts (insertion order = age)

function evictExpired(now: number): void {
  for (const [sig, ts] of seen) {
    if (now - ts <= REPLAY_WINDOW_MS) break; // Map preserves insertion order
    seen.delete(sig);
  }
}

function evictToHalf(): void {
  const target = Math.floor(REPLAY_MAX_ENTRIES / 2);
  let toRemove = seen.size - target;
  for (const sig of seen.keys()) {
    if (toRemove-- <= 0) break;
    seen.delete(sig);
  }
}

export function markSeen(signature: string, now: number = Date.now()): boolean {
  evictExpired(now);
  if (seen.has(signature)) return false; // replay
  if (seen.size >= REPLAY_MAX_ENTRIES) evictToHalf();
  seen.set(signature, now);
  return true;
}

export function __resetReplayGuard(): void {
  seen.clear();
}
