import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicLayout } from "@/components/layout/public-layout";
import { usePublishedPolicies, useSearchPolicies } from "@/hooks/use-policies";
import { pageMetadata } from "@/lib/seo";

const POLICY_CATEGORIES = [
  {
    slug: "ad-policies",
    label: "Ad Policies",
    description: "Guidelines for ad creatives, landing pages, and prohibited content.",
  },
  {
    slug: "publisher-guidelines",
    label: "Publisher Guidelines",
    description: "Standards for website quality, traffic, and ad placement.",
  },
  {
    slug: "traffic-quality",
    label: "Traffic Quality",
    description: "Invalid traffic protection and click fraud prevention.",
  },
  {
    slug: "prohibited-content",
    label: "Prohibited Content",
    description: "Content types that are not allowed on the platform.",
  },
  {
    slug: "data-privacy",
    label: "Data & Privacy",
    description: "How we collect, use, and protect data.",
  },
  {
    slug: "compliance",
    label: "Compliance",
    description: "Regulatory compliance and legal requirements.",
  },
  {
    slug: "advertiser-policies",
    label: "Advertiser Policies",
    description: "Account, campaign, and billing policies for advertisers.",
  },
  {
    slug: "publisher-policies",
    label: "Publisher Policies",
    description: "Publisher eligibility, earnings, and payout policies.",
  },
];

export const Route = createFileRoute("/policies/")({
  head: () => pageMetadata({
    title: "Policies — TradeMall",
    description:
      "TradeMall platform policies, ad policies, traffic quality standards, and compliance guidelines.",
    path: "/policies",
    image: "/trademall-logo.png",
  }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const policies = usePublishedPolicies();
  const searchPolicies = useSearchPolicies();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const policiesByCategory = useMemo(() => {
    const map = new Map<string, typeof policies.data>();
    const all = policies.data ?? [];
    for (const cat of POLICY_CATEGORIES) {
      const filtered = all.filter((p) => p.category === cat.slug.replace(/-/g, "_"));
      if (filtered.length > 0) map.set(cat.slug, filtered);
    }
    return map;
  }, [policies.data]);

  const categoriesWithPolicies = POLICY_CATEGORIES.filter((cat) => {
    const key = cat.slug.replace(/-/g, "_");
    return (policies.data ?? []).some((p) => p.category === key);
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      await searchPolicies.mutateAsync(searchQuery.trim());
      setActiveTab("search");
    } catch {
      toast.error("Search failed. Please try again.");
    }
  };

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">Platform Policies</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Policies & Guidelines
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              TradeMall maintains clear policies to protect advertisers, publishers, and end users.
              Review the guidelines below to ensure your account and campaigns remain in good
              standing.
            </p>
          </div>

          <div className="mt-8 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search TradeMall policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={searchPolicies.isPending}>
              {searchPolicies.isPending ? "Searching..." : "Search"}
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
            <TabsList>
              <TabsTrigger value="all">All Policies</TabsTrigger>
              {categoriesWithPolicies.map((cat) => (
                <TabsTrigger key={cat.slug} value={cat.slug}>
                  {cat.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="search">Search Results</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {(policies.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No policies have been published yet. Please check back soon.
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(policies.data ?? []).map((policy) => {
                    const cat = POLICY_CATEGORIES.find(
                      (c) => c.slug.replace(/-/g, "_") === policy.category,
                    );
                    return (
                      <Link
                        key={policy.id}
                        to="/policies/$slug"
                        params={{ slug: policy.slug }}
                        className="group block"
                      >
                        <div className="h-full rounded-lg border border-border p-6 transition-colors hover:border-primary hover:bg-primary/5">
                          <p className="text-eyebrow">{cat?.label ?? policy.category}</p>
                          <h3 className="mt-1 font-semibold group-hover:text-primary">
                            {policy.title}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
                          <span className="mt-4 inline-flex items-center text-xs font-medium text-primary">
                            Read policy <ChevronRight className="ml-0.5 size-3" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {categoriesWithPolicies.map((cat) => (
              <TabsContent key={cat.slug} value={cat.slug} className="mt-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(policiesByCategory.get(cat.slug) ?? []).map((policy) => (
                    <Link
                      key={policy.id}
                      to="/policies/$slug"
                      params={{ slug: policy.slug }}
                      className="group block"
                    >
                      <div className="h-full rounded-lg border border-border p-6 transition-colors hover:border-primary hover:bg-primary/5">
                        <h3 className="font-semibold group-hover:text-primary">{policy.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
                        <span className="mt-4 inline-flex items-center text-xs font-medium text-primary">
                          Read policy <ChevronRight className="ml-0.5 size-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </TabsContent>
            ))}

            <TabsContent value="search" className="mt-6">
              {searchPolicies.data && searchPolicies.data.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {searchPolicies.data.map((policy) => {
                    const cat = POLICY_CATEGORIES.find(
                      (c) => c.slug.replace(/-/g, "_") === policy.category,
                    );
                    return (
                      <Link
                        key={policy.id}
                        to="/policies/$slug"
                        params={{ slug: policy.slug }}
                        className="group block"
                      >
                        <div className="h-full rounded-lg border border-border p-6 transition-colors hover:border-primary hover:bg-primary/5">
                          <h3 className="font-semibold group-hover:text-primary">{policy.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
                          <span className="mt-4 inline-flex items-center text-xs font-medium text-primary">
                            Read policy <ChevronRight className="ml-0.5 size-3" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No policies match your search.</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-6">
              <h3 className="font-semibold">Advertiser Policies</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Advertisers must comply with all platform policies to maintain campaign approval and
                account standing.
              </p>
              <Link to="/policies/$slug" params={{ slug: "advertiser-policies" }}>
                <Button variant="outline" size="sm" className="mt-4">
                  View Advertiser Policies
                </Button>
              </Link>
            </div>

            <div className="rounded-lg border border-border p-6">
              <h3 className="font-semibold">Publisher Policies</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Publishers must follow traffic quality and placement guidelines to ensure a
                sustainable marketplace.
              </p>
              <Link to="/policies/$slug" params={{ slug: "publisher-policies" }}>
                <Button variant="outline" size="sm" className="mt-4">
                  View Publisher Policies
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Questions about policies? Contact our support team for clarification.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
