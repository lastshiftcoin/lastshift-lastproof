"use client";

/**
 * ProofModal V3 — thin modal shell.
 *
 * All step logic, wallet state, eligibility, and signing removed.
 * The modal is a backdrop + chrome (title bar, close button) that
 * delegates entirely to PasteVerifyFlow for the 6-screen flow.
 *
 * No wallet adapter. No signature request. No balance checks.
 * No eligibility pre-check. Works in any browser, on any device.
 */

import { useCallback, useEffect, useRef } from "react";
import "./proof-modal.css";
import { PasteVerifyFlow } from "./flows/paste-verify/PasteVerifyFlow";

export interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  workItemId: string;
  ticker: string;
  handle: string;
  ownerWallet: string;
}

export function ProofModal({
  open,
  onClose,
  workItemId,
  ticker,
  handle,
}: ProofModalProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  // Focus management + ESC to close
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    shellRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [open, onClose]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="pm-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-bar-title"
    >
      <div
        className="pm-shell"
        ref={shellRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-bar">
          <div className="pm-bar-left">
            <div className="pm-dots" aria-hidden="true">
              <span className="pm-dot-r" />
              <span className="pm-dot-y" />
              <span className="pm-dot-g" />
            </div>
            <span className="pm-bar-title" id="pm-bar-title">
              lastproof — verify this work
            </span>
          </div>
          <div className="pm-bar-right">
            <span className="pm-pulse" aria-hidden="true" />
            PROOF
            <button
              type="button"
              className="pm-bar-close"
              onClick={onClose}
              aria-label="Close proof modal"
            >
              CLOSE
            </button>
          </div>
        </div>

        <PasteVerifyFlow
          workItemId={workItemId}
          ticker={ticker}
          handle={handle}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
