import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatDisplayDate } from "@/lib/blog/format";
import {
  blogIndexH1,
  blogIndexSubtitle,
  categoryDisplayName,
  collectionPageJsonLd,
  websiteJsonLd,
} from "@/lib/blog/jsonld";
import { loadAllBlogPosts } from "@/lib/blog/load";

const SITE = "https://lastproof.app";
const URL = `${SITE}/blog`;
const TITLE = "Blog";
const DESCRIPTION = blogIndexSubtitle();

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: "website",
    title: `${TITLE} · LASTPROOF`,
    description: DESCRIPTION,
    url: URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · LASTPROOF`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default async function BlogIndexPage() {
  const posts = await loadAllBlogPosts();

  const jsonLd = [
    websiteJsonLd(),
    collectionPageJsonLd({
      url: URL,
      name: "LASTPROOF Blog",
      description: DESCRIPTION,
      posts,
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="lp-blog-page-header">
        <div className="lp-blog-section-label">// blog</div>
        <h1 className="lp-blog-page-title">{blogIndexH1()}</h1>
        <p className="lp-blog-page-sub">{DESCRIPTION}</p>
      </section>

      <section className="lp-blog-grid">
        {posts.map((p) => (
          <Link
            key={p.frontmatter.slug}
            href={`/blog/${p.frontmatter.slug}`}
            className="lp-post-card"
          >
            <div className="lp-post-card-img-wrap">
              <Image
                src={p.featuredImagePath}
                alt={p.frontmatter.featured_image_alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="lp-post-card-img"
              />
            </div>
            <div className="lp-post-card-meta">
              <span className="lp-blog-chip">
                {categoryDisplayName(p.frontmatter.category)}
              </span>
              <span className="lp-blog-tag">
                #{p.frontmatter.target_keyword.split(" ").slice(0, 1).join("")}
              </span>
            </div>
            <h2 className="lp-post-card-title">{p.frontmatter.title}</h2>
            <p className="lp-post-card-excerpt">{p.frontmatter.excerpt}</p>
            <div className="lp-post-card-footer">
              <span>{formatDisplayDate(p.frontmatter.published)}</span>
              <span className="lp-read-link">&gt; READ</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
