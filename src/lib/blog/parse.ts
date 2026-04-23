import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTimeLib from "reading-time";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogFaqEntry,
  type BlogFrontmatter,
  type RawBlogPost,
} from "./types";

const REQUIRED_FRONTMATTER_KEYS: (keyof BlogFrontmatter)[] = [
  "title",
  "meta_title",
  "meta_description",
  "slug",
  "canonical_url",
  "author",
  "author_url",
  "author_email",
  "published",
  "updated",
  "target_keyword",
  "category",
  "excerpt",
  "featured_image_alt",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a single article at `<absFolderPath>/article.md`.
 *
 * Pipeline:
 *   1. Read file + gray-matter split into frontmatter + body
 *   2. Validate required frontmatter keys (throws on missing)
 *   3. Split body at first `---` divider — content above is rendered,
 *      content below is the "SEO Implementation Notes (developer)"
 *      section which is stripped from public output (lock #8 from
 *      wireframer handoff).
 *   4. Extract FAQ from rendered content if `## FAQ` heading present
 *   5. Extract HowTo JSON-LD from dev-notes section if a ```json howto
 *      fenced block is present (posts 05, 10, 11, 12 only)
 *   6. Render rendered content → HTML via remark + remark-gfm + remark-html
 *   7. Compute reading time from rendered content word count
 */
export async function parseArticle(absFolderPath: string): Promise<RawBlogPost> {
  const folder = path.basename(absFolderPath);
  const mdPath = path.join(absFolderPath, "article.md");

  if (!fs.existsSync(mdPath)) {
    throw new Error(`blog parser: missing article.md in ${absFolderPath}`);
  }

  const raw = fs.readFileSync(mdPath, "utf8");
  const { data, content } = matter(raw);

  const frontmatter = validateFrontmatter(data, folder);

  // Split at first `---` horizontal rule (dev-notes divider).
  // gray-matter has already stripped the top frontmatter `---` pair.
  const { renderable, devNotes } = splitAtDevNotesDivider(content);

  const faq = extractFaq(renderable);
  const howToJsonLd = extractHowToJsonLd(devNotes, folder);

  // FAQ is rendered separately in a dedicated component, so remove it
  // from the body HTML to avoid duplication.
  const bodyMarkdown = faq ? stripFaqSection(renderable) : renderable;

  const bodyHtml = await markdownToHtml(bodyMarkdown);
  const readingMinutes = Math.max(
    1,
    Math.ceil(readingTimeLib(bodyMarkdown).minutes),
  );

  return {
    folder,
    frontmatter,
    bodyHtml,
    faq,
    howToJsonLd,
    readingMinutes,
  };
}

// ─── frontmatter validation ──────────────────────────────────────────

function validateFrontmatter(
  data: Record<string, unknown>,
  folder: string,
): BlogFrontmatter {
  const missing: string[] = [];
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    const v = data[key];
    if (typeof v !== "string" || v.trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `blog parser: ${folder}/article.md missing/empty frontmatter keys: ${missing.join(", ")}`,
    );
  }

  const category = data.category as string;
  if (!BLOG_CATEGORIES.includes(category as BlogCategory)) {
    throw new Error(
      `blog parser: ${folder}/article.md has invalid category "${category}" — must be one of ${BLOG_CATEGORIES.join(", ")}`,
    );
  }

  const published = data.published as string;
  const updated = data.updated as string;
  if (!DATE_RE.test(published)) {
    throw new Error(
      `blog parser: ${folder}/article.md has invalid published date "${published}" — must be YYYY-MM-DD`,
    );
  }
  if (!DATE_RE.test(updated)) {
    throw new Error(
      `blog parser: ${folder}/article.md has invalid updated date "${updated}" — must be YYYY-MM-DD`,
    );
  }

  return {
    title: data.title as string,
    meta_title: data.meta_title as string,
    meta_description: data.meta_description as string,
    slug: data.slug as string,
    canonical_url: data.canonical_url as string,
    author: data.author as string,
    author_url: data.author_url as string,
    author_email: data.author_email as string,
    published,
    updated,
    target_keyword: data.target_keyword as string,
    category: category as BlogCategory,
    excerpt: data.excerpt as string,
    featured_image_alt: data.featured_image_alt as string,
    word_count_target:
      typeof data.word_count_target === "string"
        ? data.word_count_target
        : undefined,
  };
}

// ─── content splitting ───────────────────────────────────────────────

function splitAtDevNotesDivider(content: string): {
  renderable: string;
  devNotes: string;
} {
  // Match a horizontal rule line: `---` on its own line, surrounded by
  // blank lines (per CommonMark). The FIRST such divider in the body
  // (after gray-matter stripped the frontmatter) separates public
  // content from the SEO Implementation Notes block.
  const dividerRe = /\n---\s*\n/;
  const match = dividerRe.exec(content);
  if (!match) {
    return { renderable: content, devNotes: "" };
  }
  const idx = match.index;
  return {
    renderable: content.slice(0, idx).trimEnd(),
    devNotes: content.slice(idx + match[0].length),
  };
}

// ─── FAQ extraction ──────────────────────────────────────────────────

function extractFaq(renderable: string): BlogFaqEntry[] | null {
  // Marker: `## FAQ` (exact, uppercase, singular — per actual article
  // content on 2026-04-22. Wireframer's "## faqs" answer was stated but
  // not reflected in the MDs; locking to what's real.)
  const headingRe = /\n## FAQ\s*\n/;
  const headingMatch = headingRe.exec(renderable);
  if (!headingMatch) {
    return null;
  }
  const after = renderable.slice(headingMatch.index + headingMatch[0].length);

  // FAQ terminates at next `## ` (H2) heading OR end of renderable.
  const nextH2 = /\n## /.exec(after);
  const faqSection = nextH2 ? after.slice(0, nextH2.index) : after;

  // Each Q is `### <question?>`. The A is everything up to the next `### `
  // or end of section. Allow multi-paragraph answers by collapsing them
  // into a single string preserving inner newlines.
  const entries: BlogFaqEntry[] = [];
  const qRe = /### (.+?)\n([\s\S]*?)(?=\n### |$)/g;
  let m: RegExpExecArray | null;
  while ((m = qRe.exec(faqSection)) !== null) {
    const question = m[1].trim();
    const answer = m[2].trim();
    if (question && answer) {
      entries.push({ question, answer });
    }
  }
  return entries.length > 0 ? entries : null;
}

function stripFaqSection(renderable: string): string {
  const headingRe = /\n## FAQ\s*\n/;
  const headingMatch = headingRe.exec(renderable);
  if (!headingMatch) return renderable;

  const before = renderable.slice(0, headingMatch.index);
  const after = renderable.slice(headingMatch.index + headingMatch[0].length);
  const nextH2 = /\n## /.exec(after);
  if (!nextH2) {
    // FAQ was the last section — return everything before it
    return before.trimEnd();
  }
  return before.trimEnd() + "\n\n" + after.slice(nextH2.index).trimStart();
}

// ─── HowTo JSON-LD extraction ────────────────────────────────────────

function extractHowToJsonLd(
  devNotes: string,
  folder: string,
): Record<string, unknown> | null {
  if (!devNotes) return null;
  // Per wireframer: HowTo posts mark their block with ```json howto
  // (not a plain ```json fence) so the parser can target deterministically.
  const fenceRe = /```json howto\n([\s\S]*?)\n```/;
  const m = fenceRe.exec(devNotes);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `blog parser: ${folder}/article.md has malformed HowTo JSON in \`\`\`json howto block — ${(err as Error).message}`,
    );
  }
}

// ─── markdown → HTML ─────────────────────────────────────────────────

async function markdownToHtml(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(md);
  return String(file);
}
