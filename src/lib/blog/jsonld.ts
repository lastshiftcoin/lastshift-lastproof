import type { BlogCategory, BlogPost } from "./types";

const SITE = "https://lastproof.app";
const ORG_NAME = "LASTPROOF";
const ORG_LOGO = `${SITE}/shiftbot-logo.png`;

/**
 * JSON-LD builders for /blog surfaces.
 *
 * All functions return plain objects. Pages serialize with
 * JSON.stringify inside a <script type="application/ld+json">.
 */

// ─── WebSite (emitted on /blog index) ───────────────────────────────

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORG_NAME,
    url: SITE,
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: { "@type": "ImageObject", url: ORG_LOGO },
    },
  };
}

// ─── CollectionPage + ItemList ──────────────────────────────────────

export function collectionPageJsonLd(opts: {
  url: string;
  name: string;
  description: string;
  posts: BlogPost[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: opts.url,
    description: opts.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: opts.posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: p.frontmatter.canonical_url,
      })),
    },
  };
}

// ─── BreadcrumbList ─────────────────────────────────────────────────

export function breadcrumbJsonLd(
  items: Array<{ name: string; url?: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => {
      const item: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
      };
      if (it.url) item.item = it.url;
      return item;
    }),
  };
}

// ─── BlogPosting (article page) ─────────────────────────────────────

export function blogPostingJsonLd(post: BlogPost) {
  const { frontmatter } = post;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontmatter.title,
    description: frontmatter.meta_description,
    image: `${SITE}${post.featuredImagePath}`,
    datePublished: post.publishedISO,
    dateModified: post.updatedISO,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": frontmatter.canonical_url,
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: { "@type": "ImageObject", url: ORG_LOGO },
    },
    author: {
      "@type": "Person",
      name: frontmatter.author,
      url: frontmatter.author_url,
    },
    articleSection: categoryDisplayName(frontmatter.category),
    keywords: frontmatter.target_keyword,
  };
}

// ─── FAQPage ────────────────────────────────────────────────────────

export function faqPageJsonLd(post: BlogPost) {
  if (!post.faq || post.faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

// ─── HowTo (pre-authored per article) ───────────────────────────────

export function howToJsonLd(post: BlogPost) {
  return post.howToJsonLd ?? null;
}

// ─── helpers ────────────────────────────────────────────────────────

export function categoryDisplayName(category: BlogCategory): string {
  return category === "operators" ? "Operators" : "Builders";
}

export function categoryH1(category: BlogCategory): string {
  return category === "operators" ? "for operators" : "for builders";
}

export function categorySubtitle(category: BlogCategory): string {
  return category === "operators"
    ? "pay, hiring, and how to get found without a referral."
    : "hiring marketers, vetting kols, and not getting rugged on work.";
}

export function blogIndexH1(): string {
  return "the blog";
}

export function blogIndexSubtitle(): string {
  return "hiring, pay, and proof for web3 operators and the people who hire them.";
}
