import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Globe,
  Globe2,
  MapPin,
  Megaphone,
  Monitor,
  Rocket,
  Settings,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";
import { Reveal } from "@/components/landing/reveal";
import { PlatformMetrics } from "@/components/landing/platform-metrics";
import { NetworkFlow } from "@/components/landing/network-flow";
import { AdFormatExplorer } from "@/components/landing/ad-format-explorer";
import { EarningsCalculator } from "@/components/landing/earnings-calculator";
import { TrustTabs } from "@/components/landing/trust-tabs";
import {
  AdvertiserDashboardMock,
  PublisherDashboardMock,
  AnalyticsChartMock,
} from "@/components/landing/product-mockups";

export const Route = createFileRoute("/")({
  head: () =>
    pageMetadata({
      title: "TradeMall — Built for Africa's Digital Ecosystem",
      description:
        "TradeMall is a premium digital advertising platform built for Africa. Advertise to local audiences or monetize your website with transparent, data-driven tools.",
      path: "/",
      image: "/trademall-logo.png",
    }),
  component: Landing,
});

const ADVERTISER_STEPS = [
  {
    icon: Rocket,
    title: "Create your campaign",
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

function StepRow({
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
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <div className="mt-2 w-px flex-1 bg-border last:hidden" />
      </div>
      <div className="pb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">{`Step ${step}`}</div>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-mkt-blue/5 to-transparent" />
        <div
          className="absolute -top-24 right-0 -z-10 size-[32rem] rounded-full bg-gradient-to-br from-mkt-blue/20 to-mkt-indigo/10 blur-3xl animate-mkt-float-slow"
          aria-hidden
        />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
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
                TradeMall is the advertising marketplace built for Africa. Advertisers reach
                targeted audiences across Kenya, Nigeria, South Africa, Uganda, Tanzania, Ghana, and
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
                    Monetize Your Website
                    <ChevronRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-mkt-blue/20 blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
                  <p className="text-eyebrow">The TradeMall ecosystem</p>
                  <div className="mt-5 flex items-center justify-between gap-2">
                    {[
                      { icon: Megaphone, label: "Advertisers" },
                      { icon: ChevronRight, label: "" },
                      { icon: Globe2, label: "Publishers" },
                      { icon: ChevronRight, label: "" },
                      { icon: TrendingUp, label: "Audiences" },
                    ].map((item, i) =>
                      item.label ? (
                        <div
                          key={item.label}
                          className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-background p-3 text-center animate-mkt-float"
                          style={{ animationDelay: `${i * 0.4}s` }}
                        >
                          <item.icon className="size-5 text-accent" />
                          <span className="text-xs font-medium text-muted-foreground">
                            {item.label}
                          </span>
                        </div>
                      ) : (
                        <ChevronRight
                          key={i}
                          className="size-4 shrink-0 text-muted-foreground/50"
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    TradeMall connects the two sides of the marketplace
                  </p>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      { icon: BarChart3, label: "Analytics" },
                      { icon: Target, label: "Targeting" },
                      { icon: ShieldCheck, label: "Brand Safety" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-3 text-center"
                      >
                        <item.icon className="size-4 text-primary" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Metrics */}
      <section className="relative overflow-hidden bg-mkt-navy py-16 sm:py-20">
        <div className="absolute inset-0 -z-10 bg-mkt-grid opacity-40" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="text-center">
            <p className="text-eyebrow text-slate-400">Right now on TradeMall</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              A growing marketplace, in real numbers
            </h2>
          </Reveal>
          <div className="mt-10">
            <PlatformMetrics />
          </div>
        </div>
      </section>

      {/* How TradeMall Works */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <Reveal className="text-center mb-12">
            <p className="text-eyebrow">How TradeMall Works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start in minutes
            </h2>
          </Reveal>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <p className="text-eyebrow mb-6">For Advertisers</p>
              <div>
                {ADVERTISER_STEPS.map((step, i) => (
                  <StepRow key={step.title} step={i + 1} {...step} />
                ))}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <p className="text-eyebrow mb-6">For Publishers</p>
              <div>
                {PUBLISHER_STEPS.map((step, i) => (
                  <StepRow key={step.title} step={i + 1} {...step} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Advertiser Product Showcase */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-mkt-blue/5 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <Reveal>
              <p className="text-eyebrow">For Advertisers</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Put your business in front of the right audience.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Create targeted campaigns, choose from multiple ad formats, and reach customers by
                country, city, device, and browser. Track every impression, click, and conversion
                from the same dashboard.
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
            </Reveal>
            <Reveal delay={120}>
              <AdvertiserDashboardMock />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Publisher Monetization */}
      <section className="bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <Reveal className="order-2 lg:order-1">
              <PublisherDashboardMock />
            </Reveal>
            <Reveal delay={120} className="order-1 lg:order-2">
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* Network Visualization */}
      <section className="relative overflow-hidden bg-mkt-navy-deep py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-mkt-drift opacity-30" aria-hidden />
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="text-center">
            <p className="text-eyebrow text-slate-400">The TradeMall Network</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              One marketplace, connecting both sides
            </h2>
            <p className="mt-4 text-base text-slate-400 max-w-2xl mx-auto">
              Advertiser budgets flow into publisher earnings, matched by targeting and served to
              real audiences — tracked end to end.
            </p>
          </Reveal>
          <Reveal delay={150} className="mt-16">
            <NetworkFlow />
          </Reveal>
        </div>
      </section>

      {/* Ad Format Explorer */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <Reveal className="text-center mb-12">
            <p className="text-eyebrow">Ad Formats</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Formats that fit every screen
            </h2>
            <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
              From classic banners to responsive ads that adapt to any container, explore the
              formats your audience expects.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <AdFormatExplorer />
          </Reveal>
        </div>
      </section>

      {/* Targeting */}
      <section className="relative overflow-hidden border-y border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-mkt-indigo/5 via-transparent to-primary/5" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <Reveal>
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
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <option.icon className="size-4 text-accent" />
                    <span className="font-medium text-foreground">{option.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120} className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-l from-mkt-indigo/10 to-primary/10 blur-2xl" />
              <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <Reveal>
              <p className="text-eyebrow">Analytics</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                See exactly what's working.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Every impression, click, and conversion is tracked in real time. Advertisers see
                CTR, CPC, CPM, spend, and revenue; publishers see earnings by site and zone.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Real-time impressions & clicks",
                  "CTR, CPC, CPM breakdowns",
                  "Spend & revenue tracking",
                  "Per-site, per-zone detail",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <AnalyticsChartMock />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <section className="relative overflow-hidden border-y border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-success/5 via-transparent to-mkt-emerald/5" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <Reveal>
              <p className="text-eyebrow">For Publishers</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Estimate what your traffic could earn.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Drag the slider to match your monthly pageviews and see an estimate based on
                TradeMall's current, real rate card — the same numbers shown on our{" "}
                <Link to="/pricing" className="text-primary underline underline-offset-4">
                  pricing page
                </Link>
                .
              </p>
            </Reveal>
            <Reveal delay={120}>
              <EarningsCalculator />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <Reveal className="text-center mb-12">
            <p className="text-eyebrow">Trust & Transparency</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built on honest infrastructure
            </h2>
            <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
              TradeMall is designed with transparency at its core, for both sides of the
              marketplace.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <TrustTabs />
          </Reveal>
        </div>
      </section>

      {/* Partnership */}
      <section className="relative overflow-hidden border-y border-border bg-card/50">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-mkt-blue/5" aria-hidden />
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-20">
          <Reveal className="text-center">
            <p className="text-eyebrow">Our Partner</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Powering seamless payments
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              TradeMall partners with PayzaAPI to support a reliable, locally focused payment experience for our growing African digital ecosystem.
            </p>
          </Reveal>

          <Reveal delay={100} className="mt-10">
            <a
              href="https://payzaapi.co.ke"
              target="_blank"
              rel="noreferrer noopener"
              className="group mx-auto flex max-w-xl flex-col items-center gap-5 rounded-2xl border border-border bg-background p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg sm:flex-row sm:text-left"
              aria-label="Visit PayzaAPI website"
            >
              <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border bg-black p-2 sm:size-28">
                <img
                  src="/payzaapi-logo.webp"
                  alt="PayzaAPI logo"
                  className="size-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h3 className="text-xl font-semibold text-foreground">PayzaAPI</h3>
                  <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Payment technology partner</p>
                <p className="mt-3 text-sm font-medium text-primary">payzaapi.co.ke</p>
              </div>
            </a>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-mkt-navy py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-mkt-grid opacity-30" aria-hidden />
        <div
          className="absolute -bottom-24 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-mkt-blue/25 via-mkt-indigo/20 to-mkt-emerald/20 blur-3xl"
          aria-hidden
        />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-eyebrow text-slate-400">Built for Africa</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Local audiences. Local advertisers. Local payment options.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              From Nairobi to Lagos, Johannesburg to Kigali — start advertising or start monetizing
              your website today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-8">
                <Link to="/auth">
                  Start Advertising
                  <ChevronRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/auth">
                  Monetize Your Website
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              {["Kenya", "Nigeria", "South Africa", "Uganda", "Tanzania", "Ghana", "Rwanda"].map(
                (country) => (
                  <span
                    key={country}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
                  >
                    {country}
                  </span>
                ),
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
