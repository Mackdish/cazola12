import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Clock, Link2 } from "lucide-react";

import { BlogBody } from "@/components/blog/blog-body";
import { formatBlogDate } from "@/components/blog/blog-meta";
import { PublicLayout } from "@/components/layout/public-layout";
import {
  blogPosts,
  databaseBlogPostToBlogPost,
  type BlogPost,
  type DatabaseBlogPost,
} from "@/lib/blog";
import { fetchPublishedBlogPosts } from "@/lib/blog.functions";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  // Loaded on the server so every article's full text is in the HTML that search
  // engines and slow connections receive (no client-side fetch, no empty flash).
  loader: async (): Promise<BlogPost[]> => {
    // If the database is unreachable, the built-in articles still show.
    const published: DatabaseBlogPost[] = await fetchPublishedBlogPosts().catch(() => []);
    const builtInSlugs = new Set(blogPosts.map((post) => post.slug));
    return [
      ...published.filter((post) => !builtInSlugs.has(post.slug)).map(databaseBlogPostToBlogPost),
      ...blogPosts,
    ].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  },
  head: () =>
    pageMetadata({
      title: "TradeMall Blog — How-To Guides & Advertising Tips",
      description:
        "Practical how-to guides for advertisers, publishers and businesses using TradeMall.",
      path: "/blog",
    }),
  component: BlogPage,
});

function BlogPage() {
  const posts = Route.useLoaderData();

  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-mkt-blue/5 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <BookOpen className="size-3.5 text-accent" />
              TradeMall Resources
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              How to grow with TradeMall
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Practical guides covering advertising, website monetization, digital marketing and
              the tools available on TradeMall.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Articles" className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                In this blog
              </p>
              <ul className="mt-3 space-y-2">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <a
                      href={`#${post.slug}`}
                      className="text-sm leading-snug text-foreground/80 hover:text-primary hover:underline"
                    >
                      {post.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="space-y-10">
            {posts.map((post) => (
              <article
                key={post.slug}
                id={post.slug}
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="h-2 bg-gradient-to-r from-primary via-mkt-blue to-mkt-indigo" />
                <div className="p-6 sm:p-10">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-accent">
                    <span>{post.category}</span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {formatBlogDate(post.publishedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" />
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                    <Link to="/blog/$slug" params={{ slug: post.slug }} className="hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">By {post.author}</p>

                  <div className="mt-8 border-t border-border pt-2">
                    <BlogBody post={post} />
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-border pt-4 text-sm">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: post.slug }}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Link2 className="size-4" />
                      Link to this article
                    </Link>
                    <a href="#top" className="text-muted-foreground hover:text-foreground">
                      Back to top
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
