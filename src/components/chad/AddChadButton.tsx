"use client";

/**
 * AddChadButton — the static `+` pill on the public profile.
 *
 * Same render for every viewer, regardless of wallet or relationship
 * state (per locked decision — keeps the public profile cacheable and
 * wallet-agnostic). Clicking opens the AddChadModal which owns the
 * 10-phase state machine.
 */

import { useState } from "react";
import { AddChadModal } from "./AddChadModal";

interface Props {
  /** The handle of the profile being viewed (the chad-request target). */
  targetHandle: string;
}

export function AddChadButton({ targetHandle }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-add-chad"
        onClick={() => setOpen(true)}
        aria-label="Add chad"
        data-tip="Add Chad"
      >
        +
      </button>
      {open && (
        <AddChadModal targetHandle={targetHandle} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
