import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LASTPROOF — The Trusted Web3 Marketers",
  description:
    "Every operator backed by real on-chain verifications. No screenshots. No trust-me DMs. Just proof.",
};

/**
 * Root layout. Intentionally minimal — the marketing shell (topbar, footer,
 * SHIFTBOT strip) lives in the (marketing) route group so boot-screen style
 * pages like /grid can opt out and render their own terminal chrome.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
