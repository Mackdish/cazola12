import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck, PanelsTopLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/patterns/states";
import { useAuth } from "@/lib/auth-context";
import type { FriendlyError } from "@/lib/errors";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TradeMall Ad Network" },
      {
        name: "description",
        content:
          "Sign in or create an TradeMall account to manage advertising campaigns or monetize your websites.",
      },
      { property: "og:title", content: "Sign in — TradeMall Ad Network" },
      {
        property: "og:description",
        content: "Access the TradeMall advertiser, publisher and platform admin workspaces.",
      },
    ],
  }),
  component: AuthPage,
});

type FieldErrors = Record<string, string>;

function validate(values: { email: string; password: string; fullName?: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) {
    errors["email"] = "Enter a valid email address.";
  }
  if (values.password.length < 8) {
    errors["password"] = "Use at least 8 characters.";
  }
  if (values.fullName !== undefined && values.fullName.trim().length < 2) {
    errors["fullName"] = "Tell us your full name.";
  }
  return errors;
}

function AuthPage() {
  const { session, initializing, homePath, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (!initializing && session && !loadingIdentity) void navigate({ to: homePath, replace: true });
  }, [initializing, session, loadingIdentity, homePath, navigate]);

  async function handleGoogle() {
    setFormError(null);
    setSubmitting(true);
    const error = await signInWithGoogle();
    if (error) {
      setFormError(error);
      setSubmitting(false);
    }
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate({ email, password });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const error = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setFormError(error);
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate({ email, password, fullName });
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) setConfirmationSent(true);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <PanelsTopLeft className="size-4" />
          </span>
          <span className="text-sm font-semibold text-sidebar-foreground">TradeMall</span>
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold text-sidebar-foreground">
            One network. Three sides of the market.
          </h2>
          <p className="text-sm leading-relaxed text-sidebar-foreground/70">
            Advertisers buy attention, publishers monetize inventory, and platform operators keep
            the marketplace healthy — with strict data isolation between every organization.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Access is enforced in the database, not just the interface.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          {confirmationSent ? (
            <div className="panel space-y-3 p-6 text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
                <MailCheck className="size-5" />
              </div>
              <h1 className="text-lg font-semibold">Confirm your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Click
                it to activate your account, then sign in.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setConfirmationSent(false);
                  setTab("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-eyebrow">TradeMall network</p>
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to your workspace or create a new account.
                </p>
              </div>

              {formError ? (
                <ErrorState title={formError.title} message={formError.message} />
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={handleGoogle}
              >
                <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.18 15.23 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="signin" className="flex-1">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form className="space-y-4" onSubmit={handleSignIn} noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(fieldErrors["email"])}
                      />
                      {fieldErrors["email"] ? (
                        <p className="text-xs text-destructive">{fieldErrors["email"]}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <Link
                          to="/forgot-password"
                          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <Input
                        id="signin-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={Boolean(fieldErrors["password"])}
                      />
                      {fieldErrors["password"] ? (
                        <p className="text-xs text-destructive">{fieldErrors["password"]}</p>
                      ) : null}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                      Sign in
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form className="space-y-4" onSubmit={handleSignUp} noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name">Full name</Label>
                      <Input
                        id="signup-name"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        aria-invalid={Boolean(fieldErrors["fullName"])}
                      />
                      {fieldErrors["fullName"] ? (
                        <p className="text-xs text-destructive">{fieldErrors["fullName"]}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email">Work email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(fieldErrors["email"])}
                      />
                      {fieldErrors["email"] ? (
                        <p className="text-xs text-destructive">{fieldErrors["email"]}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={Boolean(fieldErrors["password"])}
                      />
                      {fieldErrors["password"] ? (
                        <p className="text-xs text-destructive">{fieldErrors["password"]}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Minimum 12 characters with uppercase, lowercase, number, and special character.
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                      Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
