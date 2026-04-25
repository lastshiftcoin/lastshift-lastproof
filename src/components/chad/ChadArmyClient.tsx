"use client";

/**
 * ChadArmyClient — thin client wrapper over InfiniteChadList that
 * defines the fetcher closure for the public army page. Server route
 * provides the initial page; this component takes over for subsequent
 * pages via /api/chads/list?type=army.
 */

import type { ChadProfileSummary } from "@/lib/chads/profile-batch";
import { InfiniteChadList } from "./InfiniteChadList";

interface Props {
  publicHandle: string;
  initialItems: ChadProfileSummary[];
  initialCursor: number | null;
}

export function ChadArmyClient({ publicHandle, initialItems, initialCursor }: Props) {
  const fetchPage = async (cursor: number) => {
    const res = await fetch(
      `/api/chads/list?type=army&handle=${encodeURIComponent(publicHandle)}&cursor=${cursor}`,
    );
    if (!res.ok) return { items: [] as ChadProfileSummary[], nextCursor: null };
    const body = (await res.json()) as { ok: boolean; items: ChadProfileSummary[]; nextCursor: number | null };
    return { items: body.items, nextCursor: body.nextCursor };
  };

  return (
    <InfiniteChadList
      initialItems={initialItems}
      initialCursor={initialCursor}
      fetchPage={fetchPage}
      emptyContext="public"
      actions="none"
    />
  );
}
