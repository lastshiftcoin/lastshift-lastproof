"use client";

import { useState } from "react";

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Props {
  handle: string;
}

/**
 * Icon-only share button — copies the profile URL to clipboard.
 * No border, no label. Renders next to the display name in ProfileHero.
 */
export function ShareIconButton({ handle }: Props) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = `${window.location.origin}/@${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <button
      type="button"
      className="pp-share-icon-btn"
      onClick={onShare}
      aria-label={copied ? "Link copied" : "Copy profile link"}
      data-tip={copied ? "Link copied" : "Copy profile link"}
      data-testid="pp-share-icon"
    >
      {copied ? CHECK_ICON : SHARE_ICON}
    </button>
  );
}
