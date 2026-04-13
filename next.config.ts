import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx"],
  async rewrites() {
    return [
      { source: "/@:handle", destination: "/profile/:handle" },
    ];
  },
  async redirects() {
    return [
      { source: "/profile/:handle", destination: "/@:handle", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "lastshiftai",
  project: "lastshift-lastproof",
  silent: !process.env.CI,
  // Source maps upload requires auth token — set SENTRY_AUTH_TOKEN in Vercel env.
  // Without it, source maps won't upload but error tracking still works.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Route browser Sentry requests through a tunnel to avoid ad blockers
  tunnelRoute: "/sentry-tunnel",
});
