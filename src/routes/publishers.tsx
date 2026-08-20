import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Globe, BarChart3, Shield, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/publishers")({
  head: () => pageMetadata({
    title: "Publishers — TradeMall",
    description:
      "Monetize your website with TradeMall. Fast approval, simple integration, transparent earnings, and local payment options.",
    path: "/publishers",
    image: "/trademall-logo.png",
  }),
  component: PublishersPage,
});

function PublishersPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">For Publishers</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn your website traffic into revenue.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Join publishers across Africa who monetize their websites with TradeMall. Fast
              approval, one-line integration, transparent earnings, and reliable payments.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-8">
                <Link to="/auth">
                  Become a Publisher
                  <ChevronRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-8">
                <Link to="/help">View Documentation</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-5 text-accent" />
                  Fast Website Approval
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Submit your domain and get verified quickly. Our streamlined process gets your
                  site approved and ready to serve ads without unnecessary delays.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5 text-accent" />
                  Transparent Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track every impression and click in real time. See exactly how much you've earned
                  with detailed reporting and no hidden deductions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="size-5 text-accent" />
                  Simple Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Install an ad zone with one line of code. Copy the embed snippet, paste it into
                  your site, and start serving ads immediately.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-accent" />
                  Detailed Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monitor impressions, clicks, CTR, eCPM, and revenue. Understand your audience and
                  optimize your ad placements with actionable data.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Publisher Policy Center
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Clear guidelines on ad placement, content quality, and traffic standards. Stay
                  compliant and maintain access to high-quality advertiser demand.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5 text-accent" />
                  Local Payment Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Receive payouts through payment methods designed for African publishers. Fast,
                  reliable, and transparent.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              Why publishers choose TradeMall
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Fast website approval",
                "Simple one-line integration",
                "Transparent earnings",
                "Local payment options",
                "Detailed analytics",
                "Publisher policy center",
                "Human support",
                "No unnecessary complexity",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <ChevronRight className="size-4 text-accent" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 sm:p-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                Ready to monetize your website?
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Create an account, add your website, and start earning from your traffic. No upfront
                costs. No risk.
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/auth">
                    Start Monetizing
                    <ChevronRight className="ml-1.5 size-4" />
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
