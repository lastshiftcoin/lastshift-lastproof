/**
 * Types for the /blog content system.
 *
 * Source of truth for the shape of a parsed blog post. Consumed by
 * `src/app/blog/*` routes, sitemap-entries, and the RSS feed.
 */

export type BlogCategory = "operators" | "builders";

export const BLOG_CATEGORIES: BlogCategory[] = ["operators", "builders"];

/**
 * Frontmatter fields declared in each `content/blog/<folder>/article.md`.
 * All fields except `word_count_target` are required — parser throws on
 * missing required keys so a malformed article fails the build loudly.
 *
 * `author_email` is stored for internal completeness but never emitted
 * in public JSON-LD (locked decision per wireframer, Person schema gets
 * name + url only).
 */
export interface BlogFrontmatter {
  title: string;
  meta_title: string;
  meta_description: string;
  slug: string;
  canonical_url: string;
  author: string;
  author_url: string;
  author_email: string;
  published: string;
  updated: string;
  target_keyword: string;
  category: BlogCategory;
  excerpt: string;
  featured_image_alt: string;
  word_count_target?: string;
}

export interface BlogFaqEntry {
  question: string;
  answer: string;
}

/**
 * Fully parsed + decorated blog post. `load.ts` builds these from
 * `RawBlogPost` by applying the same-day ISO timestamp stagger rule
 * (first-of-day → 09:00 PST, second-of-day → 14:00 PST) after all
 * posts are read.
 */
export interface BlogPost {
  folder: string;
  frontmatter: BlogFrontmatter;
  bodyHtml: string;
  faq: BlogFaqEntry[] | null;
  howToJsonLd: Record<string, unknown> | null;
  readingMinutes: number;
  publishedISO: string;
  updatedISO: string;
  featuredImagePath: string;
}

/**
 * Intermediate shape returned by `parse.ts` before `load.ts` applies
 * cross-post decoration (time stagger). Separated so `parse.ts` can
 * process one article in isolation.
 */
export interface RawBlogPost {
  folder: string;
  frontmatter: BlogFrontmatter;
  bodyHtml: string;
  faq: BlogFaqEntry[] | null;
  howToJsonLd: Record<string, unknown> | null;
  readingMinutes: number;
}
