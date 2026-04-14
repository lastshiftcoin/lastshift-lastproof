"use client";

import { useCallback, useState } from "react";

const COMMENT_MAX = 140;

/** Preloaded denial messages — factual, no detail leakage. */
const DENIAL_MESSAGES: Record<string, string> = {
  tx_not_found: "TRANSACTION NOT FOUND ON SOLANA",
  tx_failed_onchain: "TRANSACTION FAILED ON-CHAIN",
  wrong_recipient: "PAYMENT NOT SENT TO LASTPROOF TREASURY",
  amount_too_low: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_too_high: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  amount_not_found: "AMOUNT DOES NOT MATCH REQUIRED PAYMENT",
  tx_before_session: "Nice try. Scamming will die in web3. Support your friend and purchase a proof for them.",
  self_proof: "PROFILE OWNER CANNOT VERIFY THEIR OWN WORK",
  dev_not_qualified: "WALLET NOT QUALIFIED FOR DEV VERIFICATION",
  rpc_error: "VERIFICATION INTERRUPTED — TRY AGAIN",
  config_error: "SYSTEM CONFIGURATION ERROR — CONTACT SUPPORT",
  network: "FAILED TO REACH SERVER — CHECK YOUR CONNECTION",
};

export interface Screen4PasteProps {
  comment: string;
  onCommentChange: (c: string) => void;
  onSubmit: (signature: string) => void;
  failureCheck: string | null;
  failureDetail: string | null;
  failureAttempt: number;
  onTryAgain: () => void;
}

export function Screen4Paste({
  comment,
  onCommentChange,
  onSubmit,
  failureCheck,
  failureDetail,
  failureAttempt,
  onTryAgain,
}: Screen4PasteProps) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    await onSubmit(trimmed);
    setSubmitting(false);
  }, [input, submitting, onSubmit]);

  const showFailure = failureCheck !== null;

  return (
    <>
      <div className="pm-eyebrow">&gt; VERIFY YOUR PAYMENT</div>
      <h2 className="pm-head">
        Paste your <span className="pm-accent">transaction.</span>
      </h2>

      {showFailure && (
        <div className="pm-notice" style={{
          marginBottom: 14,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--pm-red, #ef4444)",
          borderLeft: "2px solid var(--pm-red, #ef4444)",
          background: "rgba(239,68,68,0.05)",
        }}>
          <strong>&gt; ✕ {DENIAL_MESSAGES[failureCheck] ?? failureDetail ?? "VERIFICATION FAILED"}</strong>
        </div>
      )}

      <div className="pm-field">
        <label className="pm-field-key" htmlFor="pm-sig-input">
          TRANSACTION SIGNATURE
        </label>
        <textarea
          id="pm-sig-input"
          className="pm-comment"
          placeholder="Paste Solscan URL or transaction signature…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="url"
          style={{ minHeight: 56, fontSize: 11 }}
        />
      </div>
      <div className="pm-field-help">
        SOLSCAN · SOLANA EXPLORER · SOLANA.FM · RAW SIGNATURE
      </div>

      <div className="pm-field" style={{ marginTop: 12 }}>
        <label className="pm-field-key" htmlFor="pm-comment-input">
          ADD A NOTE <span style={{ opacity: 0.5 }}>(OPTIONAL)</span>
        </label>
        <textarea
          id="pm-comment-input"
          className="pm-comment"
          placeholder="What did you do on this project?"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          style={{ minHeight: 48, fontSize: 11 }}
        />
        <div className="pm-field-help" style={{ textAlign: "right" }}>
          {comment.length}/{COMMENT_MAX}
        </div>
      </div>

      <div className="pm-cta-bar" style={{ marginTop: 14, padding: 0, border: 0 }}>
        <button
          type="button"
          className="pm-cta"
          disabled={!input.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "> SUBMITTING…" : "> SUBMIT"}
        </button>
      </div>

      {/* Tier 2: Deep Verify (attempt 2) */}
      {showFailure && failureAttempt === 2 && (
        <div className="pm-field-help" style={{ marginTop: 6 }}>
          NEXT SUBMIT RUNS ADDITIONAL CHECKS INCLUDING INNER INSTRUCTIONS
        </div>
      )}

      {/* Tier 3: Support Ticket (attempt 3+) */}
      {showFailure && failureAttempt >= 3 && (
        <div style={{ marginTop: 12 }}>
          <a
            className="pm-cta-ghost"
            style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "8px 12px", fontSize: 11 }}
            href={`mailto:reportclaims@lastshift.ai?subject=Proof%20Verification%20Failed%20—%20${encodeURIComponent(failureCheck ?? "unknown")}&body=${encodeURIComponent(`Check: ${failureCheck}\nDetail: ${failureDetail}\nAttempts: ${failureAttempt}`)}`}
          >
            &gt; OPEN SUPPORT TICKET
          </a>
          <p className="pm-sub" style={{ marginTop: 8, textAlign: "center" }}>
            If you believe this transaction is valid, our team will review it manually.
          </p>
        </div>
      )}
    </>
  );
}
