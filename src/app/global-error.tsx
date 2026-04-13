"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0f",
          color: "#e5e7eb",
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "#ff5470",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            &gt; ERROR
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              margin: "0 0 16px",
              fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
            This error has been reported automatically. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              padding: "12px 24px",
              background: "rgba(255, 145, 0, 0.1)",
              border: "1px solid #ff9100",
              borderRadius: 6,
              color: "#ff9100",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            RELOAD PAGE
          </button>
        </div>
      </body>
    </html>
  );
}
