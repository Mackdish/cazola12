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
import { useAddAdZone } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import { AD_FORMATS, adFormatSpec, type AdFormat } from "@/lib/publisher-domain";

export function AdZoneDialog({
  websiteId,
  onCreated,
  trigger,
}: {
  websiteId: string;
  onCreated?: (zoneId: string) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<AdFormat>("300x250");
  const mutation = useAddAdZone();

  const selected = adFormatSpec(format);
  const dimension =
    selected.width && selected.height ? `${selected.width} × ${selected.height}` : "Responsive";

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Give the ad zone a name.");
      return;
    }
    try {
      const zone = await mutation.mutateAsync({ websiteId, name: name.trim(), format });
      toast.success("Ad zone created.");
      setName("");
      setFormat("300x250");
      setOpen(false);
      onCreated?.(zone.id);
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't create that ad zone");
      toast.error(friendly.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Add ad zone</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add an ad zone</DialogTitle>
          <DialogDescription>
            Choose a placement name and a format. The embed code will be ready next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="zone-name">Placement name</Label>
            <Input
              id="zone-name"
              placeholder="Homepage top-right"
              value={name}
              disabled={mutation.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {AD_FORMATS.map((entry) => (
                <button
                  key={entry.format}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => setFormat(entry.format)}
                  className={
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors " +
                    (format === entry.format
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50")
                  }
                >
                  <span className="text-sm font-medium">{entry.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.format === "responsive"
                      ? "Responsive"
                      : `${entry.width} × ${entry.height}`}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span className="text-eyebrow">Selected format</span>
            <p className="mt-1 font-medium">
              {selected.label} — {dimension}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create ad zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
