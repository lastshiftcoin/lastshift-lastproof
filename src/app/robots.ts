import type { MetadataRoute } from "next";

/**
 * /robots.txt — crawl directives for lastproof.app.
 *
 * Disallowed:
 *   /manage/    — authenticated dashboard, not useful to crawlers
 *   /api/       — backend endpoints, no SEO value
 *   /auth/      — transient OAuth callback pages (X, Telegram return URLs)
 *   /5k/        — private ambassador reports + god-ops admin
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
        disallow: ["/manage/", "/api/", "/auth/", "/5k/"],
      },
    ],
    sitemap: "https://lastproof.app/sitemap.xml",
  };
}
