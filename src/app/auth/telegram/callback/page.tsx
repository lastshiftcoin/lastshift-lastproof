"use client";

/**
 * Client-side Telegram OAuth callback handler.
 *
 * Telegram's oauth.telegram.org/auth returns data as a URL hash fragment:
 *   /auth/telegram/callback#tgAuthResult=BASE64_ENCODED_JSON
 *
 * Hash fragments never reach the server, so this client page:
 * 1. Reads the #tgAuthResult fragment
 * 2. Decodes the base64 JSON payload (contains id, first_name, username, hash, auth_date, etc.)
 * 3. Redirects to the real server callback with the data as query parameters
 *
 * The server callback at /api/auth/telegram/callback then validates the HMAC
 * hash and writes the verified handle to the DB.
 */

import { useEffect } from "react";

export default function TelegramCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash;

    // Telegram appends #tgAuthResult=BASE64 to the return_to URL
    const match = hash.match(/^#tgAuthResult=(.+)$/);

    if (!match) {
      // No tgAuthResult — redirect to dashboard with error
      window.location.href = "/manage/profile?verify_error=tg&reason=missing_params";
      return;
    }

    try {
      // Decode base64 payload → JSON with Telegram user data
      const decoded = atob(match[1]);
      const data = JSON.parse(decoded) as Record<string, string | number>;

      // Build query string with all Telegram params (id, first_name, username, hash, auth_date, etc.)
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        params.set(key, String(value));
      }

      // Forward to the real server callback as query params
      window.location.href = `/api/auth/telegram/callback?${params.toString()}`;
    } catch {
      window.location.href = "/manage/profile?verify_error=tg&reason=decode_error";
    }
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
      VERIFYING TELEGRAM...
    </div>
  );
}
