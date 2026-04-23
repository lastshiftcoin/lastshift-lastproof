import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

import { parseArticle } from "./parse";
import type { BlogPost, RawBlogPost } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

/**
 * Load all blog posts from `content/blog/`.
 *
 * Wrapped in `React.cache()` so a single request only reads disk once
 * even when multiple server components ask for the list (sitemap + RSS
 * + blog index share the same read at build time).
 *
 * Ordering: newest first, by `publishedISO` (after time-stagger is
 * applied). Same-day posts land in stable folder-number order.
 */
export const loadAllBlogPosts = cache(async (): Promise<BlogPost[]> => {
  const folders = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !n.startsWith("."))
    .sort(); // alpha sort = folder-number-prefix order

  const raws: RawBlogPost[] = [];
  for (const folder of folders) {
    const abs = path.join(CONTENT_DIR, folder);
    const raw = await parseArticle(abs);
    raws.push(raw);
  }

  const posts = decorateWithISO(raws);

  // Sort newest first by publishedISO. For same-day posts, the
  // ISO time component (09:00 vs 14:00) breaks ties naturally.
  posts.sort((a, b) => b.publishedISO.localeCompare(a.publishedISO));

  return posts;
});

export const loadPostBySlug = cache(
  async (slug: string): Promise<BlogPost | null> => {
    const posts = await loadAllBlogPosts();
    return posts.find((p) => p.frontmatter.slug === slug) ?? null;
  },
);

export const loadPostsByCategory = cache(
  async (category: string): Promise<BlogPost[]> => {
    const posts = await loadAllBlogPosts();
    return posts.filter((p) => p.frontmatter.category === category);
  },
);

// ─── ISO time stagger ────────────────────────────────────────────────

/**
 * Apply the same-day timestamp stagger rule.
 *
 * Per wireframer handoff 2026-04-22: for any two posts sharing a
 * `published:` date, emit different times in JSON-LD / RSS so the feed
 * doesn't read as a batch. First by folder number → 09:00 PST,
 * second → 14:00 PST. MST/UTC-7.
 *
 * If a future schedule puts >2 posts on one day, add more slots here
 * (17:00, 20:00, etc.) — noted in WORKLOG handoff.
 */
const TIME_SLOTS = ["T09:00:00-07:00", "T14:00:00-07:00"];

function decorateWithISO(raws: RawBlogPost[]): BlogPost[] {
  // Group by published date, assign time slots in folder order.
  const byDate = new Map<string, RawBlogPost[]>();
  for (const r of raws) {
    const d = r.frontmatter.published;
    const bucket = byDate.get(d) ?? [];
    bucket.push(r);
    byDate.set(d, bucket);
  }

  const folderSlotMap = new Map<string, string>();
  for (const [, bucket] of byDate) {
    // folders are already alpha-sorted coming in; preserve that order
    bucket.sort((a, b) => a.folder.localeCompare(b.folder));
    bucket.forEach((r, i) => {
      const slot = TIME_SLOTS[i] ?? TIME_SLOTS[TIME_SLOTS.length - 1];
      if (i >= TIME_SLOTS.length) {
        console.warn(
          `blog loader: more same-day posts than time slots on ${r.frontmatter.published}; reusing last slot for ${r.folder}`,
        );
      }
      folderSlotMap.set(r.folder, slot);
    });
  }

  return raws.map((r) => {
    const pubSlot = folderSlotMap.get(r.folder)!;
    // `updated` may differ from `published`; apply same slot rule
    // scoped to each field's date.
    const publishedISO = r.frontmatter.published + pubSlot;
    const updSlot =
      r.frontmatter.updated === r.frontmatter.published
        ? pubSlot
        : slotForDate(r.folder, r.frontmatter.updated, raws);
    const updatedISO = r.frontmatter.updated + updSlot;
    return {
      ...r,
      publishedISO,
      updatedISO,
      featuredImagePath: `/blog/${r.frontmatter.slug}/featured.png`,
    };
  });
}

function slotForDate(
  folder: string,
  date: string,
  raws: RawBlogPost[],
): string {
  const sameDay = raws
    .filter((r) => r.frontmatter.updated === date)
    .sort((a, b) => a.folder.localeCompare(b.folder));
  const idx = sameDay.findIndex((r) => r.folder === folder);
  return TIME_SLOTS[idx] ?? TIME_SLOTS[TIME_SLOTS.length - 1];
}
