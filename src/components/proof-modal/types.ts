/**
 * Proof modal contract types.
 *
 * Locked against docs/PROOF-MODAL-SPEC-REPLY.md (commit 797d1b9).
 * Any drift here means the spec reply doc has changed and we need to
 * reconcile. When in doubt, the reply doc wins.
 */

export type ProofPath = "collab" | "dev";

export type ProofToken = "lastshft" | "sol" | "usdt";

export type ProofStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Tri-state. true=pass, false=fail, null=aspirational/neutral (v1 founder).
 * See reply §3–4 — FE must render null as grey `[–]` with no pulse.
 */
export type CheckOk = true | false | null;

export interface CheckRow {
  id:
    | "uniqueness"
    | "slot"
    | "balance"
    | "mint_authority"
    | "deployer"
    | "founder";
  label: string;
  ok: CheckOk;
  detail: string;
}

export interface ProofQuote {
  token: ProofToken;
  amount_ui: number;
  amount_raw: string;
  usd: number;
  usd_rate: number;
  quote_id: string;
  expires_at: string;
}

/** SSE event schema from reply §5. */
export type EligibilityEvent =
  | { type: "start"; quote_id: string; path: ProofPath; mint: string; pubkey: string }
  | { type: "check"; check: CheckRow }
  | {
      type: "done";
      eligible: true;
      quote: ProofQuote;
    }
  | {
      type: "done";
      eligible: false;
      reason: string;
      failed_checks: string[];
    };

/** Stream state for FE consumption. */
export interface EligibilityState {
  status: "idle" | "streaming" | "done" | "error";
  checks: CheckRow[];
  eligible: boolean | null;
  quote: ProofQuote | null;
  failedChecks: string[];
  error: string | null;
}

/** Full enum from reply §8, used for step 8 failure branching (Q22). */
export type FailureReason =
  | "user_rejected"
  | "insufficient_balance"
  | "blockhash_expired"
  | "tx_reverted"
  | "rpc_degraded"
  | "quote_expired_hard"
  | "lock_lost"
  | "dev_slot_taken"
  | "signature_invalid"
  | "unknown";
