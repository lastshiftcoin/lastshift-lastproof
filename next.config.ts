import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wireframes folder is a sibling reference; exclude from build.
  pageExtensions: ["ts", "tsx"],
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
