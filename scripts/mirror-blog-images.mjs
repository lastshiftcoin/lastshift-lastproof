#!/usr/bin/env node
/**
 * scripts/mirror-blog-images.mjs
 *
 * Copies each `content/blog/<folder>/featured-image.png` into
 * `public/blog/<slug>/featured.png`, keyed by the `slug` field in the
 * sibling `article.md` frontmatter.
 *
 * Why mirror at all:
 *   - `content/blog/` is the authoring surface (folder = self-contained
 *     bundle, easy drag-drop for non-dev sessions).
 *   - `next/image` serves from `/public`, not `/content`, so the file
 *     needs to land where Next can serve it.
 *
 * Why a build-time copy instead of a custom loader:
 *   - One pre-step keeps Next's existing image pipeline (srcset,
 *     responsive sizes, lazy-load) intact with zero config.
 *   - Idempotent on mtime: skips unchanged sources, fast on incremental
 *     builds.
 *
 * Wired into `package.json` as `prebuild` + `predev`.
 *
 * Aspect ratio is preserved — no resize. `next/image` handles srcset
 * generation at runtime from the original file dimensions.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const CONTENT_DIR = join(REPO_ROOT, "content", "blog");
const PUBLIC_DIR = join(REPO_ROOT, "public", "blog");

function extractSlugFromFrontmatter(mdText, folder) {
  const m = /^slug:\s*"([^"]+)"\s*$/m.exec(mdText);
  if (!m) {
    throw new Error(
      `mirror-blog-images: ${folder}/article.md is missing a quoted slug: field in frontmatter`,
    );
  }
  return m[1];
}

function shouldCopy(src, dst) {
  try {
    const dstStat = statSync(dst);
    const srcStat = statSync(src);
    return srcStat.mtimeMs > dstStat.mtimeMs;
  } catch {
    return true; // dst doesn't exist
  }
}

function main() {
  let folders;
  try {
    folders = readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => !n.startsWith("."))
      .sort();
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`mirror-blog-images: ${CONTENT_DIR} does not exist — nothing to mirror`);
      return;
    }
    throw err;
  }

  let copied = 0;
  let skipped = 0;
  let total = 0;

  for (const folder of folders) {
    const folderAbs = join(CONTENT_DIR, folder);
    const mdPath = join(folderAbs, "article.md");
    const imgPath = join(folderAbs, "featured-image.png");

    let mdText;
    try {
      mdText = readFileSync(mdPath, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(
          `mirror-blog-images: ${folder} is missing article.md`,
        );
      }
      throw err;
    }
    try {
      statSync(imgPath);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(
          `mirror-blog-images: ${folder} is missing featured-image.png`,
        );
      }
      throw err;
    }

    const slug = extractSlugFromFrontmatter(mdText, folder);
    const dstDir = join(PUBLIC_DIR, slug);
    const dstFile = join(dstDir, "featured.png");

    total++;
    if (shouldCopy(imgPath, dstFile)) {
      mkdirSync(dstDir, { recursive: true });
      copyFileSync(imgPath, dstFile);
      copied++;
      console.log(`  ${folder} → public/blog/${slug}/featured.png`);
    } else {
      skipped++;
    }
  }

  console.log(
    `mirror-blog-images: ${copied} copied, ${skipped} skipped (unchanged), ${total} total`,
  );
}

main();
