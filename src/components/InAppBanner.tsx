"use client";

import { useState, useEffect } from "react";

/**
 * Detects in-app browsers (Telegram, Instagram, Twitter/X, Discord, Facebook,
 * Line, Snapchat, etc.) and shows a banner prompting the user to open in their
 * default browser. Wallet extensions aren't available in WebViews.
 */
export default function InAppBanner() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const inApp =
      /Telegram|Instagram|FBAN|FBAV|Twitter|Line\/|Snapchat|Discord|LinkedInApp/i.test(ua) ||
      // Generic WebView detection
      (/wv\b/i.test(ua) && /Android/i.test(ua));
    if (inApp) setShow(true);
  }, []);

  if (!show) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard API not available in some WebViews
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="inapp-banner">
      <span className="inapp-text">
        Wallet extensions aren&rsquo;t available in this browser.
        Open in your default browser to connect.
      </span>
      <button type="button" className="inapp-copy" onClick={handleCopy}>
        {copied ? "COPIED ✓" : "COPY LINK"}
      </button>
      <button
        type="button"
        className="inapp-close"
        onClick={() => setShow(false)}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}
