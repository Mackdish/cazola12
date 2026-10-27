import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/patterns/states";
import { useAuth } from "@/lib/auth-context";
import type { FriendlyError } from "@/lib/errors";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — TradeMall" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Request a secure password reset link for your TradeMall ad network account.",
      },
      { property: "og:title", content: "Reset your password — TradeMall" },
      {
        property: "og:description",
        content: "Request a secure password reset link for your TradeMall account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (result) {
      setError(result);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {sent ? (
          <div className="panel space-y-3 p-6 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
              <MailCheck className="size-5" />
            </div>
            <h1 className="text-lg font-semibold">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium">{email}</span>, we've sent a
              password reset link.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className="text-eyebrow">Account recovery</p>
              <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                We'll email you a secure link to choose a new password.
              </p>
            </div>
            {error ? <ErrorState title={error.title} message={error.message} /> : null}
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(fieldError)}
                />
                {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Send reset link
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
