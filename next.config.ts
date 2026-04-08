import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wireframes folder is a sibling reference; exclude from build.
  pageExtensions: ["ts", "tsx"],
};

export default nextConfig;
