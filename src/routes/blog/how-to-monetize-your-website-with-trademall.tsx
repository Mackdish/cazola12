import { createFileRoute } from "@tanstack/react-router";
import { BlogArticlePage } from "@/components/blog/blog-article-page";
import { blogPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

const post = blogPosts.find((item) => item.slug === "how-to-monetize-your-website-with-trademall")!;

export const Route = createFileRoute("/blog/how-to-monetize-your-website-with-trademall")({
  head: () =>
    pageMetadata({
      title: `How to Monetize Your Website with TradeMall — TradeMall`,
      description: post.excerpt,
      path: `/blog/${post.slug}`,
    }),
  component: () => <BlogArticlePage post={post} />,
});
