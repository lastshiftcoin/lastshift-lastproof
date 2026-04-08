import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wireframes folder is a sibling reference; exclude from build.
  pageExtensions: ["ts", "tsx"],
  // Public profile URLs are /@handle but Next reserves @folder as
  // parallel-route syntax, so we rewrite to a real folder internally.
  async rewrites() {
    return [
      { source: "/@:handle", destination: "/_profile/:handle" },
    ];
  },
};

export default nextConfig;
