import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/policies/publisher-guidelines")({
  head: () => pageMetadata({
    title: "Publisher Guidelines — TradeMall",
    description:
      "TradeMall publisher guidelines covering website eligibility, ad placement, traffic quality, and policy enforcement.",
    path: "/policies/publisher-guidelines",
    image: "/trademall-logo.png",
  }),
  component: PublisherGuidelinesPage,
});

function PublisherGuidelinesPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-eyebrow">For Publishers</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Publisher Guidelines
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: August 20, 2026
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            These guidelines help publishers maintain a healthy, compliant, and
            sustainable presence on TradeMall. All publishers must review and
            follow these requirements to remain eligible for the platform.
          </p>

          <div className="mt-12 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Website Eligibility
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Publishers must own or have explicit authorization to monetize
                  every submitted website. TradeMall reserves the right to verify
                  ownership through DNS records, HTML tags, file uploads, or
                  other verification methods.
                </p>
                <p>Eligible websites must:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Have original, useful, and well-organized content.</li>
                  <li>Load reliably and render correctly across devices.</li>
                  <li>Not be primarily designed to generate artificial ad revenue.</li>
                  <li>Comply with applicable laws and content standards.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Website Approval Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Before serving ads, each website must be reviewed and approved
                  by TradeMall. Approval criteria include content quality,
                  traffic legitimacy, user experience, and compliance with these
                  guidelines.
                </p>
                <p>
                  Submission does not guarantee approval. TradeMall may reject,
                  suspend, or remove websites at its discretion.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Prohibited Publisher Content
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Publishers must not host, link to, or distribute content that:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Violates applicable law or regulations.</li>
                  <li>Infringes intellectual property rights.</li>
                  <li>Contains malware, phishing, or deceptive practices.</li>
                  <li>Promotes hate, violence, or illegal activities.</li>
                  <li>Is adult-oriented or sexually explicit.</li>
                  <li>Encourages self-clicking or artificial engagement.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Traffic Quality Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  TradeMall requires legitimate, human traffic. The following
                  traffic types are strictly prohibited:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Bot traffic or automated visitors.</li>
                  <li>Artificial impressions or clicks.</li>
                  <li>Click farms or incentivized clicking.</li>
                  <li>Self-clicking or manipulation of ad metrics.</li>
                  <li>Traffic purchased for the purpose of generating artificial revenue.</li>
                  <li>Deceptive or forced ad interactions.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Ad Placement Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Ad zones must be implemented according to TradeMall&apos;s
                  specifications. Proper placement ensures a good experience for
                  visitors and maintains advertiser trust.
                </p>
                <p>Publishers must:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Place ads where they are clearly visible to real users.</li>
                  <li>Avoid placing ads on 404 pages, pop-ups, or hidden elements.</li>
                  <li>Not mislead users into clicking ads.</li>
                  <li>Maintain reasonable ad density relative to page content.</li>
                  <li>Not place ads too close to navigational elements or misleading containers.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Publisher Responsibilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>Publishers are responsible for:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Maintaining accurate account and payout information.</li>
                  <li>Complying with all platform policies and updates.</li>
                  <li>Promptly reporting security issues or policy violations.</li>
                  <li>Ensuring ad code is not modified in ways that violate guidelines.</li>
                  <li>Responding to TradeMall support requests within a reasonable timeframe.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Policy Enforcement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  TradeMall uses a graduated enforcement approach. Violations may
                  result in warnings, account restrictions, reduced serving, or
                  account suspension depending on severity and frequency.
                </p>
                <p>
                  In cases of severe or repeated violations, TradeMall may
                  terminate publisher access without prior notice.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Appeals and Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  If you believe an enforcement action was made in error, you may
                  request a review by contacting our support team. Provide
                  relevant details and supporting documentation for the fastest
                  resolution.
                </p>
                <div className="mt-4">
                  <Button asChild variant="outline">
                    <Link to="/contact">
                      Contact Support
                      <ArrowRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/terms">Terms of Service</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/privacy">Privacy Policy</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/policies/invalid-traffic">Invalid Traffic Policy</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/policies/ad-placement">Ad Placement Guidelines</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
