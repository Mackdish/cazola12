import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";

import { PublicLayout } from "@/components/layout/public-layout";
import { pageMetadata } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () =>
    pageMetadata({
      title: "Contact Us — TradeMall",
      description:
        "Get in touch with TradeMall support. Email support@trademall.co.ke or call +254 705 186 502.",
      path: "/contact",
      image: "/trademall-logo.png",
    }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">Contact Us</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              We&apos;re here to help
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Have a question about advertising, publishing, or your account? Reach out to our
              support team directly.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            <Link
              to="mailto:support@trademall.co.ke"
              className="flex items-start gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/50"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Mail className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  support@trademall.co.ke
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  We typically respond within one business day.
                </p>
              </div>
            </Link>

            <a
              href="tel:+254705186502"
              className="flex items-start gap-4 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/50"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Phone className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Phone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  +254 705 186 502
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Available Monday – Friday, 9am – 5pm EAT.
                </p>
              </div>
            </a>
          </div>

          <div className="mt-16 rounded-lg border border-border bg-card p-8">
            <h2 className="text-lg font-semibold text-foreground">Frequently asked questions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Before reaching out, you may find the answer in our{" "}
              <Link to="/help" className="text-accent hover:underline">
                Help Center
              </Link>
              . It covers common topics for advertisers and publishers.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
