import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Globe,
  Globe2,
  MousePointerClick,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";

export const Route = createFileRoute("/advertisers")({
  head: () => ({
    meta: [
      { title: "Advertisers — TradeMall" },
      {
        name: "description",
        content:
          "Reach the right audience across Africa with TradeMall. Targeted campaigns, real-time analytics, and brand-safe inventory.",
      },
    ],
  }),
  component: AdvertisersPage,
});

function AdvertisersPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">For Advertisers</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Reach the Right Audience
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Run targeted campaigns across Africa with precision. Reach users by country, county,
              city, device, browser, OS, and website category. Track performance in real time and
              protect your brand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-8">
                <Link to="/auth">
                  Start Advertising
                  <ChevronRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-8">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">Targeting capabilities</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              TradeMall gives you control over where and when your ads appear. Only functionality
              that exists today is listed.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Globe2, label: "Country" },
                { icon: Target, label: "County" },
                { icon: Target, label: "City" },
                { icon: MousePointerClick, label: "Device" },
                { icon: BarChart3, label: "Browser" },
                { icon: Zap, label: "OS" },
                { icon: Globe, label: "Website category" },
                { icon: ChevronRight, label: "Schedule" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm"
                >
                  <item.icon className="size-4 text-accent" />
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-accent" />
                  Campaign Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track impressions, clicks, CTR, CPC, CPM, spend, and revenue. Make data-driven
                  decisions with real-time reporting.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-accent" />
                  Brand Safety
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Advertiser controls let you exclude categories, manage placements, and protect
                  your brand with invalid traffic protection and fraud detection.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5 text-accent" />
                  Fraud Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Invalid traffic protection and click fraud detection are built into the platform
                  to help protect your budget and improve campaign quality.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="size-5 text-accent" />
                  Website Controls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review and manage where your ads appear. Block specific sites and categories to
                  maintain brand alignment and campaign effectiveness.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointerClick className="size-5 text-accent" />
                  CPC & CPM Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Choose the pricing model that fits your goals. Run cost-per-click campaigns for
                  performance or CPM campaigns for reach and awareness.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-5 text-accent" />
                  Multiple Ad Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Choose from banner, rectangle, mobile banner, and responsive formats. Serve the
                  right creative to the right audience on any screen.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 sm:p-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                Ready to grow your business?
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Create your first campaign in minutes. Reach audiences across Kenya, Nigeria, South
                Africa, Uganda, Tanzania, Ghana, and Rwanda.
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/auth">
                    Start Advertising
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
