import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Globe, Megaphone, Rocket } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/patterns/page-header";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — TradeMall" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const steps = [
  { label: "Welcome" },
  { label: "Choose role" },
  { label: "First steps" },
  { label: "Complete" },
];

function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<"advertiser" | "publisher">("advertiser");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { createOrganization, user } = useAuth();

  useEffect(() => {
    if (step !== 3) return undefined;
    const timer = setTimeout(() => {
      void navigate({
        to: role === "advertiser" ? "/advertiser" : "/publisher",
        replace: true,
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [step, role, navigate]);

  async function handleContinue() {
    setCreateError(null);
    if (step === 1) {
      setCreating(true);
      try {
        const fullName = user?.user_metadata?.["full_name"] ?? user?.email ?? "User";
        const slug = `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
        const error = await createOrganization({
          name: `${fullName}'s ${role === "advertiser" ? "Advertiser" : "Publisher"} Account`,
          slug: `${role === "advertiser" ? "advertiser" : "publisher"}-${slug}`,
          type: role,
        });
        if (error) {
          setCreateError(error.message);
          setCreating(false);
          return;
        }
        setStep(2);
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      } finally {
        setCreating(false);
      }
      return;
    }
    setStep(2);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6">
      <Link to="/" className="mb-10 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Rocket className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">TradeMall</span>
      </Link>

      <PageHeader
        eyebrow="Onboarding"
        title="Get started"
        description="Let's get you set up in a few quick steps."
      />

      <div className="mt-8 flex items-center">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors duration-200 ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`hidden text-sm transition-colors duration-200 sm:inline ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-3 sm:mx-4 h-px w-6 sm:w-8 bg-border transition-colors duration-200" />
            )}
          </div>
        ))}
      </div>

      <Card className="mt-8">
        <CardContent className="p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Rocket className="size-10 text-primary" />
              <h2 className="text-xl font-semibold tracking-tight">Welcome to TradeMall</h2>
              <p className="text-sm text-muted-foreground">
                TradeMall is the ad network platform that connects advertisers with publishers.
                Run high-performing campaigns or monetize your websites — all in one place.
              </p>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(1)}>Get started</Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h2 className="text-xl font-semibold tracking-tight">Choose your role</h2>
              <p className="text-sm text-muted-foreground">
                Tell us how you plan to use TradeMall. You can switch later.
              </p>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    htmlFor="role-advertiser"
                    className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all duration-200 ${
                      role === "advertiser"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="advertiser" id="role-advertiser" />
                      <Megaphone className="size-5 text-muted-foreground" />
                      <span className="font-medium">Advertiser</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">
                      Run campaigns and buy inventory across the publisher network.
                    </p>
                  </label>
                  <label
                    htmlFor="role-publisher"
                    className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all duration-200 ${
                      role === "publisher"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="publisher" id="role-publisher" />
                      <Globe className="size-5 text-muted-foreground" />
                      <span className="font-medium">Publisher</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">
                      Monetize your websites with ad zones and earn revenue share.
                    </p>
                  </label>
                </div>
              </RadioGroup>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(0)} disabled={creating}>
                  Back
                </Button>
                <Button onClick={handleContinue} disabled={creating}>
                  {creating ? "Creating workspace…" : "Continue"}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h2 className="text-xl font-semibold tracking-tight">
                {role === "advertiser" ? "Create your first campaign" : "Add your first website"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {role === "advertiser"
                  ? "Campaigns are the foundation of your advertising. Set one up to start reaching audiences across the network."
                  : "Websites are where your ad zones live. Add one to start monetizing your traffic."}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild>
                  <Link
                    to={role === "advertiser" ? "/advertiser/campaigns" : "/publisher/websites"}
                  >
                    {role === "advertiser" ? "Go to campaigns" : "Go to websites"}
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => setStep(3)}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center animate-in fade-in duration-200">
              <CheckCircle2 className="mx-auto size-10 text-success" />
              <h2 className="text-xl font-semibold tracking-tight">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                Redirecting you to your {role} dashboard...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
