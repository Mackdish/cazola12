import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, CheckCircle2, Globe, Image, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAddWebsite, usePublisherOrg, usePublisherProfile, useSavePublisherProfile } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import { normalizeDomain, WEBSITE_CATEGORIES, type WebsiteCategory } from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/publisher/get-started")({
  head: () => ({ meta: [
    { title: "Get started — Publisher — TradeMall" },
    { name: "description", content: "Set up your publisher profile, add a website and choose where TradeMall ads should appear." },
    { name: "robots", content: "noindex" },
  ] }),
  component: GetStartedPage,
});

const steps = [
  { id: "profile", label: "Profile", icon: Building2 },
  { id: "website", label: "Website", icon: Globe },
  { id: "verify", label: "Verify", icon: Shield },
  { id: "placements", label: "Placements", icon: Image },
] as const;

type Step = (typeof steps)[number]["id"];

function GetStartedPage() {
  const { organizationId, organization } = usePublisherOrg();
  const { data: profile, isLoading } = usePublisherProfile(organizationId);
  const [currentStep, setCurrentStep] = useState<Step>(profile?.business_name ? "website" : "profile");

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Get started"
        description="Set up your website once, then choose where TradeMall should place ads for you."
        actions={<Button asChild variant="ghost" size="sm"><Link to="/publisher">Go to dashboard</Link></Button>}
      />
      {isLoading ? <LoadingState rows={4} label="Loading setup" /> : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-1">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              const active = step.id === currentStep;
              const done = index < currentIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => index <= currentIndex && setCurrentStep(step.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5" : "border-border"} ${index > currentIndex ? "cursor-default opacity-60" : ""}`}
                >
                  {done ? <CheckCircle2 className="size-4 text-success" /> : <Icon className="size-4 text-muted-foreground" />}
                  <span className={active ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3">
            {currentStep === "profile" && <ProfileStep organizationId={organizationId} profile={profile ?? null} onComplete={() => setCurrentStep("website")} />}
            {currentStep === "website" && <WebsiteStep organizationId={organizationId} onComplete={() => setCurrentStep("verify")} />}
            {currentStep === "verify" && <VerifyStep organization={organization} onComplete={() => setCurrentStep("placements")} />}
            {currentStep === "placements" && <PlacementsStep />}
          </div>
        </div>
      )}
    </WorkspaceGuard>
  );
}

function ProfileStep({ organizationId, profile, onComplete }: { organizationId: string | null; profile: { business_name: string; contact_email: string; contact_phone?: string | null; website_url?: string | null } | null; onComplete: () => void }) {
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.contact_phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? "");
  const save = useSavePublisherProfile();

  async function submit() {
    if (!organizationId) return toast.error("No publisher organization selected.");
    if (businessName.trim().length < 2) return toast.error("Enter a business name.");
    if (!contactEmail.trim().includes("@")) return toast.error("Enter a valid contact email.");
    try {
      await save.mutateAsync({ organizationId, businessName: businessName.trim(), contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim() || null, websiteUrl: websiteUrl.trim() || null });
      toast.success("Profile saved.");
      onComplete();
    } catch (error) { toast.error(toFriendlyError(error, "We couldn't save your profile").message); }
  }

  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Publisher profile</CardTitle><CardDescription>Tell us who you are so advertisers can trust your inventory.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="space-y-2"><Label htmlFor="gs-business-name">Business name</Label><Input id="gs-business-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="gs-contact-email">Contact email</Label><Input id="gs-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="gs-contact-phone">Contact phone</Label><Input id="gs-contact-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div></div>
    <div className="space-y-2"><Label htmlFor="gs-website-url">Publisher website URL</Label><Input id="gs-website-url" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></div>
    <div className="flex justify-end"><Button onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Continue to website"}</Button></div>
  </CardContent></Card>;
}

function WebsiteStep({ organizationId, onComplete }: { organizationId: string | null; onComplete: () => void }) {
  const add = useAddWebsite();
  const [domain, setDomain] = useState(""); const [name, setName] = useState("");
  const [category, setCategory] = useState<WebsiteCategory>("other"); const [description, setDescription] = useState(""); const [monthlyPageviews, setMonthlyPageviews] = useState("");
  async function submit() {
    if (!organizationId) return toast.error("No publisher organization selected.");
    const normalized = normalizeDomain(domain); if (!normalized) return toast.error("Enter a valid domain like example.com.");
    if (name.trim().length < 2) return toast.error("Give the website a display name.");
    try { await add.mutateAsync({ organizationId, domain: normalized, name: name.trim(), description: description.trim() || null, category, monthlyPageviews: monthlyPageviews ? Number(monthlyPageviews) : 0 }); toast.success("Website added."); onComplete(); }
    catch (error) { toast.error(toFriendlyError(error, "We couldn't add that website").message); }
  }
  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Add your website</CardTitle><CardDescription>TradeMall will use this domain to configure and protect your ad placements.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="space-y-2"><Label htmlFor="gs-domain">Domain</Label><Input id="gs-domain" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="gs-site-name">Display name</Label><Input id="gs-site-name" placeholder="Example News" value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="gs-category">Category</Label><Select value={category} onValueChange={(v) => setCategory(v as WebsiteCategory)}><SelectTrigger id="gs-category"><SelectValue /></SelectTrigger><SelectContent>{WEBSITE_CATEGORIES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="gs-pageviews">Monthly pageviews</Label><Input id="gs-pageviews" inputMode="numeric" placeholder="100000" value={monthlyPageviews} onChange={(e) => setMonthlyPageviews(e.target.value.replace(/[^0-9]/g, ""))} /></div></div>
    <div className="space-y-2"><Label htmlFor="gs-description">Description</Label><textarea id="gs-description" rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="What is this website about?" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <div className="flex justify-end"><Button onClick={() => void submit()} disabled={add.isPending}>{add.isPending ? "Adding…" : "Add website"}</Button></div>
  </CardContent></Card>;
}

function VerifyStep({ organization: _organization, onComplete }: { organization: { id: string } | null; onComplete: () => void }) {
  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Verify your domain</CardTitle><CardDescription>Confirm that you own the website before enabling TradeMall placements.</CardDescription></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Open your website from the website manager, choose a verification method and complete the check. After verification, TradeMall will review the website for approval.</p>
    <div className="flex flex-wrap items-center gap-2"><Button asChild><Link to="/publisher/websites">Open website manager</Link></Button><Button variant="ghost" onClick={onComplete}>Continue later</Button></div>
  </CardContent></Card>;
}

function PlacementsStep() {
  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Choose where ads appear</CardTitle><CardDescription>This is the new TradeMall placement workflow. You choose locations — TradeMall handles the technical placement.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      {["Top of page", "Top of article", "Between paragraphs", "Sidebar", "Bottom of article", "Mobile sticky"].map((placement) => <div key={placement} className="rounded-lg border p-4"><p className="text-sm font-medium">{placement}</p><p className="mt-1 text-xs text-muted-foreground">Available in the placement manager.</p></div>)}
    </div>
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-medium">Placement controls are coming next</p><p className="mt-1 text-sm text-muted-foreground">Phase 2 will let you activate these locations from the dashboard without creating HTML snippets for each one.</p></div>
    <div className="flex flex-wrap gap-2"><Button asChild><Link to="/publisher/websites">Manage website</Link></Button><Button asChild variant="ghost"><Link to="/publisher">Go to dashboard</Link></Button></div>
  </CardContent></Card>;
}
