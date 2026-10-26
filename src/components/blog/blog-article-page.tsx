import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";

import { BlogBody } from "@/components/blog/blog-body";
import { formatBlogDate } from "@/components/blog/blog-meta";
import { PublicLayout } from "@/components/layout/public-layout";
import type { BlogPost } from "@/lib/blog";

/** One full article on its own page (/blog/<slug>). */
export function BlogArticlePage({ post }: { post: BlogPost }) {
  return (
    <PublicLayout>
      <article>
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to Blog
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs font-medium text-accent">
              <span>{post.category}</span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {formatBlogDate(post.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" />
                {post.readTime}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{post.title}</h1>
            {post.excerpt ? (
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
            ) : null}
            <p className="mt-4 text-sm text-muted-foreground">By {post.author}</p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <BlogBody post={post} />

          <div className="mt-12 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold text-foreground">Ready to use TradeMall?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an advertiser or publisher account and start using the platform.
            </p>
            <div className="mt-4">
              <Link
                to="/auth"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
