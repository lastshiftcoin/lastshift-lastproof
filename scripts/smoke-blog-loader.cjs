/* eslint-disable @typescript-eslint/no-require-imports */
const { loadAllBlogPosts } = require("../src/lib/blog/load.ts");

(async () => {
  const posts = await loadAllBlogPosts();
  console.log("post count:", posts.length);
  for (const p of posts) {
    console.log(
      p.folder.padEnd(34),
      p.frontmatter.category.padEnd(10),
      p.publishedISO,
      `(read ${p.readingMinutes} min)`,
      p.faq ? `faq=${p.faq.length}` : "faq=- ",
      p.howToJsonLd ? "howto=Y" : "howto=-",
    );
  }
  console.log("---");
  console.log("first post bodyHtml length:", posts[0].bodyHtml.length);
  console.log("first post featuredImagePath:", posts[0].featuredImagePath);
})().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
