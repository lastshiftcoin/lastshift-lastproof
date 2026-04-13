import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://lastproof.app";
const SITE_NAME = "LASTPROOF";
const TITLE = "LASTPROOF — Verified Web3 Operators. On-Chain Proof of Work.";
const DESCRIPTION =
  "Hire web3 marketers backed by real on-chain verifications. No screenshots. No trust-me DMs. Every operator proven with immutable proof of work on Solana.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | LASTPROOF",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "LASTPROOF — Verified Web3 Operators" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@lastshft",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/shiftbot-logo.png",
    apple: "/shiftbot-logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Root layout. Intentionally minimal — the marketing shell (topbar, footer,
 * SHIFTBOT strip) lives in the (marketing) route group so boot-screen style
 * pages like /grid can opt out and render their own terminal chrome.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: DESCRIPTION,
    sameAs: [
      "https://x.com/lastshft",
      "https://t.me/lastshft",
    ],
  };

  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
