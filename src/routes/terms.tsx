import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => pageMetadata({
    title: "Terms of Service — TradeMall",
    description: "TradeMall terms of service. Rules and agreements for using the platform.",
    path: "/terms",
    image: "/trademall-logo.png",
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="text-eyebrow">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: August 2026
          </p>

          <div className="mt-12 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Acceptance of Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  By accessing or using TradeMall, you agree to be bound by these Terms of Service
                  and all applicable laws and regulations. If you do not agree, you may not use the
                  platform.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are responsible for maintaining the confidentiality of your account
                  credentials and for all activities under your account. Notify us immediately of
                  any unauthorized access.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Acceptable Use
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You agree not to misuse the platform or assist others in doing so. This includes
                  attempting to gain unauthorized access, interfering with platform operations, or
                  violating applicable laws.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Limitation of Liability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  TradeMall is provided on an as-is basis. We do not guarantee uninterrupted or
                  error-free service. To the fullest extent permitted by law, TradeMall shall not be
                  liable for indirect, incidental, or consequential damages.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Changes to Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  We may update these terms from time to time. Continued use of the platform after
                  changes constitutes acceptance of the updated terms.
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
