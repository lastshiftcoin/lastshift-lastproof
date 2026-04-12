"use client";

import type { ProofPath } from "../../../types";
import type { useEligibilityStream } from "../../../useEligibilityStream";

export interface Step6EligibilityProps {
  path: ProofPath;
  elig: ReturnType<typeof useEligibilityStream>["state"];
  onTryNewWallet: () => void;
  forceIneligible: boolean;
  onToggleIneligible: () => void;
}

export function Step6Eligibility({
  path,
  elig,
  onTryNewWallet,
  forceIneligible,
  onToggleIneligible,
}: Step6EligibilityProps) {
  const role = path === "dev" ? "dev" : "collaborator";
  const isIneligible = elig.status === "done" && !elig.eligible;

  return (
    <>
      <div className="pm-eyebrow">&gt; VERIFYING YOUR WALLET</div>
      <h2 className="pm-head">
        Quick <span className="pm-accent">eligibility check.</span>
      </h2>
      <p className="pm-sub">
        One wallet, one proof per project. We check that this wallet hasn&apos;t
        already proofed this project before you sign.
      </p>

      <div
        className={`pm-term${isIneligible ? " pm-fail" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="pm-term-line">
          &gt; lastproof verify --wallet F7k2…9xMp --project{" "}
          {path === "dev" ? "$LASTSHFT" : "$LASTSHFT"} --role {role}
        </div>
        {elig.checks.map((c) => {
          const cls =
            c.ok === true ? "pm-ok" : c.ok === false ? "pm-no" : "pm-neutral";
          const mark = c.ok === true ? "[✓]" : c.ok === false ? "[✗]" : "[–]";
          return (
            <div key={c.id} className={`pm-term-line ${cls}`}>
              {`  ${mark} ${c.label.padEnd(14, " ")}  ${c.detail}`}
            </div>
          );
        })}
        {elig.status === "done" && elig.eligible && (
          <div className="pm-term-line pm-done">
            &gt;{" "}
            {path === "dev"
              ? "dev wallet verified"
              : "all checks passed"}{" "}
            · ready to sign
            <span className="pm-term-cursor">█</span>
          </div>
        )}
        {elig.status === "done" && !elig.eligible && (
          <div className="pm-term-line pm-err">
            &gt; ERROR: wallet not eligible for {role} proof on this project
          </div>
        )}
        {elig.status === "error" && (
          <div className="pm-term-line pm-err">&gt; ERROR: {elig.error}</div>
        )}
      </div>

      {isIneligible && (
        <div className="pm-inel">
          <div className="pm-inel-head">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            THIS WALLET ISN&apos;T ELIGIBLE
          </div>
          <div className="pm-inel-disc">
            <span className="pm-inel-disc-dot" />
            YOU&apos;VE BEEN AUTOMATICALLY DISCONNECTED
          </div>
          <div className="pm-inel-body">
            To file a{" "}
            <b>{role === "dev" ? "DEV" : "COLLABORATOR"} proof</b>, the
            connected wallet must match at least one of the on-chain signals for
            this project:
            <ul>
              <li>
                <b>DEPLOYER</b> — signed the token mint transaction
              </li>
              <li>
                <b>MINT AUTHORITY</b> — current mint authority wallet
              </li>
              <li>
                <b>FIRST-5 HOLDER</b> — one of the first 5 holders at mint
                distribution
              </li>
              <li>
                <b>FOUNDER MULTISIG</b> — verified signer on the project
                treasury multisig <i>(v1.1)</i>
              </li>
            </ul>
            {role === "dev" ? (
              <>
                If you&apos;re a collaborator (not a dev), go back and pick the{" "}
                <b>COLLABORATOR</b> path instead.
              </>
            ) : (
              <>
                This wallet has already filed a proof on this project, or
                doesn&apos;t meet the collaborator slot rules.
              </>
            )}
          </div>
          <button
            type="button"
            className="pm-cta pm-cta-inel"
            onClick={onTryNewWallet}
          >
            &gt; TRY A NEW WALLET
          </button>
        </div>
      )}

      {process.env.NODE_ENV === "development" && (
        <button
          type="button"
          className="pm-cta-ghost"
          style={{ marginTop: 14, padding: "8px 12px", fontSize: 11 }}
          onClick={onToggleIneligible}
        >
          ⟳ TOGGLE ELIGIBILITY (DEV-ONLY) · currently{" "}
          {forceIneligible ? "INELIGIBLE" : "ELIGIBLE"}
        </button>
      )}
    </>
  );
}
