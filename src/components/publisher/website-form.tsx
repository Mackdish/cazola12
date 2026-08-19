import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddWebsite } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import { normalizeDomain, WEBSITE_CATEGORIES, type WebsiteCategory } from "@/lib/publisher-domain";

export type WebsiteDraft = {
  domain: string;
  name: string;
  description: string;
  category: WebsiteCategory;
  monthlyPageviews: string;
};

export const EMPTY_WEBSITE_DRAFT: WebsiteDraft = {
  domain: "",
  name: "",
  description: "",
  category: "other",
  monthlyPageviews: "",
};

export function WebsiteFields({
  draft,
  onChange,
  disabled,
}: {
  draft: WebsiteDraft;
  onChange: (draft: WebsiteDraft) => void;
  disabled?: boolean;
}) {
  const normalized = normalizeDomain(draft.domain);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="website-domain">Domain</Label>
        <Input
          id="website-domain"
          placeholder="example.com"
          autoComplete="off"
          value={draft.domain}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, domain: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {draft.domain.length === 0
            ? "Enter the bare hostname — we strip protocol, www and paths."
            : normalized
              ? `Will be registered as ${normalized}`
              : "That doesn't look like a valid domain yet."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website-name">Display name</Label>
        <Input
          id="website-name"
          placeholder="Example Daily"
          value={draft.name}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="website-category">Category</Label>
          <Select
            value={draft.category}
            {...(disabled ? { disabled: true } : {})}
            onValueChange={(value) => onChange({ ...draft, category: value as WebsiteCategory })}
          >
            <SelectTrigger id="website-category">
              <SelectValue placeholder="Select a category" />
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
          <Label htmlFor="website-pageviews">Monthly pageviews</Label>
          <Input
            id="website-pageviews"
            inputMode="numeric"
            placeholder="150000"
            value={draft.monthlyPageviews}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...draft, monthlyPageviews: event.target.value.replace(/[^0-9]/g, "") })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website-description">Description</Label>
        <Textarea
          id="website-description"
          rows={3}
          placeholder="What the site covers and who reads it."
          value={draft.description}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </div>
    </div>
  );
}

export function draftErrors(draft: WebsiteDraft): string | null {
  if (!normalizeDomain(draft.domain)) return "Enter a valid domain, for example example.com.";
  if (draft.name.trim().length < 2) return "Give the website a display name.";
  return null;
}

export function AddWebsiteDialog({
  organizationId,
  onCreated,
  trigger,
}: {
  organizationId: string;
  onCreated?: (websiteId: string) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WebsiteDraft>(EMPTY_WEBSITE_DRAFT);
  const mutation = useAddWebsite();

  async function submit() {
    const problem = draftErrors(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const website = await mutation.mutateAsync({
        organizationId,
        domain: draft.domain,
        name: draft.name,
        description: draft.description.trim() || null,
        category: draft.category,
        monthlyPageviews: draft.monthlyPageviews ? Number(draft.monthlyPageviews) : 0,
      });
      toast.success(`${website.domain} added. Next: verify ownership.`);
      setDraft(EMPTY_WEBSITE_DRAFT);
      setOpen(false);
      onCreated?.(website.id);
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't add that website");
      toast.error(friendly.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Add website</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a website</DialogTitle>
          <DialogDescription>
            Register a domain you own. You'll verify ownership before it can serve ads.
          </DialogDescription>
        </DialogHeader>
        <WebsiteFields draft={draft} onChange={setDraft} disabled={mutation.isPending} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
