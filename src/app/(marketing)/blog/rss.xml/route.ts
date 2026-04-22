import { loadAllBlogPosts } from "@/lib/blog/load";

const SITE = "https://lastproof.app";
const FEED_URL = `${SITE}/blog/rss.xml`;
const FEED_TITLE = "LASTPROOF Blog";
const FEED_DESCRIPTION =
  "Hiring, pay, and proof for web3 operators and the people who hire them.";

export const dynamic = "force-static";
export const revalidate = false;

/**
 * RSS 2.0 feed at /blog/rss.xml.
 *
 * Contains the excerpt (not the full body) per lock — drives
 * click-throughs to the site rather than giving readers the full
 * article in their RSS client.
 */
export async function GET() {
  const posts = await loadAllBlogPosts();
  const xml = renderFeed(posts);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function renderFeed(posts: Awaited<ReturnType<typeof loadAllBlogPosts>>): string {
  const lastBuild = posts[0]
    ? new Date(posts[0].publishedISO).toUTCString()
    : new Date().toUTCString();

  const items = posts
    .map((p) => {
      const pubDate = new Date(p.publishedISO).toUTCString();
      const f = p.frontmatter;
      return `
    <item>
      <title>${escapeXml(f.title)}</title>
      <link>${escapeXml(f.canonical_url)}</link>
      <guid isPermaLink="true">${escapeXml(f.canonical_url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(f.category)}</category>
      <description>${escapeXml(f.excerpt)}</description>
    </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE}/blog</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>${items}
  </channel>
</rss>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
