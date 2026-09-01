import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { WebsiteCard } from "@/components/publisher/website-card";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAddWebsite, usePublisherOrg, useWebsites } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import {
  categoryLabel,
  normalizeDomain,
  WEBSITE_CATEGORIES,
  type WebsiteCategory,
} from "@/lib/publisher-domain";

export const Route = createFileRoute("/_authenticated/publisher/websites/")({
  head: () => ({
    meta: [
      { title: "Websites — Publisher — TradeMall" },
      { name: "description", content: "Your domains, verification state and content categories." },
      { property: "og:title", content: "Websites — Publisher — TradeMall" },
      {
        property: "og:description",
        content: "Your domains, verification state and content categories.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WebsitesPage,
});

function WebsitesPage() {
  const { organizationId } = usePublisherOrg();
  const { data: websites, isLoading, error, refetch } = useWebsites(organizationId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WebsiteCategory | "all">("all");

  const filtered = (websites ?? []).filter((website) => {
    const matchesQuery =
      query.trim().length === 0 ||
      website.name.toLowerCase().includes(query.toLowerCase()) ||
      website.domain.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || website.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <WorkspaceGuard workspace="publisher">
      <PageHeader
        eyebrow="Publisher"
        title="Websites"
        description="Your domains, verification state and content categories."
        actions={<AddWebsiteDialog />}
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or domain"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as WebsiteCategory | "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {WEBSITE_CATEGORIES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState rows={3} label="Loading websites" />
      ) : error ? (
        <ErrorState
          title="Couldn't load websites"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Globe className="size-5" />}
          title={query || category !== "all" ? "No websites match" : "No websites yet"}
          description={
            query || category !== "all"
              ? "Try a different search or filter."
              : "Add your first website to start the verification process."
          }
          action={
            query || category !== "all" ? (
              <Button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <AddWebsiteDialog />
            )
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((website) => (
            <WebsiteCard key={website.id} website={website} />
          ))}
        </div>
      )}
    </WorkspaceGuard>
  );
}

function AddWebsiteDialog() {
  const { organizationId } = usePublisherOrg();
  const addWebsite = useAddWebsite();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WebsiteCategory>("other");
  const [description, setDescription] = useState("");
  const [monthlyPageviews, setMonthlyPageviews] = useState("");

  async function submit() {
    if (!organizationId) {
      toast.error("You need a publisher organization to add websites.");
      return;
    }
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      toast.error("Enter a valid domain like example.com.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Give the website a display name.");
      return;
    }
    try {
      await addWebsite.mutateAsync({
        organizationId,
        domain: normalized,
        name: name.trim(),
        description: description.trim() || null,
        category,
        monthlyPageviews: monthlyPageviews ? Number(monthlyPageviews) : 0,
      });
      toast.success("Website added.");
      setDomain("");
      setName("");
      setCategory("other");
      setDescription("");
      setMonthlyPageviews("");
      setOpen(false);
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't add that website");
      toast.error(friendly.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" />
          Add website
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a website</DialogTitle>
          <DialogDescription>
            Enter the domain and a few details. We'll verify ownership before it can serve ads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-domain">Domain</Label>
            <Input
              id="site-domain"
              placeholder="example.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-name">Display name</Label>
            <Input
              id="site-name"
              placeholder="Example News"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as WebsiteCategory)}
              >
                <SelectTrigger id="site-category">
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
              <Label htmlFor="site-pageviews">Monthly pageviews</Label>
              <Input
                id="site-pageviews"
                inputMode="numeric"
                placeholder="100000"
                value={monthlyPageviews}
                onChange={(event) => setMonthlyPageviews(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-description">Description</Label>
            <textarea
              id="site-description"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="What is this website about?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={addWebsite.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={addWebsite.isPending}>
            {addWebsite.isPending ? "Adding…" : "Add website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
