"use client";

/**
 * AddChadButton — the static `+` pill on the public profile.
 *
 * Same render for every viewer, regardless of wallet or relationship
 * state (per locked decision — keeps the public profile cacheable and
 * wallet-agnostic). Clicking opens the AddChadModal which owns the
 * full 10-phase state machine including in-modal wallet connect.
 *
 * Target preview props (display name + avatar) are passed in from the
 * profile page (which already has them) so the modal's connect screen
 * can show "you're about to chad <name>" before any API call.
 */

import { useState } from "react";
import { AddChadModal } from "./AddChadModal";

interface Props {
  targetHandle: string;
  targetDisplayName: string;
  targetAvatarUrl: string | null;
}

export function AddChadButton({
  targetHandle,
  targetDisplayName,
  targetAvatarUrl,
}: Props) {
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
        <AddChadModal
          targetHandle={targetHandle}
          targetDisplayName={targetDisplayName}
          targetAvatarUrl={targetAvatarUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
