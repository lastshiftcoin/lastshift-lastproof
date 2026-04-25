"use client";

/**
 * ChadCard — list-tile component used in the public army page and the
 * dashboard chads page.
 *
 * Action variants:
 *   - "none"        — public army page; the whole tile is a link to /@<handle>
 *   - "accept-deny" — dashboard pending row; two buttons stacked on the right
 *   - "remove"      — dashboard accepted row; single REMOVE button on the right
 *
 * For action variants, the name+avatar region is a separate link that opens
 * the chad's public profile in a new tab — clicking the action buttons does
 * NOT bubble into the link region (e.stopPropagation in handlers).
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
  const statusModifier = status === "pending" ? " pending" : "";

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
        {actions === "remove" && (
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
