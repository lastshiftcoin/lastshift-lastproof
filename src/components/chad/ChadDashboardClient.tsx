"use client";

/**
 * ChadDashboardClient — the client side of /manage/chads.
 *
 * Server provides initial pending + accepted pages; this component owns
 * subsequent fetches, accept/deny/remove handlers, and re-fetches on
 * mutation so counts stay consistent without a full reload.
 *
 * Per locked design: accept/deny/remove are instant. No confirmation,
 * no undo, no countdown. Tile is removed from the list optimistically
 * via the InfiniteChadList; a failure restores it via the inline error.
 */

import { useState } from "react";
import type { ChadProfileSummary } from "@/lib/chads/profile-batch";
import { InfiniteChadList } from "./InfiniteChadList";

interface Props {
  initialPending: ChadProfileSummary[];
  initialPendingCursor: number | null;
  initialAccepted: ChadProfileSummary[];
  initialAcceptedCursor: number | null;
  pendingCount: number;
  acceptedCount: number;
}

export function ChadDashboardClient({
  initialPending,
  initialPendingCursor,
  initialAccepted,
  initialAcceptedCursor,
  pendingCount,
  acceptedCount,
}: Props) {
  const [livePendingCount, setLivePendingCount] = useState(pendingCount);
  const [liveAcceptedCount, setLiveAcceptedCount] = useState(acceptedCount);

  const fetchPending = async (cursor: number) => {
    const res = await fetch(`/api/chads/list?type=pending&cursor=${cursor}`);
    if (!res.ok) return { items: [] as ChadProfileSummary[], nextCursor: null };
    const body = (await res.json()) as { ok: boolean; items: ChadProfileSummary[]; nextCursor: number | null };
    return { items: body.items, nextCursor: body.nextCursor };
  };

  const fetchAccepted = async (cursor: number) => {
    const res = await fetch(`/api/chads/list?type=accepted&cursor=${cursor}`);
    if (!res.ok) return { items: [] as ChadProfileSummary[], nextCursor: null };
    const body = (await res.json()) as { ok: boolean; items: ChadProfileSummary[]; nextCursor: number | null };
    return { items: body.items, nextCursor: body.nextCursor };
  };

  const onPendingAction = async (handle: string, action: "accept" | "deny" | "remove") => {
    if (action === "remove") return; // not used in pending list
    const res = await fetch("/api/chads/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester: handle, action }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { reason?: string } | null;
      throw new Error(body?.reason ?? "respond_failed");
    }
    setLivePendingCount((c) => Math.max(0, c - 1));
    if (action === "accept") setLiveAcceptedCount((c) => c + 1);
  };

  const onAcceptedAction = async (handle: string, action: "accept" | "deny" | "remove") => {
    if (action !== "remove") return;
    const res = await fetch("/api/chads/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chad: handle }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { reason?: string } | null;
      throw new Error(body?.reason ?? "remove_failed");
    }
    setLiveAcceptedCount((c) => Math.max(0, c - 1));
  };

  return (
    <>
      <div className="chad-dash-summary">
        <div className="chad-dash-summary-line chad-dash-summary-pending">
          <span className="chad-dash-dot" /> Pending Asks ({livePendingCount})
          <span className="chad-dash-summary-note">operators who want you in their Chad Army</span>
        </div>
        <div className="chad-dash-summary-line">
          <span className="chad-dash-dot chad-dash-dot-neutral" /> Your Chad Army ({liveAcceptedCount})
          <span className="chad-dash-summary-note">operators you've added who accepted</span>
        </div>
      </div>

      {(livePendingCount > 0 || initialPending.length > 0) && (
        <InfiniteChadList
          initialItems={initialPending}
          initialCursor={initialPendingCursor}
          fetchPage={fetchPending}
          emptyContext="dashboard"
          actions="accept-deny"
          status="pending"
          onAction={onPendingAction}
        />
      )}

      <InfiniteChadList
        initialItems={initialAccepted}
        initialCursor={initialAcceptedCursor}
        fetchPage={fetchAccepted}
        emptyContext="dashboard"
        actions="remove"
        status="accepted"
        onAction={onAcceptedAction}
      />
    </>
  );
}
