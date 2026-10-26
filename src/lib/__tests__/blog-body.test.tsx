import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlogBody } from "@/components/blog/blog-body";
import { blogPosts, builtInBlogSlugs, databaseBlogPostToBlogPost, type DatabaseBlogPost } from "@/lib/blog";

const html = (body: string) => renderToStaticMarkup(<BlogBody post={{ body, sections: [] }} />);

const dbPost = (over: Partial<DatabaseBlogPost> = {}): DatabaseBlogPost => ({
  id: "1",
  slug: "my-post",
  title: "My post",
  excerpt: "",
  category: "How To",
  author: "TradeMall",
  read_time: "2 min read",
  content: "Opening paragraph here.\n\n## Next\n\nMore text.",
  is_published: true,
  published_at: "2026-10-20T08:00:00Z",
  created_at: "2026-10-19T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  ...over,
});

describe("BlogBody — full article rendering", () => {
  it("renders the whole article, not an excerpt", () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph number ${i + 1} of the article.`);
    const out = html(paragraphs.join("\n\n"));
    expect(out).toContain("Paragraph number 1 of");
    expect(out).toContain("Paragraph number 40 of");
    expect((out.match(/<p /g) ?? []).length).toBe(40);
  });

  it("renders headings, lists, emphasis, quotes and links", () => {
    const out = html(
      "## Heading\n\nSome **bold** and *italic* text with a [link](https://example.com/a).\n\n- one\n- two\n\n1. first\n\n> quote",
    );
    expect(out).toContain("<h2");
    expect(out).toContain("<strong");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out).toContain("<blockquote");
    expect(out).toContain('href="https://example.com/a"');
  });

  it("opens external links safely and leaves internal links alone", () => {
    const out = html("[ext](https://example.com) and [int](/auth)");
    expect(out).toMatch(/href="https:\/\/example\.com"[^>]*rel="noopener noreferrer"/);
    expect(out).toContain('target="_blank"');
    expect(out).toMatch(/<a href="\/auth" class=/);
  });

  it("still renders built-in articles written as sections", () => {
    const builtIn = blogPosts[0]!;
    const out = renderToStaticMarkup(<BlogBody post={builtIn} />);
    expect(out).toContain(builtIn.sections[0]!.heading);
    expect(out).toContain("<h2");
  });
});

describe("BlogBody — hostile content stays inert", () => {
  it("escapes pasted HTML instead of executing it", () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;script&gt;");
  });

  it("never emits javascript: or data: URLs", () => {
    const out = html(
      "[a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](data:text/html;base64,AAAA)\n\n![x](javascript:alert(1))",
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).not.toContain("data:text");
    expect(out).not.toContain("<img");
  });

  it("does not let attribute-injection tricks break out of an href", () => {
    const out = html('[x](https://example.com" onmouseover="alert(1))');
    expect(out).not.toMatch(/onmouseover=/);
  });
});

describe("database post conversion", () => {
  it("carries the full Markdown body", () => {
    const post = databaseBlogPostToBlogPost(dbPost());
    expect(post.body).toContain("More text.");
    expect(post.slug).toBe("my-post");
    expect(post.publishedAt).toBe("2026-10-20T08:00:00Z");
  });

  it("falls back to the opening paragraph when the summary is blank", () => {
    expect(databaseBlogPostToBlogPost(dbPost({ excerpt: "   " })).excerpt).toBe("Opening paragraph here.");
    expect(databaseBlogPostToBlogPost(dbPost({ excerpt: "Custom" })).excerpt).toBe("Custom");
  });

  it("uses created_at when a post has no published_at", () => {
    expect(databaseBlogPostToBlogPost(dbPost({ published_at: null })).publishedAt).toBe("2026-10-19T08:00:00Z");
  });

  it("reserves the built-in article slugs", () => {
    expect(builtInBlogSlugs).toContain("how-to-monetize-your-website-with-trademall");
    expect(builtInBlogSlugs).toHaveLength(blogPosts.length);
  });
});

describe("blog route structure (regression)", () => {
  const routes = (name: string) => resolve(process.cwd(), "src/routes", name);

  it("has no /blog layout route that fails to render its children", () => {
    // blog.tsx makes blog.$slug.tsx and blog/*.tsx its CHILDREN. The old one never
    // rendered an <Outlet />, so every article URL showed the listing instead.
    if (existsSync(routes("blog.tsx"))) {
      expect(readFileSync(routes("blog.tsx"), "utf8")).toContain("Outlet");
    }
  });

  it("serves the listing from blog.index.tsx and renders full article bodies", () => {
    expect(existsSync(routes("blog.index.tsx"))).toBe(true);
    const source = readFileSync(routes("blog.index.tsx"), "utf8");
    expect(source).toContain("<BlogBody");
    expect(source).toContain("fetchPublishedBlogPosts");
  });

  it("keeps the article route", () => {
    expect(existsSync(routes("blog.$slug.tsx"))).toBe(true);
  });
});
