"use client";

import { useState } from "react";

export function StatsCopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `lastproof.app/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`https://${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = `https://${url}`;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  }

  return (
    <div className="af-share-section">
      <div className="af-share-label">YOUR REFERRAL LINK</div>
      <div className="af-share-box">
        <span className="af-share-url">{url}</span>
        <button
          type="button"
          className={`af-share-copy${copied ? " copied" : ""}`}
          onClick={handleCopy}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
    </div>
  );
}
