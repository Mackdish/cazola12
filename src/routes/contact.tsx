import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Mail, MapPin, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicLayout } from "@/components/layout/public-layout";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — TradeMall" },
      {
        name: "description",
        content:
          "Get in touch with TradeMall. We're here to help with advertising, publishing, and platform questions.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Thanks for reaching out! Our team will get back to you within 24 hours.");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  };

  return (
    <PublicLayout>
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-eyebrow">Contact</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Have questions about advertising, publishing, or platform features? Reach out and our
              team will help you get started.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="How can we help?"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us more..."
                      rows={5}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    Send Message
                    <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="size-5 text-accent" />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">support@trademall.co.ke</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-5 text-accent" />
                    Offices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Nairobi, Kenya — Lagos, Nigeria — Johannesburg, South Africa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-5 text-accent" />
                    Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    For account and billing questions, visit the{" "}
                    <Link to="/help" className="text-primary hover:underline">
                      Help Center
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground">Enterprise & Sales</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  For custom pricing, dedicated support, and enterprise solutions, contact our sales
                  team.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
