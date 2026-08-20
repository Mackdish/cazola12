import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Globe2,
  Handshake,
  Heart,
  Lightbulb,
  Mail,
  Megaphone,
  Phone,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Eye,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => pageMetadata({
    title: "About Us — TradeMall",
    description:
      "TradeMall is building the future of digital commerce and advertising in Africa. Learn our story, mission, and vision.",
    path: "/about",
    image: "/trademall-logo.png",
  }),
  component: AboutPage,
});

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Transparency",
    description:
      "We believe people should understand how the platforms and systems they use work.",
  },
  {
    icon: TrendingUp,
    title: "Opportunity",
    description:
      "Technology should create opportunities for businesses and digital entrepreneurs, not only large corporations.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description:
      "We continuously look for better ways to solve problems and improve the digital experience.",
  },
  {
    icon: ShieldCheck,
    title: "Trust",
    description:
      "Strong ecosystems are built through reliability, accountability, and responsible practices.",
  },
  {
    icon: Zap,
    title: "Growth",
    description:
      "We want our technology to help businesses and digital platforms move forward.",
  },
];

const APPROACH_PRINCIPLES = [
  {
    icon: Zap,
    title: "Simple",
    description:
      "We remove unnecessary complexity from digital advertising and commerce.",
  },
  {
    icon: Target,
    title: "Useful",
    description:
      "Every feature should solve a real problem or create meaningful value.",
  },
  {
    icon: Users,
    title: "Connected",
    description:
      "We believe businesses, publishers, and audiences are stronger when they can participate in one ecosystem.",
  },
  {
    icon: Handshake,
    title: "Responsible",
    description:
      "Trust, transparency, quality, and responsible technology are fundamental to what we are building.",
  },
];

const PROBLEMS = [
  {
    icon: Globe2,
    title: "Fragmented Advertising",
    description:
      "Businesses often have to navigate multiple tools and platforms to reach their audiences.",
  },
  {
    icon: Wallet,
    title: "Limited Opportunities",
    description:
      "Many publishers and digital platforms struggle to turn their audiences into sustainable revenue.",
  },
  {
    icon: TrendingUp,
    title: "Growing Businesses",
    description:
      "Smaller and growing businesses need accessible digital tools to compete in an increasingly online economy.",
  },
];

function AboutPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
            <div className="max-w-3xl">
              <p className="text-eyebrow">About TradeMall</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Building the Future of Digital Commerce and{" "}
                <span className="text-accent">Advertising</span>
              </h1>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                TradeMall was created with a simple belief: businesses deserve better ways to
                connect with customers, and digital platforms deserve better opportunities to
                create value. We are building technology that brings these opportunities
                together in one connected ecosystem.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/advertisers">
                    Explore TradeMall
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-8">
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto">
              <p className="text-eyebrow">Our Story</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Why TradeMall Exists
              </h2>
              <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  The internet has transformed how people discover businesses, products, and
                  services. Yet many businesses still struggle to reach the right customers
                  online, while countless digital platforms have audiences that remain
                  underutilized.
                </p>
                <p>
                  We saw an opportunity to build a platform that brings these two sides closer
                  together.
                </p>
                <p>
                  TradeMall is being developed to make the digital advertising and commerce
                  ecosystem more accessible, transparent, and useful for businesses,
                  publishers, and the audiences they serve.
                </p>
                <p>
                  Our journey is focused on building technology that removes unnecessary
                  complexity and creates meaningful connections between businesses and people.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem We Are Solving */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-eyebrow">The Challenge</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                A Better Digital Ecosystem
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                We identified three core challenges that inspired TradeMall.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {PROBLEMS.map((problem) => (
                <Card key={problem.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <problem.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-3">{problem.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {problem.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-12 max-w-3xl mx-auto text-center">
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                TradeMall is designed to bring these opportunities closer together through
                technology, data, and a connected digital ecosystem.
              </p>
            </div>
          </div>
        </section>

        {/* Our Approach */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-eyebrow">Our Approach</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built Around People, Not Just Technology
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Technology is only useful when it solves real problems. That's why TradeMall
                focuses on building practical tools that are easy to understand, accessible to
                businesses of different sizes, and valuable to the people using them.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {APPROACH_PRINCIPLES.map((principle) => (
                <Card key={principle.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <principle.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-3">{principle.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {principle.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Our Ambition */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-eyebrow">Our Ambition</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                From Kenya to a Connected African Digital Economy
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  TradeMall is being built in Kenya with an ambition that extends beyond one
                  market.
                </p>
                <p>
                  Africa has a rapidly growing digital population, innovative entrepreneurs,
                  emerging businesses, and an increasingly connected consumer economy.
                </p>
                <p>
                  We want to contribute to that growth by building technology that enables
                  businesses and digital platforms to participate more effectively in the online
                  economy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Principles */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-eyebrow">Our Principles</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                What guides everything we build
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                These principles shape our decisions, our product, and how we work with the
                people and businesses on our platform.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((principle) => (
                <Card key={principle.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <principle.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-3">{principle.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {principle.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Looking Ahead */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-eyebrow">Looking Ahead</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                We're Just Getting Started
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <p>
                  TradeMall is still on its journey. We are continuously improving the
                  platform, listening to the people who use it, and exploring new ways
                  technology can create value in the digital economy.
                </p>
                <p>
                  Our long-term goal is bigger than building another advertising platform. We
                  want to build infrastructure that helps businesses, publishers, and digital
                  entrepreneurs participate in the next generation of commerce and advertising.
                </p>
              </div>
              <p className="mt-8 text-lg font-semibold text-foreground">
                The future is digital. We're building for it.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-border bg-card">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Be Part of the Journey
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Whether you're building a business, creating digital experiences, or looking
                for better ways to connect with customers, there's a place for you in the
                TradeMall ecosystem.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/advertisers">
                    Explore TradeMall
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-8">
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-eyebrow">Contact</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Get in touch
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Have questions about advertising, publishing, or platform features? Reach out
                and our team will help you get started.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-6">
                <a
                  href="tel:+254705186502"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="size-4" />
                  0705186502
                </a>
                <a
                  href="mailto:support@trademall.co.ke"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="size-4" />
                  support@trademall.co.ke
                </a>
              </div>
              <div className="mt-8">
                <Button asChild size="lg" className="h-11 px-8">
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
