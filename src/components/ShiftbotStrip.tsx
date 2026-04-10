"use client";

import { useState, useRef } from "react";
import { usePathname } from "next/navigation";

const AUTO_RESPONSE =
  "The Grid is not available until May 2026. Until then, there isn\u2019t anything I can help you with. However, I look forward to our next conversation to help you find the right operator.";

/**
 * Fixed-bottom SHIFTBOT command strip. Appears on every page per the wireframes.
 * Pre-Grid: expands to a simple input that returns a canned auto-response.
 * Hidden on /manage routes which render their own terminal chrome bottom bar.
 */
export default function ShiftbotStrip() {
  const pathname = usePathname() || "";
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [replied, setReplied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (pathname.startsWith("/manage")) return null;

  const handleExpand = () => {
    setExpanded(true);
    setReplied(false);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setReplied(true);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setReplied(false);
    setQuery("");
  };

  if (!expanded) {
    return (
      <div className="shiftbot" onClick={handleExpand} style={{ cursor: "pointer" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-mini-logo" />
        <div className="label">SHIFTBOT</div>
        <div className="cursor">&gt;</div>
        <div className="ph">
          ask anything — &ldquo;help me find a raider&rdquo;, &ldquo;who&rsquo;s the best X Spaces host?&rdquo;
        </div>
        <button type="button" className="expand">
          [ EXPAND ↑ ]
        </button>
      </div>
    );
  }

  return (
    <div className="shiftbot shiftbot-expanded">
      <div className="sb-expanded-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-mini-logo" />
        <div className="label">SHIFTBOT</div>
        <span className="sb-status">PRE-LAUNCH</span>
        <button type="button" className="expand" onClick={handleCollapse}>
          [ COLLAPSE ↓ ]
        </button>
      </div>

      {replied && (
        <div className="sb-reply">
          <div className="sb-reply-label">
            <span className="cursor">&gt;</span> SHIFTBOT
          </div>
          <p>{AUTO_RESPONSE}</p>
        </div>
      )}

      <form className="sb-input-row" onSubmit={handleSubmit}>
        <span className="cursor">&gt;</span>
        <input
          ref={inputRef}
          className="sb-text-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (replied) setReplied(false);
          }}
          placeholder="ask shiftbot anything..."
        />
        <button type="submit" className="sb-send">ASK →</button>
      </form>
    </div>
  );
}
