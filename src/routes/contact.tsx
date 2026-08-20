import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowRight, ChevronRight, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicLayout } from "@/components/layout/public-layout";
import { toast } from "sonner";
import { pageMetadata } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email address").max(254),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
  website: z.string().max(0, "Honeypot must be empty").optional(),
});

export const Route = createFileRoute("/contact")({
  head: () => pageMetadata({
    title: "Contact — TradeMall",
    description:
      "Get in touch with TradeMall. We're here to help with advertising, publishing, and platform questions.",
    path: "/contact",
    image: "/trademall-logo.png",
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitted(false);

    const websiteValue = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value || "";

    const formData = {
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      website: websiteValue,
    };

    const parsed = contactSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0];
      setError(firstError || "Please check your input.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("submit-contact", {
        body: {
          name: parsed.data.name,
          email: parsed.data.email,
          subject: parsed.data.subject,
          message: parsed.data.message,
        },
      });

      if (invokeError || !data?.ok) {
        const message = data?.message || invokeError?.message || "Something went wrong. Please try again.";
        throw new Error(message);
      }

      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      toast.success(data.message || "Thanks for reaching out! Our team will get back to you within 24 hours.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
                {submitted ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Message sent successfully
                    </p>
                    <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                      Our team will get back to you within 24 hours.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setSubmitted(false)}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Your name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us more..."
                        rows={5}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <input
                      type="text"
                      name="website"
                      className="hidden"
                      value=""
                      autoComplete="off"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                      {submitting ? "Sending..." : "Send Message"}
                      {!submitting && <ArrowRight className="ml-1.5 size-4" />}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="size-5 text-accent" />
                    Phone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href="tel:+254705186502"
                    className="text-sm text-primary hover:underline"
                  >
                    0705186502
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="size-5 text-accent" />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href="mailto:support@trademall.co.ke"
                    className="text-sm text-primary hover:underline"
                  >
                    support@trademall.co.ke
                  </a>
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

