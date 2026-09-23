import { createFileRoute } from "@tanstack/react-router";
import { BlogArticlePage } from "@/components/blog/blog-article-page";
import { blogPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

const post = blogPosts.find((item) => item.slug === "how-to-create-your-first-trademall-ad-campaign")!;

export const Route = createFileRoute("/blog/how-to-create-your-first-trademall-ad-campaign")({
  head: () =>
    pageMetadata({
      title: `How to Create Your First TradeMall Ad Campaign — TradeMall`,
      description: post.excerpt,
      path: `/blog/${post.slug}`,
    }),
  component: () => <BlogArticlePage post={post} />,
});
