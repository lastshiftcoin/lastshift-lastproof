"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard share button. Client component — everything else
 * on the article page is server-rendered.
 */
export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op on browsers that reject clipboard (rare); user can select URL manually
    }
  };

  return (
    <button
      type="button"
      className="lp-share-btn"
      onClick={handle}
      aria-label="Copy link"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}
