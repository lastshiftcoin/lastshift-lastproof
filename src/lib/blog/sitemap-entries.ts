import type { MetadataRoute } from "next";

import { loadAllBlogPosts } from "./load";

const SITE = "https://lastproof.app";

/**
 * Sitemap entries for every /blog route.
 *
 * Exposed as a standalone function so `src/app/sitemap.ts` can import
 * and spread into the global sitemap with a one-line change:
 *
 *   import { blogSitemapEntries } from "@/lib/blog/sitemap-entries";
 *   // inside default export:
 *   const blogEntries = await blogSitemapEntries();
 *   return [...staticPages, ...profilePages, ...campaignPages, ...blogEntries];
 *
 * The blog system owns its manifest; the coordinator only needs to
 * wire it into the global sitemap once.
 */
export async function blogSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const posts = await loadAllBlogPosts();
  const now = new Date();

  const latest = posts[0]
    ? new Date(posts[0].updatedISO)
    : now;

  const root: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/blog`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE}/blog/category/operators`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE}/blog/category/builders`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE}/blog/rss.xml`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const posted: MetadataRoute.Sitemap = posts.map((p) => ({
    url: p.frontmatter.canonical_url,
    lastModified: new Date(p.updatedISO),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...root, ...posted];
}
