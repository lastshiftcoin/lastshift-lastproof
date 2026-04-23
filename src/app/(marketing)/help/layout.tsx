import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LASTPROOF — Help",
  description:
    "LASTPROOF help center — profile creation, submitting proofs, updating your profile, and profile states (Active Paid, First 5,000, Free, Defunct). Separate from the /how-it-works marketing page.",
  openGraph: {
    title: "LASTPROOF — Help",
    description:
      "Topic-based help center: profile creation, proofs, updating your profile, profile states, FAQ. Everything you need to get unstuck.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LASTPROOF — Help",
    description:
      "Topic-based help center: profile creation, proofs, updating your profile, profile states, FAQ.",
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
