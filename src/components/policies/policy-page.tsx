import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Menu, X, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/layout/public-layout";
import { usePolicyBySlug } from "@/hooks/use-policies";
import type { PolicySection } from "@/lib/policy-service.server";

const ENFORCEMENT_LEVELS = [
  {
    level: "NOTICE",
    description:
      "First-time or minor violations receive a formal notice with guidance on corrective action.",
  },
  {
    level: "WARNING",
    description:
      "Repeated or moderate violations result in a warning, with potential restrictions if unresolved.",
  },
  {
    level: "RESTRICTION",
    description:
      "Serious or repeated violations may lead to account restrictions, reduced serving, or feature limitations.",
  },
  {
    level: "SUSPENSION",
    description:
      "Severe or ongoing violations can result in temporary account suspension pending review.",
  },
  {
    level: "TERMINATION",
    description:
      "The most serious violations may result in permanent account termination without notice.",
  },
];

export const Route = createFileRoute("/policies/$slug")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} — TradeMall Policies`,
      },
      { name: "description", content: "TradeMall platform policies and guidelines." },
    ],
  }),
  component: PolicyDetailPage,
});

export function PolicyDetailPage() {
  const { slug } = Route.useParams();
  const { data: policy, isLoading, error } = usePolicyBySlug(slug);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const sections = useMemo(
    () => (policy?.sections as PolicySection[] | undefined) ?? [],
    [policy?.sections],
  );

  useEffect(() => {
    if (!sections.length) return;
    const handles = sections.map((section) => {
      const el = document.getElementById(section.id);
      if (!el) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveSection(section.id);

        },
        { rootMargin: "-80px 0px -80px 0px", threshold: 0.1 },
      );
      observer.observe(el);
      return { el, observer };
    });
    return () => handles.forEach((h) => h?.observer.disconnect());
  }, [sections]);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-64 w-full rounded bg-muted" />
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !policy) {
    return (
      <PublicLayout>
        <div className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-2xl font-semibold">Policy not found</h1>
            <p className="mt-2 text-muted-foreground">
              The requested policy does not exist or is not published.
            </p>
            <Button asChild className="mt-4">
              <Link to="/policies">Back to Policies</Link>
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/policies" className="hover:text-foreground">
              Policies
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{policy.title}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <h3 className="text-sm font-medium">On this page</h3>
                <nav className="mt-3 space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                        activeSection === section.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="lg:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTocOpen(!tocOpen)}
                  className="mb-4"
                >
                  {tocOpen ? <X className="mr-1.5 size-4" /> : <Menu className="mr-1.5 size-4" />}
                  {tocOpen ? "Close" : "Table of Contents"}
                </Button>
                {tocOpen && (
                  <div className="mb-6 rounded-lg border border-border p-4">
                    <h3 className="text-sm font-medium">On this page</h3>
                    <nav className="mt-3 space-y-1">
                      {sections.map((section) => (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => setTocOpen(false)}
                        >
                          {section.title}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-eyebrow">
                  {policy.category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {policy.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Last updated:{" "}
                  {new Date(policy.last_updated).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="mt-8 prose prose-slate max-w-none">
                <p className="text-base leading-relaxed text-muted-foreground">
                  {policy.description}
                </p>

                <div className="mt-8 space-y-12">
                  {sections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-24">
                      <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
                      <p className="mt-3 text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {section.content}
                      </p>

                      {section.examples && section.examples.length > 0 && (
                        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                          <h4 className="text-sm font-medium">Examples</h4>
                          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            {section.examples.map((example, i) => (
                              <li key={i}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.requirements && section.requirements.length > 0 && (
                        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                          <h4 className="text-sm font-medium">Requirements</h4>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {section.requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 size-4 text-success" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.violations && section.violations.length > 0 && (
                        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                          <h4 className="text-sm font-medium text-destructive">Violations</h4>
                          <ul className="mt-2 space-y-2 text-sm text-destructive/80">
                            {section.violations.map((violation, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <XCircle className="mt-0.5 size-4" />
                                <span>{violation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.enforcement && (
                        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                          <h4 className="text-sm font-medium">Enforcement</h4>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {section.enforcement}
                          </p>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </div>

              <div className="mt-12 rounded-lg border border-border p-6">
                <h3 className="font-semibold">Enforcement Framework</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  TradeMall uses a graduated enforcement approach. The severity and frequency of
                  violations determine the appropriate response.
                </p>
                <div className="mt-4 space-y-3">
                  {ENFORCEMENT_LEVELS.map((item) => (
                    <div key={item.level} className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-4 text-accent" />
                      <div>
                        <p className="text-sm font-medium">{item.level}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="text-sm font-medium">Appeals</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    If you believe a policy enforcement action was made in error, you may request a
                    review by contacting our support team. Provide relevant details and supporting
                    documentation for the fastest resolution.
                  </p>
                </div>
              </div>

              {policy.related_policies &&
                Array.isArray(policy.related_policies) &&
                policy.related_policies.length > 0 && (
                  <div className="mt-12">
                    <h3 className="font-semibold">Related Policies</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(policy.related_policies as string[]).map((relatedSlug) => {
                        const relatedCat = POLICY_CATEGORIES.find((c) => c.slug === relatedSlug);
                        return (
                          <Link key={relatedSlug} to="/policies/$slug" params={{ slug: relatedSlug }}>
                            <Button variant="outline" size="sm">
                              {relatedCat?.label ?? relatedSlug}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

              <div className="mt-12 flex items-center justify-between">
                <Button asChild variant="ghost">
                  <Link to="/policies">
                    <ChevronRight className="mr-1.5 size-4 rotate-180" />
                    All Policies
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

const POLICY_CATEGORIES = [
  { slug: "ad-policies", label: "Ad Policies" },
  { slug: "publisher-guidelines", label: "Publisher Guidelines" },
  { slug: "traffic-quality", label: "Traffic Quality" },
  { slug: "prohibited-content", label: "Prohibited Content" },
  { slug: "data-privacy", label: "Data & Privacy" },
  { slug: "compliance", label: "Compliance" },
  { slug: "advertiser-policies", label: "Advertiser Policies" },
  { slug: "publisher-policies", label: "Publisher Policies" },
];
