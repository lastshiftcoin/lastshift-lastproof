import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import CopyLinkButton from "./CopyLinkButton";
import { formatDisplayDate, formatReadingTime } from "@/lib/blog/format";
import {
  blogPostingJsonLd,
  breadcrumbJsonLd,
  categoryDisplayName,
  faqPageJsonLd,
  howToJsonLd,
} from "@/lib/blog/jsonld";
import { loadAllBlogPosts, loadPostBySlug } from "@/lib/blog/load";
import { pickRelated } from "@/lib/blog/related";

const SITE = "https://lastproof.app";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const posts = await loadAllBlogPosts();
  return posts.map((p) => ({ slug: p.frontmatter.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPostBySlug(slug);
  if (!post) return {};
  const f = post.frontmatter;
  return {
    title: f.meta_title,
    description: f.meta_description,
    alternates: { canonical: f.canonical_url },
    openGraph: {
      type: "article",
      title: f.meta_title,
      description: f.meta_description,
      url: f.canonical_url,
      publishedTime: post.publishedISO,
      modifiedTime: post.updatedISO,
      section: categoryDisplayName(f.category),
      tags: [f.target_keyword, categoryDisplayName(f.category)],
      images: [
        {
          url: `${SITE}${post.featuredImagePath}`,
          alt: f.featured_image_alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: f.meta_title,
      description: f.meta_description,
      images: [`${SITE}${post.featuredImagePath}`],
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = await loadPostBySlug(slug);
  if (!post) notFound();

  const posts = await loadAllBlogPosts();
  const related = pickRelated(post, posts, 3);

  const f = post.frontmatter;
  const categoryName = categoryDisplayName(f.category);
  const isUpdated = f.updated !== f.published;

  const jsonLd: unknown[] = [
    blogPostingJsonLd(post),
    breadcrumbJsonLd([
      { name: "Home", url: SITE },
      { name: "Blog", url: `${SITE}/blog` },
      { name: categoryName, url: `${SITE}/blog/category/${f.category}` },
      { name: f.title },
    ]),
  ];
  const faqLd = faqPageJsonLd(post);
  if (faqLd) jsonLd.push(faqLd);
  const howTo = howToJsonLd(post);
  if (howTo) jsonLd.push(howTo);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="lp-article-wrap">
        {/* breadcrumbs */}
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">HOME</Link>
          <span className="lp-bc-sep">/</span>
          <Link href="/blog">BLOG</Link>
          <span className="lp-bc-sep">/</span>
          <Link href={`/blog/category/${f.category}`}>
            {categoryName.toUpperCase()}
          </Link>
          <span className="lp-bc-sep">/</span>
          <span className="lp-bc-current">{f.title.toUpperCase()}</span>
        </nav>

        {/* header */}
        <header className="lp-article-header">
          <div className="lp-article-meta-top">
            <span className="lp-blog-chip">{categoryName}</span>
            <span className="lp-article-date">
              PUBLISHED {formatDisplayDate(f.published)}
            </span>
            {isUpdated && (
              <span className="lp-article-updated">
                UPDATED {formatDisplayDate(f.updated)}
              </span>
            )}
            <span className="lp-article-reading-time">
              {formatReadingTime(post.readingMinutes)}
            </span>
          </div>
          <h1 className="lp-article-title">{f.title}</h1>
          <p className="lp-article-byline">
            by{" "}
            <a href={f.author_url} target="_blank" rel="noreferrer">
              {f.author}
            </a>
          </p>
        </header>

        {/* hero */}
        <div className="lp-article-hero-wrap">
          <Image
            src={post.featuredImagePath}
            alt={f.featured_image_alt}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 760px"
            className="lp-article-hero"
          />
        </div>

        {/* body */}
        <div
          className="lp-article-body"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />

        {/* FAQ — rendered separately so JSON-LD + visual output stay aligned */}
        {post.faq && post.faq.length > 0 && (
          <section className="lp-faq-section" aria-label="Frequently asked questions">
            <div className="lp-faq-heading">// FAQ</div>
            {post.faq.map((entry, i) => (
              <div key={i} className="lp-faq-item">
                <h3 className="lp-faq-q">{entry.question}</h3>
                <p className="lp-faq-a">{entry.answer}</p>
              </div>
            ))}
          </section>
        )}

        {/* share row */}
        <div className="lp-share-row">
          <span className="lp-share-label">Share this post</span>
          <div className="lp-share-buttons">
            <a
              className="lp-share-btn"
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(f.canonical_url)}&text=${encodeURIComponent(f.title)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Share on X"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X
            </a>
            <a
              className="lp-share-btn"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(f.canonical_url)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Share on LinkedIn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
            <CopyLinkButton url={f.canonical_url} />
          </div>
        </div>
      </article>

      {/* related */}
      {related.length > 0 && (
        <section className="lp-related-section">
          <div className="lp-related-header">
            <div className="lp-related-title">// Related</div>
          </div>
          <div className="lp-related-grid">
            {related.map((p) => (
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
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className="lp-post-card-img"
                  />
                </div>
                <div className="lp-post-card-meta">
                  <span className="lp-blog-chip">
                    {categoryDisplayName(p.frontmatter.category)}
                  </span>
                </div>
                <h3 className="lp-post-card-title">{p.frontmatter.title}</h3>
                <p className="lp-post-card-excerpt">{p.frontmatter.excerpt}</p>
                <div className="lp-post-card-footer">
                  <span>{formatDisplayDate(p.frontmatter.published)}</span>
                  <span className="lp-read-link">&gt; READ</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

