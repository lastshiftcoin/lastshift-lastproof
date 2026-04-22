import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDisplayDate } from "@/lib/blog/format";
import {
  breadcrumbJsonLd,
  categoryDisplayName,
  categoryH1,
  categorySubtitle,
  collectionPageJsonLd,
} from "@/lib/blog/jsonld";
import { loadPostsByCategory } from "@/lib/blog/load";
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/blog/types";

const SITE = "https://lastproof.app";

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return BLOG_CATEGORIES.map((c) => ({ category: c }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!BLOG_CATEGORIES.includes(category as BlogCategory)) return {};
  const cat = category as BlogCategory;
  const name = categoryDisplayName(cat);
  const url = `${SITE}/blog/category/${cat}`;
  const description = categorySubtitle(cat);
  return {
    title: `${name} · Blog`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: `${name} · LASTPROOF Blog`,
      description,
      url,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · LASTPROOF Blog`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category } = await params;
  if (!BLOG_CATEGORIES.includes(category as BlogCategory)) notFound();

  const cat = category as BlogCategory;
  const posts = await loadPostsByCategory(cat);
  const name = categoryDisplayName(cat);
  const url = `${SITE}/blog/category/${cat}`;

  const jsonLd = [
    collectionPageJsonLd({
      url,
      name: `${name} · LASTPROOF Blog`,
      description: categorySubtitle(cat),
      posts,
    }),
    breadcrumbJsonLd([
      { name: "Home", url: SITE },
      { name: "Blog", url: `${SITE}/blog` },
      { name },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="lp-blog-page-header">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">HOME</Link>
          <span className="lp-bc-sep">/</span>
          <Link href="/blog">BLOG</Link>
          <span className="lp-bc-sep">/</span>
          <span className="lp-bc-current">{name.toUpperCase()}</span>
        </nav>
        <div className="lp-blog-section-label">// blog · {cat}</div>
        <h1 className="lp-blog-page-title">{categoryH1(cat)}</h1>
        <p className="lp-blog-page-sub">{categorySubtitle(cat)}</p>
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
