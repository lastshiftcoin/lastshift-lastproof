"use client";

const COMMENT_MAX = 140;

export interface Step4CommentProps {
  comment: string;
  onChange: (s: string) => void;
  tooLong: boolean;
  ticker: string;
}

function ProjCard({ ticker }: { ticker: string }) {
  return (
    <div className="pm-proj-card">
      <div className="pm-proj-ticker">{ticker}</div>
      <div className="pm-proj-meta">
        <div className="pm-proj-role">COLLABORATOR</div>
        <div className="pm-proj-dates">PROJECT PROOF</div>
      </div>
      <div className="pm-proj-tags">
        <span className="pm-proj-tag pm-proj-tag-current">CURRENT</span>
      </div>
    </div>
  );
}

export function Step4Comment({
  comment,
  onChange,
  tooLong,
  ticker,
}: Step4CommentProps) {
  const remaining = COMMENT_MAX - comment.length;
  return (
    <>
      <div className="pm-eyebrow">&gt; LEAVE A RECEIPT</div>
      <h2 className="pm-head">
        Say what you <span className="pm-accent">shipped.</span>
      </h2>
      <p className="pm-sub">
        One line lives on the public profile next to this proof. Optional — but
        operators with receipts convert better.
      </p>

      <ProjCard ticker={ticker} />

      <div className="pm-field">
        <label className="pm-field-key" htmlFor="pm-comment-input">
          RECEIPT
          <span className={`pm-char-count${tooLong ? " pm-over" : ""}`}>
            {remaining} / {COMMENT_MAX}
          </span>
        </label>
        <textarea
          id="pm-comment-input"
          className="pm-comment"
          placeholder="e.g. Shipped the meme engine with them — 40k impressions in week 1."
          value={comment}
          onChange={(e) => onChange(e.target.value)}
          maxLength={COMMENT_MAX + 20}
        />
      </div>
      <div className="pm-field-help">
        OPTIONAL · NO URLS · NO EMOJI SPAM · ELIGIBILITY IS RUNNING IN THE
        BACKGROUND
      </div>
    </>
  );
}
