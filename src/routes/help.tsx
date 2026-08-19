import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Globe,
  HelpCircle,
  MessageSquare,
  Phone,
  Search,
  Shield,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/layout/public-layout";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — TradeMall" },
      {
        name: "description",
        content:
          "Get help with TradeMall. Documentation, guides, and support for advertisers and publishers.",
      },
    ],
  }),
  component: HelpPage,
});

const HELP_TOPICS = [
  {
    title: "Getting Started",
    description: "Account setup, verification, and first steps for advertisers and publishers.",
    icon: BookOpen,
  },
  {
    title: "Advertiser Guides",
    description: "Creating campaigns, targeting, budgets, billing, and optimization.",
    icon: ChevronRight,
  },
  {
    title: "Publisher Guides",
    description: "Adding websites, installing ad zones, earnings, and payouts.",
    icon: Globe,
  },
  {
    title: "API Documentation",
    description: "Integration guides for the TradeMall API v1.",
    icon: BookOpen,
  },
  {
    title: "Policies & Compliance",
    description: "Ad policies, traffic quality standards, and publisher guidelines.",
    icon: Shield,
  },
  {
    title: "Billing & Payments",
    description: "Invoices, payment methods, payout schedules, and tax information.",
    icon: MessageSquare,
  },
];

function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = HELP_TOPICS.filter(
    (topic) =>
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">Help Center</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              How can we help?
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Find guides, documentation, and answers to common questions about advertising and
              publishing with TradeMall.
            </p>
            <form className="mt-8 flex w-full max-w-md items-center gap-2" onSubmit={handleSearch}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search help articles..."
                  className="pl-9 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button size="sm" type="submit">Search</Button>
            </form>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTopics.map((topic) => (
              <Card key={topic.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <topic.icon className="size-5 text-accent" />
                    {topic.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{topic.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-accent" />
                  Contact Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Need help that isn't covered in our guides? Our support team is here to assist
                  you.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-accent" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Integrate TradeMall into your workflow using our REST API.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth">View API Docs</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 sm:p-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">Still need help?</h2>
              <p className="mt-3 text-base text-muted-foreground">
                Reach out to our team and we'll get back to you as soon as possible.
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
