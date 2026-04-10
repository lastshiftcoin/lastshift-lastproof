"use client";

/**
 * VerifiedCard — X and Telegram verification for the blue checkmark.
 *
 * Wireframe: lastproof-dashboard.html, GET VERIFIED section.
 *
 * - Blue checkmark badge (locked when incomplete, active when both linked)
 * - X / Twitter row: CONNECT or shows @handle + DISCONNECT
 * - Telegram row: CONNECT or shows @handle + DISCONNECT
 * - Progress bar: 0%, 50%, or 100% based on links
 *
 * Connect/disconnect are stubs for now — actual OAuth flows are a future step.
 * Telegram handle is required for the HIRE button on public profiles.
 */

import type { ProfileRow } from "@/lib/profiles-store";

interface VerifiedCardProps {
  profile: ProfileRow;
}

export function VerifiedCard({ profile }: VerifiedCardProps) {
  const xLinked = !!profile.xHandle && profile.xVerified;
  const tgLinked = !!profile.tgHandle && profile.tgVerified;
  const bothLinked = xLinked && tgLinked;
  const progressPct = (xLinked ? 50 : 0) + (tgLinked ? 50 : 0);

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">GET VERIFIED</div>
      </div>

      {/* Badge + copy */}
      <div className="verify-wrap">
        <div className={`verify-badge${bothLinked ? "" : " locked"}`}>
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M60 6 L74 16 L91 14 L96 31 L110 41 L104 58 L110 75 L96 85 L91 102 L74 100 L60 110 L46 100 L29 102 L24 85 L10 75 L16 58 L10 41 L24 31 L29 14 L46 16 Z"
              fill="#409eff"
              stroke="#7eb8ff"
              strokeWidth="1.5"
            />
          </svg>
          <span className="check">{"\u2713"}</span>
        </div>
        <div className="verify-copy">
          <div className="verify-headline">
            Earn the <span className="blue">blue checkmark</span>
          </div>
          <div className="verify-sub">
            Link X and Telegram to unlock the badge. Telegram is required for the HIRE button.
          </div>
          <div className="verify-progress">
            <div className="verify-bar">
              <div className="verify-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Platform rows */}
      <div className="verify-rows">
        {/* X / Twitter */}
        <div className={`verify-row${xLinked ? " linked" : ""}`}>
          <div className="vr-icon x">{"\ud835\udd4f"}</div>
          <div className="vr-meta">
            <div className="vr-name">X / Twitter</div>
            <div className={`vr-handle${xLinked ? " connected" : ""}`}>
              {xLinked ? `@${profile.xHandle}` : "not connected"}
            </div>
          </div>
          <button
            type="button"
            className={`vr-action${xLinked ? " disconnect" : " connect"}`}
            onClick={() => {
              // TODO: OAuth flow for X
              alert(xLinked ? "X disconnect coming soon" : "X OAuth connect coming soon");
            }}
          >
            {xLinked ? "DISCONNECT" : "CONNECT"}
          </button>
        </div>

        {/* Telegram */}
        <div className={`verify-row${tgLinked ? " linked" : ""}`}>
          <div className="vr-icon tg">T</div>
          <div className="vr-meta">
            <div className="vr-name">Telegram</div>
            <div className={`vr-handle${tgLinked ? " connected" : ""}`}>
              {tgLinked ? `@${profile.tgHandle}` : "required for HIRE button"}
            </div>
          </div>
          <button
            type="button"
            className={`vr-action${tgLinked ? " disconnect" : " connect"}`}
            onClick={() => {
              // TODO: Telegram widget / deeplink
              alert(tgLinked ? "Telegram disconnect coming soon" : "Telegram connect coming soon");
            }}
          >
            {tgLinked ? "DISCONNECT" : "CONNECT"}
          </button>
        </div>
      </div>
    </div>
  );
}
