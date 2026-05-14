import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wireframes folder is a sibling reference; exclude from build.
  pageExtensions: ["ts", "tsx"],
  // Avatars (and other user-uploaded images) live in Supabase Storage.
  // Routing them through Next.js Image gets auto-resize, WebP/AVIF, and
  // edge caching — Grid cards drop from ~11MB total transfer to ~50KB.
  // Wildcard host covers any Supabase project (dev/staging/prod).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Public profile URLs are /@handle but Next reserves @folder as
  // parallel-route syntax, so we rewrite to a real folder internally.
  async rewrites() {
    return [
      { source: "/@:handle", destination: "/profile/:handle" },
      { source: "/@:handle/chads", destination: "/profile/:handle/chads" },
    ];
  },
  async redirects() {
    return [
      // If someone hits /profile/@handle directly, redirect to /@handle
      { source: "/profile/:handle", destination: "/@:handle", permanent: true },
      { source: "/profile/:handle/chads", destination: "/@:handle/chads", permanent: true },
    ];
  },
};

export default nextConfig;
