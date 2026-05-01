import type { Metadata } from "next";
import Script from "next/script";
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
    site: "@lastshiftai",
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
  // Sitewide Organization schema. Per LASTSHIFT_Brand_Entity_Reference v1.0:
  // - LASTPROOF is a child of LASTSHIFT.AI (the parent dev org)
  // - Canonical X handles are @lastshiftai (company) + @LASTSHIFTCOIN (token)
  // - The "@lastshft" handle that lived here previously was incorrect
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/shiftbot-logo.png`,
    description:
      "Web3 operator verification platform built on Solana. First tool in the LASTSHIFT Terminal ecosystem developed by LASTSHIFT.AI.",
    parentOrganization: {
      "@type": "Organization",
      name: "LASTSHIFT.AI",
      url: "https://lastshift.ai",
      description:
        "Pseudonymous software developer building the LASTSHIFT Terminal — an AI tool platform for web3 operators on Solana.",
    },
    sameAs: [
      "https://lastshift.ai",
      "https://lastshiftcoin.com",
      "https://lastshift.app",
      "https://x.com/lastshiftai",
      "https://x.com/LASTSHIFTCOIN",
      "https://t.me/LastShiftCoin",
      "https://t.me/LastShiftCoinBreakroom",
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
      <body>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1ECRRM3LXB"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-1ECRRM3LXB');`}
        </Script>
        {children}
      </body>
    </html>
  );
}
