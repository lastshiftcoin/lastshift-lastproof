import type { BlogPost } from "./types";

/**
 * Pick up to 3 related posts for a given post.
 *
 * Algorithm (locked per review 2026-04-22):
 *   1. Same-category posts, sorted by publishedISO desc (newest first)
 *   2. Cross-category fallback if fewer than 3 same-category peers
 *   3. Exclude the current post
 *   4. Cap at 3
 *
 * Pure function — takes full post list + current post, no I/O.
 */
export function pickRelated(
  current: BlogPost,
  all: BlogPost[],
  limit = 3,
): BlogPost[] {
  const others = all.filter(
    (p) => p.frontmatter.slug !== current.frontmatter.slug,
  );
  const sameCategory = others.filter(
    (p) => p.frontmatter.category === current.frontmatter.category,
  );
  const crossCategory = others.filter(
    (p) => p.frontmatter.category !== current.frontmatter.category,
  );
  // `others` is already newest-first because load.ts sorts globally.
  // Filters preserve that order.
  return [...sameCategory, ...crossCategory].slice(0, limit);
}
