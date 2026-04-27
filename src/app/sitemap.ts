import type { MetadataRoute } from "next";
import { supabaseService } from "@/lib/db/client";
import { blogSitemapEntries } from "@/lib/blog/sitemap-entries";

/**
 * /sitemap.xml — full crawl surface for lastproof.app.
 *
 * Listed here:
 *   • Static marketing pages (home, how-it-works, help, status, earlyaccess, grid)
 *   • Every published+paid operator profile at /@handle (public profile route)
 *   • Every active ambassador campaign landing page at /<campaign_slug>
 *
 * NOT listed (intentionally blocked from indexing via robots.ts):
 *   • /manage/* — authenticated dashboard
 *   • /api/*   — backend routes
 *   • /auth/*  — transient OAuth callback pages
 *   • /5k/*    — private ambassador reports + god-ops admin
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://lastproof.app";
  const now = new Date();

  // ─── Static pages ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                     lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/operators`,      lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/grid`,           lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/how-it-works`,   lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/help`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/earlyaccess`,    lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/status`,         lastModified: now, changeFrequency: "daily",   priority: 0.5 },
    { url: `${base}/status/all`,     lastModified: now, changeFrequency: "weekly",  priority: 0.4 },
  ];

  const sb = supabaseService();

  // ─── Published operator profiles: /@handle ─────────────────────────
  // Profile is "published" when published_at IS NOT NULL (there is no
  // is_published boolean column; published_at is the canonical signal).
  // Must also be paid — free profiles render the stripped-down variant
  // that isn't canonical content worth indexing.
  const { data: profiles } = await sb
    .from("profiles")
    .select("handle, updated_at")
    .not("published_at", "is", null)
    .eq("is_paid", true);

  const profilePages: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${base}/@${p.handle}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // ─── Ambassador campaign landing pages: /<campaign_slug> ───────────
  // These render via src/app/(landing)/[campaignSlug]/page.tsx. Each
  // active ambassador owns a unique slug routed at the root.
  const { data: ambassadors } = await sb
    .from("ambassadors")
    .select("campaign_slug")
    .eq("is_active", true);

  const campaignPages: MetadataRoute.Sitemap = (ambassadors ?? []).map((a) => ({
    url: `${base}/${a.campaign_slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // ─── Blog posts: /blog, /blog/:category, /blog/:slug, rss ──────────
  // Entries come from the blog system's own manifest — see
  // src/lib/blog/sitemap-entries.ts. Wiring is a single spread here
  // so the blog pipeline owns everything about its own crawl surface.
  const blogEntries = await blogSitemapEntries();

  return [...staticPages, ...profilePages, ...campaignPages, ...blogEntries];
}
