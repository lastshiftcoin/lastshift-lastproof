"use client";

/**
 * Mobile Telegram OAuth callback handler.
 *
 * Used when the bridge on lastshift.ai can't use postMessage — typically
 * on mobile after Telegram's auth flow hands off to the Telegram app and
 * returns in a fresh browser context (no window.opener).
 *
 * The bridge falls back to redirecting here with a hash fragment:
 *   /auth/telegram/callback#tgAuthResult=BASE64_JSON
 *
 * This page:
 *   1. Reads the #tgAuthResult fragment (never sent to server)
 *   2. Decodes the base64 JSON payload (Telegram user data)
 *   3. POSTs to /api/auth/telegram/callback for HMAC verification
 *   4. Redirects to /manage/profile with success/error state
 */

import { useEffect, useState } from "react";

export default function TelegramCallbackPage() {
  const [message, setMessage] = useState("VERIFYING TELEGRAM...");

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#tgAuthResult=(.+)$/);

    if (!match) {
      window.location.href =
        "/manage/profile?verify_error=tg&reason=missing_params";
      return;
    }

    let data: Record<string, unknown>;
    try {
      const decoded = atob(match[1]);
      data = JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      window.location.href =
        "/manage/profile?verify_error=tg&reason=decode_error";
      return;
    }

    // POST to the real callback for HMAC verify + DB write
    fetch("/api/auth/telegram/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(async (r) => {
        const res = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (r.ok && res.ok) {
          window.location.href = "/manage/profile?verified=tg";
        } else {
          const reason = res.error ?? "unknown";
          window.location.href = `/manage/profile?verify_error=tg&reason=${encodeURIComponent(reason)}`;
        }
      })
      .catch(() => {
        setMessage("NETWORK ERROR");
        setTimeout(() => {
          window.location.href =
            "/manage/profile?verify_error=tg&reason=network_error";
        }, 1500);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0b0f",
        color: "#8b8fa3",
        fontFamily: "var(--mono, monospace)",
        fontSize: 12,
        letterSpacing: 1,
      }}
    >
      {message}
    </div>
  );
}
