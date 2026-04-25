"use client";

/**
 * InfiniteChadList — wraps a list of ChadCards with cursor-based
 * infinite scroll via IntersectionObserver on the last card.
 *
 * Empty response from the fetcher = end of list; observer goes idle.
 * Concurrent-fetch guard prevents double-append on fast scroll.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChadProfileSummary } from "@/lib/chads/profile-batch";
import { ChadCard } from "./ChadCard";
import { ChadEmptyState } from "./ChadEmptyState";

interface Props {
  initialItems: ChadProfileSummary[];
  initialCursor: number | null;
  /** Fetcher receives the cursor and returns the next page + cursor. */
  fetchPage: (cursor: number) => Promise<{ items: ChadProfileSummary[]; nextCursor: number | null }>;
  /** Empty state context — passes through to ChadEmptyState. */
  emptyContext: "public" | "dashboard";
  /** Per-card action variant; defaults to "none" (public army view). */
  actions?: "none" | "accept-deny" | "remove";
  status?: "pending" | "accepted";
  onAction?: (handle: string, action: "accept" | "deny" | "remove") => Promise<void>;
}

export function InfiniteChadList({
  initialItems,
  initialCursor,
  fetchPage,
  emptyContext,
  actions = "none",
  status,
  onAction,
}: Props) {
  const [items, setItems] = useState<ChadProfileSummary[]>(initialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [done, setDone] = useState<boolean>(initialCursor === null);
  const fetching = useRef<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (fetching.current || done || cursor === null) return;
    fetching.current = true;
    try {
      const page = await fetchPage(cursor);
      if (page.items.length === 0) {
        setDone(true);
      } else {
        setItems((prev) => prev.concat(page.items));
      }
      if (page.nextCursor === null) setDone(true);
      setCursor(page.nextCursor);
    } finally {
      fetching.current = false;
    }
  }, [cursor, done, fetchPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) loadMore();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done]);

  if (items.length === 0) {
    return <ChadEmptyState context={emptyContext} />;
  }

  return (
    <div className="chad-list">
      {items.map((chad) => (
        <ChadCard
          key={chad.wallet}
          chad={chad}
          actions={actions}
          status={status}
          onAction={onAction ? (a) => onAction(chad.handle, a) : undefined}
        />
      ))}
      {!done && <div ref={sentinelRef} className="chad-list-sentinel" aria-hidden="true" />}
    </div>
  );
}
