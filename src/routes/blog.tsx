import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock, BookOpen } from "lucide-react";

import { PublicLayout } from "@/components/layout/public-layout";
import { blogPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/blog")({
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
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="h-2 bg-gradient-to-r from-primary via-mkt-blue to-mkt-indigo" />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-accent">
                    <span>{post.category}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {formatDate(post.publishedAt)}
                    </div>
                    <a
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Read guide
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
