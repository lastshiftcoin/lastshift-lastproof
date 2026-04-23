"use client";

/**
 * Telegram Login Widget callback page on lastproof.app.
 *
 * The widget's data-auth-url points here. Telegram redirects with the
 * signed user data as query parameters:
 *   /auth/telegram/callback?id=...&first_name=...&username=...&auth_date=...&hash=...
 *
 * This page:
 *   1. Reads the query params
 *   2. POSTs them to /api/auth/telegram/callback for HMAC verification
 *   3. On success, redirects to /manage/profile?verified=tg
 *   4. On failure, redirects with verify_error
 */

import { useEffect, useState } from "react";

export default function TelegramCallbackPage() {
  const [message, setMessage] = useState("VERIFYING TELEGRAM...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      data[key] = value;
    }

    if (!data.id || !data.hash || !data.auth_date) {
      window.location.href =
        "/manage/profile?verify_error=tg&reason=missing_params";
      return;
    }

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
