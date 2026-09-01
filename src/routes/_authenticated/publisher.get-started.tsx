import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, CheckCircle2, Globe, Image, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import {
  useAddWebsite,
  usePublisherOrg,
  usePublisherProfile,
  useSavePublisherProfile,
} from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import {
  categoryLabel,
  normalizeDomain,
  WEBSITE_CATEGORIES,
  type WebsiteCategory,
} from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/publisher/get-started")({
  head: () => ({
    meta: [
      { title: "Get started — Publisher — TradeMall" },
      {
        name: "description",
        content: "Set up your publisher profile, add a website and verify ownership.",
      },
      { property: "og:title", content: "Get started — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Set up your publisher profile, add a website and verify ownership.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GetStartedPage,
});

const steps = [
  { id: "profile", label: "Profile", icon: Building2 },
  { id: "website", label: "Website", icon: Globe },
  { id: "verify", label: "Verify", icon: Shield },
  { id: "zones", label: "Ad zones", icon: Image },
];

function GetStartedPage() {
  const { organizationId, organization } = usePublisherOrg();
  const { data: profile, isLoading: loadingProfile } = usePublisherProfile(organizationId);
  const [currentStep, setCurrentStep] = useState<"profile" | "website" | "verify" | "zones">(
    profile?.business_name ? "website" : "profile",
  );

  const isLoading = loadingProfile;

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Get started"
        description="A short setup to start serving ads on your websites."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/publisher">Skip to dashboard</Link>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading setup" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-1">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              const isActive = step.id === currentStep;
              const isDone = index < currentIndex;
              return (
                <div
                  key={step.id}
                  className={
                    "flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors " +
                    (isActive ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  {isDone ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Icon className="size-4 text-muted-foreground" />
                  )}
                  <span className={isActive ? "font-medium" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-3">
            {currentStep === "profile" && (
              <ProfileStep
                organizationId={organizationId}
                profile={profile ?? null}
                onComplete={() => setCurrentStep("website")}
              />
            )}
            {currentStep === "website" && (
              <WebsiteStep
                organizationId={organizationId}
                onComplete={(websiteId) => setCurrentStep("verify")}
              />
            )}
            {currentStep === "verify" && (
              <VerifyStep organization={organization} onComplete={() => setCurrentStep("zones")} />
            )}
            {currentStep === "zones" && <ZonesStep organization={organization} />}
          </div>
        </div>
      )}
    </WorkspaceGuard>
  );
}

function ProfileStep({
  organizationId,
  profile,
  onComplete,
}: {
  organizationId: string | null;
  profile: {
    business_name: string;
    contact_email: string;
    contact_phone?: string | null;
    website_url?: string | null;
  } | null;
  onComplete: () => void;
}) {
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.contact_phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? "");
  const save = useSavePublisherProfile();

  async function submit() {
    if (!organizationId) {
      toast.error("No publisher organization selected.");
      return;
    }
    if (!businessName.trim() || businessName.trim().length < 2) {
      toast.error("Enter a business name.");
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      toast.error("Enter a valid contact email.");
      return;
    }
    try {
      await save.mutateAsync({
        organizationId,
        businessName: businessName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
      });
      toast.success("Profile saved.");
      onComplete();
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't save your profile").message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Publisher profile</CardTitle>
        <CardDescription>
          Tell us who you are so advertisers can trust your inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gs-business-name">Business name</Label>
          <Input
            id="gs-business-name"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gs-contact-email">Contact email</Label>
            <Input
              id="gs-contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gs-contact-phone">Contact phone</Label>
            <Input
              id="gs-contact-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gs-website-url">Publisher website URL</Label>
          <Input
            id="gs-website-url"
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Continue to website"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WebsiteStep({
  organizationId,
  onComplete,
}: {
  organizationId: string | null;
  onComplete: (websiteId: string) => void;
}) {
  const add = useAddWebsite();
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WebsiteCategory>("other");
  const [description, setDescription] = useState("");
  const [monthlyPageviews, setMonthlyPageviews] = useState("");

  async function submit() {
    if (!organizationId) {
      toast.error("No publisher organization selected.");
      return;
    }
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      toast.error("Enter a valid domain like example.com.");
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Give the website a display name.");
      return;
    }
    try {
      const website = await add.mutateAsync({
        organizationId,
        domain: normalized,
        name: name.trim(),
        description: description.trim() || null,
        category,
        monthlyPageviews: monthlyPageviews ? Number(monthlyPageviews) : 0,
      });
      toast.success("Website added.");
      onComplete(website.id);
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't add that website").message);
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Add a website</CardTitle>
        <CardDescription>The first website you want to run ads on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gs-domain">Domain</Label>
          <Input
            id="gs-domain"
            placeholder="example.com"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gs-site-name">Display name</Label>
          <Input
            id="gs-site-name"
            placeholder="Example News"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gs-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as WebsiteCategory)}
            >
              <SelectTrigger id="gs-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBSITE_CATEGORIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gs-pageviews">Monthly pageviews</Label>
            <Input
              id="gs-pageviews"
              inputMode="numeric"
              placeholder="100000"
              value={monthlyPageviews}
              onChange={(event) => setMonthlyPageviews(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gs-description">Description</Label>
          <textarea
            id="gs-description"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="What is this website about?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={add.isPending}>
            {add.isPending ? "Adding…" : "Add website"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VerifyStep({
  organization,
  onComplete,
}: {
  organization: { id: string } | null;
  onComplete: () => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Verify your domain</CardTitle>
        <CardDescription>
          Pick a verification method and complete the check in the website detail page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          After adding a website, head to its detail page to generate a verification token and run
          the ownership check. Once verified, the platform team will review the site for approval.
        </p>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/publisher/websites">Go to website</Link>
          </Button>
          <Button variant="ghost" onClick={onComplete}>
            I did it later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ZonesStep({ organization }: { organization: { id: string } | null }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Create ad zones</CardTitle>
        <CardDescription>
          Once a website is verified and approved, you can add ad placements and copy the embed
          snippets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ad zones are placements such as 300×250 rectangles, 728×90 leaderboards or responsive
          units. Each zone gets a unique snippet that you paste into your site templates.
        </p>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/publisher/websites">Manage websites</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/publisher">Go to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
