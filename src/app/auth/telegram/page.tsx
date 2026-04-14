"use client";

/**
 * Telegram Login Widget host page on lastproof.app.
 *
 * Same-origin with the rest of the app — no bridge needed. The bot's
 * BotFather domain is set to lastproof.app, so Telegram trusts this
 * origin and the Login Widget works natively.
 *
 * Flow:
 *   1. User lands here from VerifiedCard CONNECT button
 *   2. Widget mounts, user taps "Log in as <name>"
 *   3. Telegram confirms auth, redirects via data-auth-url to
 *      /auth/telegram/callback?id=...&hash=...&auth_date=...&...
 *   4. Callback page POSTs data to /api/auth/telegram/callback
 *      for HMAC verification, then redirects to dashboard.
 */

import { useEffect, useState } from "react";

const BOT_USERNAME = "Auth_lastproof_bot";

export default function TelegramAuthPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const container = document.getElementById("tg-widget");
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", "/auth/telegram/callback");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    script.onload = () => setStatus("ready");
    script.onerror = () => setStatus("error");

    container.appendChild(script);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
        color: "#fff",
      }}
    >
      <div
        style={{
          background: "#161822",
          border: "1px solid #2a2d3f",
          borderRadius: 10,
          padding: "32px 40px",
          minWidth: 340,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1.5,
            marginBottom: 6,
            color: "#e2e4ed",
          }}
        >
          LASTPROOF VERIFICATION
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#8b8fa3",
            marginBottom: 24,
          }}
        >
          Connect your Telegram account
        </div>

        {status === "error" && (
          <div style={{ color: "#ff5470", fontSize: 11 }}>
            Telegram widget failed to load. Check your ad blocker and try again.
          </div>
        )}

        <div
          id="tg-widget"
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      </div>
    </div>
  );
}
