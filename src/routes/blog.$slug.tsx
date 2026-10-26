import { createFileRoute, notFound } from "@tanstack/react-router";

import { BlogArticlePage } from "@/components/blog/blog-article-page";
import { blogPosts, databaseBlogPostToBlogPost } from "@/lib/blog";
import { fetchBlogPostBySlug } from "@/lib/blog.functions";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    // Built-in articles first, so a database failure can never take them offline.
    const builtIn = blogPosts.find((item) => item.slug === params.slug);
    if (builtIn) return builtIn;

    const databasePost = await fetchBlogPostBySlug({ data: { slug: params.slug } }).catch(
      () => null,
    );
    if (!databasePost) throw notFound();
    return databaseBlogPostToBlogPost(databasePost);
  },
  head: ({ loaderData }) => {
    const post = loaderData;
    return pageMetadata({
      title: post ? `${post.title} — TradeMall` : "TradeMall Blog",
      description: post?.excerpt || "TradeMall how-to guides and resources.",
      path: post ? `/blog/${post.slug}` : "/blog",
    });
  },
  component: BlogArticleRoute,
});

function BlogArticleRoute() {
  const post = Route.useLoaderData();
  return <BlogArticlePage post={post} />;
}
