import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/policies/ad-placement")({
  head: () => pageMetadata({
    title: "Ad Placement Guidelines — TradeMall",
    description:
      "TradeMall ad placement guidelines for publishers covering visibility, density, and prohibited implementations.",
    path: "/policies/ad-placement",
    image: "/trademall-logo.png",
  }),
  component: AdPlacementPage,
});

function AdPlacementPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-eyebrow">Ad Policies</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Ad Placement Guidelines
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: August 20, 2026
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Proper ad placement ensures a good experience for website visitors
            and maintains advertiser confidence. These guidelines describe
            acceptable and prohibited ad implementations on publisher websites.
          </p>

          <div className="mt-12 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Ad Visibility Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>Ads must be clearly visible to real users without deception.</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Do not place ads on empty pages, 404 pages, or interstitial-only flows.</li>
                  <li>Do not hide ads using CSS techniques such as opacity, display:none, or off-screen positioning.</li>
                  <li>Do not place ads in containers that mimic system or navigation UI.</li>
                  <li>Avoid placing ads so close to navigational elements that users are likely to click accidentally.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Ad Density Guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Pages should maintain a reasonable balance between content and
                  advertising. Excessive ad density degrades user experience and
                  may violate platform standards.
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Ensure ads do not overwhelm primary page content.</li>
                  <li>Avoid stacking multiple ads above the fold without sufficient content.</li>
                  <li>Respect mobile viewport constraints and avoid intrusive interstitials.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Prohibited Ad Implementation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>The following implementations are not allowed:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Auto-refreshing ads without clear user action.</li>
                  <li>Ads triggered by mouse movement, hover, or unrelated user actions.</li>
                  <li>Ad placement that mimics download buttons, navigation arrows, or close icons.</li>
                  <li>Ad injection into pages or placements not approved by TradeMall.</li>
                  <li>Modification of TradeMall ad code beyond permitted customization.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Misleading Ad Placement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                <p>
                  Ads must not be placed in a way that deceives or misleads
                  users. deceptive practices erode trust and may result in
                  account enforcement.
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Do not disguise ads as editorial content or system messages.</li>
                  <li>Do not label ads in a way that contradicts their commercial nature.</li>
                  <li>Do not place ads in a manner that suggests endorsement by TradeMall or advertisers.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/policies/publisher-guidelines">Publisher Guidelines</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/policies/invalid-traffic">Invalid Traffic Policy</Link>
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
