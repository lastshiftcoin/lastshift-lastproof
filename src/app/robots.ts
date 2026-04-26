import type { MetadataRoute } from "next";

/**
 * /robots.txt — crawl directives for lastproof.app.
 *
 * Disallowed:
 *   /manage/    — authenticated dashboard, not useful to crawlers
 *   /api/       — backend endpoints, no SEO value
 *   /auth/      — transient OAuth callback pages (X, Telegram return URLs)
 *   /5k/        — private ambassador reports + god-ops admin
 *   /operators  — Grid feed during Stage 1 iteration (Phase 2 build).
 *                 Removed at Stage 4 / Grid launch (2026-05-08). Belt-and-
 *                 suspenders alongside per-page `robots: { index: false }`.
 *
 * Everything else is open. Sitemap at /sitemap.xml enumerates every
 * canonical public URL worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/manage/", "/api/", "/auth/", "/5k/", "/operators"],
      },
    ],
    sitemap: "https://lastproof.app/sitemap.xml",
  };
}
