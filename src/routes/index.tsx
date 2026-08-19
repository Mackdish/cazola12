import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Globe,
  Globe2,
  LineChart,
  MapPin,
  Megaphone,
  Monitor,
  MousePointerClick,
  PanelsTopLeft,
  Rocket,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  Layers,
  Calendar,
  Settings,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/layout/footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeMall — Built for Africa's Digital Ecosystem" },
      {
        name: "description",
        content:
          "TradeMall is a premium digital advertising platform built for Africa. Advertise to local audiences or monetize your website with transparent, data-driven tools.",
      },
      { property: "og:title", content: "TradeMall — Built for Africa's Digital Ecosystem" },
      {
        property: "og:description",
        content:
          "Local audiences. Local advertisers. Local payment options. The advertising platform built for Africa.",
      },
    ],
  }),
  component: Landing,
});

const AD_FORMATS = [
  {
    icon: Monitor,
    title: "Banner",
    description: "Classic horizontal display ads",
    size: "728×90",
  },
  {
    icon: Layers,
    title: "Rectangle",
    description: "High-impact medium rectangles",
    size: "300×250",
  },
  {
    icon: Smartphone,
    title: "Mobile Banner",
    description: "Optimized for mobile screens",
    size: "320×50",
  },
  {
    icon: Layers,
    title: "Responsive",
    description: "Adapts to any container size",
    size: "Auto",
  },
];

const TARGETING_OPTIONS = [
  { icon: Globe2, label: "Country" },
  { icon: MapPin, label: "County" },
  { icon: MapPin, label: "City" },
  { icon: Smartphone, label: "Device" },
  { icon: Monitor, label: "Browser" },
  { icon: Monitor, label: "OS" },
  { icon: Globe, label: "Category" },
  { icon: Calendar, label: "Schedule" },
];

const ADVERTISER_STEPS = [
  {
    icon: Rocket,
    title: "Create campaign",
    description: "Set your budget, upload creatives, and define your goals in minutes.",
  },
  {
    icon: Target,
    title: "Choose audience & budget",
    description: "Target by country, city, device, browser, and website category.",
  },
  {
    icon: TrendingUp,
    title: "Reach your customers",
    description: "Your ads go live across our verified publisher network instantly.",
  },
];

const PUBLISHER_STEPS = [
  {
    icon: Globe,
    title: "Add your website",
    description: "Submit your domain for verification and get approved fast.",
  },
  {
    icon: Settings,
    title: "Install an ad zone",
    description: "Copy one line of embed code and paste it into your site.",
  },
  {
    icon: Wallet,
    title: "Earn from your traffic",
    description: "Earn revenue for every impression and click in real time.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex items-center gap-4 text-left lg:flex-col lg:items-center lg:gap-0 lg:text-center">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground lg:size-14">
        <Icon className="size-5 lg:size-6" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-accent lg:mt-4">{`Step ${step}`}</div>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground lg:mt-1.5 lg:max-w-[240px]">
          {description}
        </p>
      </div>
    </div>
  );

}



function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PanelsTopLeft className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">TradeMall</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/advertisers"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Megaphone className="size-4" />
              Advertisers
            </Link>
            <Link
              to="/publishers"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Globe2 className="size-4" />
              Publishers
            </Link>
            <Link
              to="/pricing"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <BarChart3 className="size-4" />
              Pricing
            </Link>
            <Link
              to="/help"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Target className="size-4" />
              Help
            </Link>
            <Link
              to="/policies"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ShieldCheck className="size-4" />
              Policies
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">
                Get started
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
              <div className="max-w-2xl">
                <p className="text-eyebrow">Built for Africa's digital ecosystem</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Local audiences. <span className="text-accent">Local advertisers.</span>
                </h1>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl text-muted-foreground">
                  Local payment options.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  TradeMall is the advertising platform built for Africa. Advertisers reach targeted
                  audiences across Kenya, Nigeria, South Africa, Uganda, Tanzania, Ghana, and
                  Rwanda. Publishers monetize their traffic with transparent earnings and local
                  payment options.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="h-11 px-8">
                    <Link to="/auth">
                      Start Advertising
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-11 px-8">
                    <Link to="/auth">
                      Become a Publisher
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative lg:pl-8">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl" />
                  <div className="relative rounded-2xl border border-border bg-card p-8 shadow-lg">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: Megaphone, label: "Advertisers" },
                        { icon: Globe2, label: "Publishers" },
                        { icon: BarChart3, label: "Analytics" },
                        { icon: Target, label: "Targeting" },
                        { icon: Wallet, label: "Earnings" },
                        { icon: ShieldCheck, label: "Brand Safety" },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4 text-center">
                          <item.icon className="size-6 text-accent" />
                          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Advertiser Section */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <p className="text-eyebrow">For Advertisers</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Put your business in front of the right audience.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Create targeted campaigns, choose from multiple ad formats, and reach customers by
                  country, city, device, and browser. Track every impression, click, and conversion
                  with powerful analytics.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "Targeted campaigns",
                    "Multiple ad formats",
                    "Country & city targeting",
                    "Campaign analytics",
                    "Flexible budgets",
                    "CPC & CPM campaigns",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <Button asChild size="lg" className="h-11 px-8">
                    <Link to="/auth">
                      Create Campaign
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Campaign Management</div>
                      <div className="text-xs text-muted-foreground">Everything you need to launch</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" />
                      Ready
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Ad Formats", value: "Banner, Rectangle, Mobile, Responsive" },
                      { label: "Pricing Models", value: "CPC, CPM" },
                      { label: "Targeting", value: "Country, County, City, Device, Browser, OS, Category" },
                      { label: "Analytics", value: "Impressions, Clicks, CTR, Spend, Revenue" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Publisher Section */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Publisher Dashboard</div>
                      <div className="text-xs text-muted-foreground">Real-time earnings & controls</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" />
                      Live
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Earnings Model", value: "Revenue share on impressions and clicks" },
                      { label: "Ad Formats", value: "Banner, Rectangle, Mobile, Responsive" },
                      { label: "Integration", value: "One-line embed code" },
                      { label: "Controls", value: "Block categories, manage refresh, lazy loading" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-eyebrow">For Publishers</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Turn your website traffic into revenue.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Add your website, install an ad zone with one line of code, and start earning from
                  every visit. Get real-time statistics, reliable payments, and flexible ad zone
                  management.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "Easy integration",
                    "Multiple ad formats",
                    "Real-time statistics",
                    "Reliable earnings",
                    "Flexible ad zones",
                    "Payout management",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <Button asChild size="lg" className="h-11 px-8">
                    <Link to="/auth">
                      Become a Publisher
                      <ChevronRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center mb-12">
              <p className="text-eyebrow">How It Works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Start in minutes
              </h2>
            </div>
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <div className="text-center lg:text-left mb-10">
                  <p className="text-eyebrow">For Advertisers</p>
                  <h3 className="mt-2 text-xl font-semibold">Create, target, and launch</h3>
                </div>
                <div className="space-y-10">
                  {ADVERTISER_STEPS.map((step, i) => (
                    <div key={step.title} className="relative flex gap-6 lg:gap-8">
                      <StepCard step={i + 1} {...step} />
                    </div>
                  ))}

                </div>
              </div>

              <div>
                <div className="text-center lg:text-left mb-10">
                  <p className="text-eyebrow">For Publishers</p>
                  <h3 className="mt-2 text-xl font-semibold">Add, install, and earn</h3>
                </div>
                <div className="space-y-10">
                  {PUBLISHER_STEPS.map((step, i) => (
                    <div key={step.title} className="relative flex gap-6 lg:gap-8">
                      <StepCard step={i + 1} {...step} />
                    </div>
                  ))}

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ad Formats */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center">
              <p className="text-eyebrow">Ad Formats</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Formats that fit every screen
              </h2>
              <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
                From classic banners to responsive ads that adapt to any container, we support the
                formats your audience expects.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AD_FORMATS.map((format) => (
                <div
                  key={format.title}
                  className="group relative overflow-hidden rounded-xl border border-border bg-background p-6 shadow-sm transition-all hover:shadow-md hover:border-accent/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <format.icon className="size-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{format.size}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{format.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{format.description}</p>
                  <div className="mt-4 h-16 rounded-lg bg-muted/50 flex items-center justify-center">
                    <div className="w-full max-w-[80%] h-8 rounded bg-primary/20 border border-dashed border-primary/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Targeting */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <p className="text-eyebrow">Targeting</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Reach the audience that matters.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Target by country, county, city, device, browser, operating system, website
                  category, and schedule. Your campaigns reach the right people at the right time.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {TARGETING_OPTIONS.map((option) => (
                    <div
                      key={option.label}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm"
                    >
                      <option.icon className="size-4 text-accent" />
                      <span className="font-medium text-foreground">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-l from-accent/10 to-primary/10 blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card p-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="text-sm font-medium text-foreground">Audience Targeting</div>
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" />
                      Active
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Country", value: "Kenya, Nigeria, South Africa" },
                      { label: "Device", value: "Mobile, Desktop, Tablet" },
                      { label: "Browser", value: "Chrome, Safari, Firefox" },
                      { label: "OS", value: "Android, iOS, Windows, macOS" },
                      { label: "Category", value: "News, Sports, Entertainment" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Publisher Trust Section */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center mb-12">
              <p className="text-eyebrow">For Publishers</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Why Publishers Choose TradeMall
              </h2>
              <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
                Fast approval, simple integration, and transparent earnings. No unnecessary
                complexity.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Rocket,
                  title: "Fast website approval",
                  description: "Streamlined verification to get your site live quickly.",
                },
                {
                  icon: Settings,
                  title: "Simple one-line integration",
                  description: "Copy, paste, and start serving ads in minutes.",
                },
                {
                  icon: Wallet,
                  title: "Transparent earnings",
                  description: "Track every impression and click in real time.",
                },
                {
                  icon: Globe2,
                  title: "Local payment options",
                  description: "Receive payouts through methods designed for Africa.",
                },
                {
                  icon: BarChart3,
                  title: "Detailed analytics",
                  description: "Monitor impressions, clicks, CTR, eCPM, and revenue.",
                },
                {
                  icon: ShieldCheck,
                  title: "Publisher policy center",
                  description: "Clear guidelines on placement, content, and traffic quality.",
                },
                {
                  icon: Users,
                  title: "Human support",
                  description: "Real people ready to help you succeed.",
                },
                {
                  icon: Zap,
                  title: "No unnecessary complexity",
                  description: "Designed to be straightforward for publishers of any size.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="pt-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                      <item.icon className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Advertiser Trust Section */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center mb-12">
              <p className="text-eyebrow">For Advertisers</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Reach the Right Audience
              </h2>
              <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
                Precision targeting, real-time analytics, and tools to protect your brand and
                budget.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Globe2,
                  title: "Country, County, City Targeting",
                  description:
                    "Reach users at the geographic level that matters for your business.",
                },
                {
                  icon: Smartphone,
                  title: "Device, Browser, OS",
                  description:
                    "Target mobile, desktop, and tablet users across all major platforms.",
                },
                {
                  icon: Globe,
                  title: "Website Category",
                  description: "Show your ads alongside content that matches your brand.",
                },
                {
                  icon: Calendar,
                  title: "Schedule",
                  description: "Run campaigns on your timeline with date and time controls.",
                },
                {
                  icon: BarChart3,
                  title: "Campaign Analytics",
                  description: "Track impressions, clicks, CTR, CPC, CPM, spend, and revenue.",
                },
                {
                  icon: ShieldCheck,
                  title: "Brand Safety",
                  description: "Advertiser controls to exclude categories and manage placements.",
                },
                {
                  icon: Zap,
                  title: "Fraud Detection",
                  description: "Invalid traffic protection and click fraud detection built in.",
                },
                {
                  icon: MousePointerClick,
                  title: "Website Controls",
                  description: "Review and manage where your ads appear across the network.",
                },
                {
                  icon: Target,
                  title: "CPC & CPM Campaigns",
                  description: "Choose the pricing model that fits your goals.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="pt-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                      <item.icon className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Fraud & Brand Safety */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <p className="text-eyebrow">Trust & Safety</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Built for Quality Traffic
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  TradeMall invests in traffic quality and brand safety to protect advertiser
                  budgets and maintain a healthy marketplace for publishers.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    {
                      title: "Invalid Traffic Detection",
                      description:
                        "Automated systems identify and filter suspicious traffic patterns.",
                    },
                    {
                      title: "Click Fraud Protection",
                      description:
                        "Detects and prevents fraudulent clicks from draining your budget.",
                    },
                    {
                      title: "Publisher Monitoring",
                      description: "Continuous review of publisher quality and compliance.",
                    },
                    {
                      title: "Ad Reporting",
                      description:
                        "Detailed logs and reports for impressions, clicks, and traffic sources.",
                    },
                    {
                      title: "Website Policy Enforcement",
                      description: "Clear standards for site quality, content, and ad placement.",
                    },
                    {
                      title: "Advertiser Brand Safety",
                      description: "Tools to exclude categories and manage where your ads appear.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success mt-0.5">
                        <CheckCircle2 className="size-3.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="text-sm font-medium text-foreground">Traffic Quality & Safety</div>
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="size-3.5" />
                      Monitoring Active
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Invalid Traffic Detection", value: "Automated filtering" },
                      { label: "Click Fraud Protection", value: "Real-time analysis" },
                      { label: "Publisher Monitoring", value: "Continuous review" },
                      { label: "Ad Reporting", value: "Detailed logs available" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Payout Transparency */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="rounded-2xl border border-border bg-background p-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Payout Overview</div>
                      <div className="text-xs text-muted-foreground">Transparent publisher earnings</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Revenue share</div>
                      <div className="text-sm font-semibold text-success">Configured per account</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Billing Events", value: "Impressions, Clicks" },
                      { label: "Earnings Hold", value: "Configurable hold period" },
                      { label: "Minimum Payout", value: "Configured per region" },
                      { label: "Payment Methods", value: "Local and international options" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-eyebrow">For Publishers</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Get Paid for Your Traffic
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Earn revenue for every impression and click. Track your earnings in real time and
                  receive payouts through local payment methods.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "Revenue share on every impression",
                    "Real-time earnings tracking",
                    "Local payment options",
                    "Transparent reporting",
                    "Reliable payout schedule",
                    "No hidden deductions",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
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
        </section>

        {/* Africa Positioning */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-eyebrow">Built for Africa</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Local audiences. Local advertisers. Local payment options.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                TradeMall is purpose-built for Africa's digital ecosystem. We understand the unique
                needs of businesses and publishers across the continent. From Nairobi to Lagos,
                Johannesburg to Kigali, we're building the advertising infrastructure that African
                markets deserve.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {["Kenya", "Nigeria", "South Africa", "Uganda", "Tanzania", "Ghana", "Rwanda"].map(
                  (country) => (
                    <span
                      key={country}
                      className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {country}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Transparency */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="text-center mb-12">
              <p className="text-eyebrow">Trust & Transparency</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built on honest infrastructure
              </h2>
              <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
                TradeMall is designed with transparency at its core. Here is how the platform works for both sides of the marketplace.
              </p>
            </div>
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <h3 className="text-xl font-semibold mb-4">For Advertisers</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">How you are charged</h4>
                      <p className="text-sm text-muted-foreground">Advertisers are charged on a per-impression (CPM) or per-click (CPC) basis. All charges are logged in real time and visible in your campaign dashboard.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Brand safety</h4>
                      <p className="text-sm text-muted-foreground">Block categories, exclude specific publishers, and manage placements. Every ad appearance is logged for accountability.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Invalid traffic policy</h4>
                      <p className="text-sm text-muted-foreground">We filter suspicious traffic and protect your budget from fraudulent clicks. If invalid traffic is detected, charges are reversed.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Advertiser policies</h4>
                      <p className="text-sm text-muted-foreground">All ads are reviewed for compliance with our content, creative, and landing page policies before going live.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">For Publishers</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">How you earn</h4>
                      <p className="text-sm text-muted-foreground">Publishers earn a share of revenue generated from impressions and clicks on their ad zones. Earnings are calculated in real time.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Revenue share</h4>
                      <p className="text-sm text-muted-foreground">Revenue share percentages are configured per publisher account. Transparent reporting shows exactly how earnings are calculated.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Minimum payout & schedule</h4>
                      <p className="text-sm text-muted-foreground">Payouts are processed on a regular schedule once earnings exceed the minimum threshold. Local and international payment methods are supported.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Website approval</h4>
                      <p className="text-sm text-muted-foreground">Websites are reviewed for content quality, traffic authenticity, and policy compliance before being approved for ad serving.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
