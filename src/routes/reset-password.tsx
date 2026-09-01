import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/patterns/states";
import { useAuth } from "@/lib/auth-context";
import type { FriendlyError } from "@/lib/errors";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — TradeMall" },
      {
        name: "description",
        content: "Set a new password for your TradeMall ad network account.",
      },
      { property: "og:title", content: "Choose a new password — TradeMall" },
      {
        property: "og:description",
        content: "Set a new password for your TradeMall account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { session, initializing, updatePassword, homePath } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    setIsRecovery(hash.includes("type=recovery") || hash.includes("access_token"));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setFieldError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Both passwords must match.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result) {
      setError(result);
      return;
    }
    toast.success("Password updated", { description: "You're signed in with your new password." });
    void navigate({ to: homePath, replace: true });
  }

  const linkMissing = !initializing && !session && !isRecovery;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5">
          <p className="text-eyebrow">Account recovery</p>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Pick something strong — at least 8 characters.
          </p>
        </div>

        {linkMissing ? (
          <ErrorState
            title="Reset link invalid or expired"
            message="Request a fresh password reset link and try again."
          />
        ) : null}
        {error ? <ErrorState title={error.title} message={error.message} /> : null}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldError)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={Boolean(fieldError)}
            />
            {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={submitting || linkMissing}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Update password
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </form>
      </div>
    </main>
  );
}
