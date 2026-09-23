import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";

import { PublicLayout } from "@/components/layout/public-layout";
import type { BlogPost } from "@/lib/blog";

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
                {formatDate(post.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" />
                {post.readTime}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
            <p className="mt-4 text-sm text-muted-foreground">By {post.author}</p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="max-w-none">
            {post.sections.map((section) => (
              <section key={section.heading} className="mb-10">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-base leading-8 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
