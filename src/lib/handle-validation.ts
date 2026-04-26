/**
 * Handle validation — single source of truth for what handles users can pick.
 *
 * Called server-side from every endpoint that creates or changes a handle:
 *   - src/app/api/onboarding/route.ts          (initial handle claim)
 *   - src/app/api/dashboard/handle-change/route.ts (rename, gated by 90d cooldown)
 *
 * Three rules, applied in order. First failure wins.
 *
 *   1. Founder-name spoof guard
 *      Reject any handle within Levenshtein-distance 2 of `lastshiftfounder`
 *      after normalization (lowercase, strip non-alphanum, leetspeak →
 *      letters). Catches:
 *          lastshiftfoundr, lastshfitfounder, 1astshiftfounder,
 *          last5hiftfounder, lastshiftfound3r, lastshiftfounderr, ...
 *
 *   2. Reserved brand terms
 *      Reject any handle that contains a known LASTSHIFT-ecosystem
 *      product name as a substring. Path A enforcement: brand
 *      substrings are never allowed in user handles, regardless of
 *      surrounding context. This makes the `lastproofscam` /
 *      `fucklastshift` class of attacks structurally impossible
 *      because the brand substring itself is the trigger — no
 *      sentiment-pair logic needed.
 *
 *   3. Profanity
 *      Reject any handle that contains a hardcore-profanity term as
 *      a substring. List is intentionally narrow — only obvious
 *      slurs and vulgarities. Web3 culture is bawdy; we don't want
 *      to block mild-edge handles like `bigass` or `hellrider`.
 *
 * Normalization for all three checks:
 *   - Lowercase
 *   - Strip non-alphanumeric (`_`, hyphens, dots, etc.)
 *   - Leetspeak substitution: 0→o, 1→i, 3→e, 4→a, 5→s
 *
 * Leetspeak inversion is deliberate. Without it, attackers trivially
 * bypass with `last5hift` or `f5ck`. With it, the most common evasion
 * patterns collapse back into the canonical form before the check.
 *
 * What this validator does NOT do:
 *   - Format check (`^[a-z0-9_]{3,20}$`) — callers do that first; this
 *     module assumes input passes the format check (we still re-check
 *     defensively).
 *   - Uniqueness check — that's a DB query, callers handle it.
 *   - 90-day cooldown — `lib/handle-cooldown.ts` handles that.
 *
 * User-facing error message is intentionally vague — no leak of the
 * specific rule that fired, no support contact path. Per Kellen's
 * 2026-04-25 spec: the system runs on its own, no customer support.
 */

const FOUNDER_HANDLE = "lastshiftfounder";
const FOUNDER_DISTANCE_THRESHOLD = 2;

/**
 * Reserved LASTSHIFT-ecosystem product names. Any handle containing
 * one of these as a normalized substring is rejected.
 *
 * Add new product names here when launching new tools.
 */
const RESERVED_BRAND_TERMS: readonly string[] = [
  "lastshift",
  "lastproof",
  "lastshft",
  "shiftbot",
  "shiftagent",
  "shiftcourse",
  "shiftmail",
  "shiftraid",
  "lasttrade",
  "agenticsocial",
];

/**
 * Hardcore-profanity terms. Intentionally narrow — only obvious
 * slurs and vulgarities. Substring match after normalization, so
 * `fucker`, `shitlord`, `slutface` all match.
 *
 * Calibrated to avoid common-word false positives:
 *   - `fuck`  — no common-English false positives at this length
 *   - `shit`  — no false positives
 *   - `cunt`  — `Cunningham` is c-u-n-n, not c-u-n-t (safe)
 *   - `nigger` — full word, no false positives
 *   - `faggot` — full word, won't match `fag` alone (we don't list `fag`)
 *   - `retard` — full word
 *   - `whore` — no false positives
 *   - `slut`  — no common-English false positives
 */
const PROFANITY_TERMS: readonly string[] = [
  "fuck",
  "shit",
  "cunt",
  "nigger",
  "faggot",
  "retard",
  "whore",
  "slut",
];

export interface HandleValidationResult {
  ok: boolean;
  /**
   * Internal reason code for logs / observability. Never shown to users.
   * One of: 'invalid_format', 'founder_spoof', 'reserved_brand',
   * 'profanity'.
   */
  reason?: "invalid_format" | "founder_spoof" | "reserved_brand" | "profanity";
}

/**
 * User-facing rejection message. Always identical regardless of which
 * specific rule fired — by design (don't tell attackers which rule
 * blocked them; they'd just keep tweaking until they slip past).
 */
export const HANDLE_REJECTION_MESSAGE =
  "Handle is not acceptable. Please try again.";

/**
 * Run the full validation pipeline. Returns `{ ok: true }` if the
 * handle is acceptable, `{ ok: false, reason }` otherwise.
 */
export function validateHandle(candidate: string): HandleValidationResult {
  const lowered = candidate.toLowerCase().trim();

  // Format guard — defense-in-depth; callers already enforce
  if (!/^[a-z0-9_]{3,20}$/.test(lowered)) {
    return { ok: false, reason: "invalid_format" };
  }

  const normalized = leetNormalize(stripNonAlphanum(lowered));

  // 1. Founder spoof check
  const founderDistance = levenshtein(normalized, FOUNDER_HANDLE);
  if (founderDistance <= FOUNDER_DISTANCE_THRESHOLD) {
    return { ok: false, reason: "founder_spoof" };
  }

  // 2. Reserved brand-term check
  for (const term of RESERVED_BRAND_TERMS) {
    if (normalized.includes(term)) {
      return { ok: false, reason: "reserved_brand" };
    }
  }

  // 3. Profanity check
  for (const term of PROFANITY_TERMS) {
    if (normalized.includes(term)) {
      return { ok: false, reason: "profanity" };
    }
  }

  return { ok: true };
}

// ─── helpers ────────────────────────────────────────────────────────────

function stripNonAlphanum(s: string): string {
  return s.replace(/[^a-z0-9]/g, "");
}

/** Normalize common leetspeak substitutions back to letters. */
function leetNormalize(s: string): string {
  return s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s");
}

/**
 * Iterative Levenshtein distance. O(m·n) time, O(min(m,n)) space.
 * Standard textbook impl — no surprises, no dependencies.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev, dp[j], dp[j - 1]) + 1;
      }
      prev = tmp;
    }
  }
  return dp[n];
}
