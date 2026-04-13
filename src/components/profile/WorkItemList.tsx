"use client";

import { useState } from "react";
import type { WorkItem } from "@/lib/public-profile-view";
import { WorkItemCard } from "./WorkItemCard";

const INITIAL_LIMIT = 6;

export function WorkItemList({
  items,
  handle,
  ownerWallet,
  sectionLabel,
  sectionClass,
}: {
  items: WorkItem[];
  handle: string;
  ownerWallet: string;
  sectionLabel: string;
  sectionClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_LIMIT);
  const hasMore = items.length > INITIAL_LIMIT && !expanded;
  const remaining = items.length - INITIAL_LIMIT;

  if (items.length === 0) return null;

  return (
    <>
      <div className={`pp-pow-section-label${sectionClass ? ` ${sectionClass}` : ""}`}>
        {sectionLabel}
      </div>
      {visible.map((w) => (
        <WorkItemCard key={w.id} item={w} handle={handle} ownerWallet={ownerWallet} />
      ))}
      {hasMore && (
        <button
          type="button"
          className="pp-pow-archive"
          onClick={() => setExpanded(true)}
        >
          SEE {remaining} MORE PROJECTS →
        </button>
      )}
    </>
  );
}
