import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TradeMall" },
      {
        name: "description",
        content: "TradeMall privacy policy. Learn how we collect, use, and protect your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="text-eyebrow">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: August 2026
          </p>

          <div className="mt-12 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Information We Collect
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  We collect information necessary to operate the TradeMall platform, including
                  account details, website and campaign data, usage metrics, and payment
                  information.
                </p>
                <p>
                  Advertiser data includes campaign settings, targeting preferences, and performance
                  metrics. Publisher data includes website details, ad zone configurations, and
                  earnings information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  How We Use Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  We use collected information to operate, improve, and secure the platform. This
                  includes serving ads, measuring performance, preventing fraud, processing
                  payments, and providing support.
                </p>
                <p>
                  We do not sell personal data to third parties. Data sharing is limited to service
                  providers necessary for platform operations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Data Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  TradeMall implements industry-standard security measures to protect your data.
                  Access to sensitive information is restricted, and transmissions are encrypted
                  where applicable.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Your Rights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You may request access to, correction of, or deletion of your personal data.
                  Contact our support team to exercise these rights or ask questions about our
                  privacy practices.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12">
            <Button asChild variant="outline">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
