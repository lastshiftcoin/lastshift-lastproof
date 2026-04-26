"use client";

/**
 * ChadCard — list-tile component used in the public army page and the
 * dashboard chads page.
 *
 * Action variants:
 *   - "none"        — public army page; the whole tile is a link to /@<handle>
 *   - "accept-deny" — dashboard pending row (incoming ask); two buttons
 *                     stacked on the right
 *   - "remove"      — dashboard outgoing row. If the row's effective status
 *                     is "accepted", renders a REMOVE button. If status
 *                     is "pending" (an outgoing ask the user sent that
 *                     hasn't been responded to), renders a non-interactive
 *                     ASK PENDING caption in the action slot — view-state
 *                     only, per locked design (no Cancel button v1).
 *
 * Effective status: chad.status (per-row) takes precedence over the
 * status prop. Lets a single list mix pending + accepted cards (the
 * dashboard outgoing view) while keeping all-pending or all-accepted
 * lists working via the prop.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ChadProfileSummary } from "@/lib/chads/profile-batch";
import { ChadAvatar, initialsForHandle } from "./ChadAvatar";
import { capDisplayName, capHandle } from "@/lib/chads/format";

type Actions = "none" | "accept-deny" | "remove";

interface Props {
  chad: ChadProfileSummary;
  actions?: Actions;
  status?: "pending" | "accepted";
  onAction?: (action: "accept" | "deny" | "remove") => Promise<void>;
}

export function ChadCard({ chad, actions = "none", status, onAction }: Props) {
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (removed) return null;

  const tier = chad.tier;
  const initials = initialsForHandle(chad.displayName || chad.handle);
  const profileHref = `/@${chad.handle}`;
  // Per-row status (chad.status) overrides the per-list prop so a
  // single list can mix pending + accepted cards (dashboard outgoing).
  const effectiveStatus = chad.status ?? status;
  const statusModifier = effectiveStatus === "pending" ? " pending" : "";

  const callAction = (action: "accept" | "deny" | "remove") => {
    if (!onAction) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAction(action);
        setRemoved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "action_failed");
      }
    });
  };

  const meta = (
    <div className="chad-card-meta">
      <div className="chad-card-name">{capDisplayName(chad.displayName)}</div>
      <div className="chad-card-handle">@{capHandle(chad.handle)}</div>
    </div>
  );

  if (actions === "none") {
    return (
      <Link href={profileHref} className={`chad-card${statusModifier}`} data-tier={tier}>
        <ChadAvatar avatarUrl={chad.avatarUrl} initials={initials} handle={chad.handle} size={44} />
        {meta}
      </Link>
    );
  }

  return (
    <div className={`chad-card${statusModifier}`} data-tier={tier}>
      <a
        className="chad-card-link"
        href={profileHref}
        target="_blank"
        rel="noreferrer"
      >
        <ChadAvatar avatarUrl={chad.avatarUrl} initials={initials} handle={chad.handle} size={44} />
        {meta}
      </a>
      <div className="chad-card-actions">
        {actions === "accept-deny" && (
          <>
            <button
              type="button"
              className="chad-btn chad-btn-accept"
              onClick={() => callAction("accept")}
              disabled={pending}
            >
              ACCEPT
            </button>
            <button
              type="button"
              className="chad-btn chad-btn-deny"
              onClick={() => callAction("deny")}
              disabled={pending}
            >
              DENY
            </button>
          </>
        )}
        {actions === "remove" && effectiveStatus === "pending" && (
          <span className="chad-card-pending-caption">ASK PENDING</span>
        )}
        {actions === "remove" && effectiveStatus !== "pending" && (
          <button
            type="button"
            className="chad-btn chad-btn-remove"
            onClick={() => callAction("remove")}
            disabled={pending}
          >
            REMOVE
          </button>
        )}
      </div>
      {error && <div className="chad-card-error">{error}</div>}
    </div>
  );
}
