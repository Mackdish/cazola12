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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubmitAdReport } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";

export type AdReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adId: string;
  campaignId: string;
  websiteId: string;
  adZoneId: string;
  organizationId: string;
};

const REASONS = [
  { value: "inappropriate", label: "Inappropriate" },
  { value: "misleading", label: "Misleading" },
  { value: "malicious", label: "Malicious" },
  { value: "repetitive", label: "Repetitive" },
  { value: "other", label: "Other" },
] as const;

export function AdReportDialog({
  open,
  onOpenChange,
  adId,
  campaignId,
  websiteId,
  adZoneId,
  organizationId,
}: AdReportDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState("");
  const mutation = useSubmitAdReport();

  async function submit() {
    if (!reason) {
      toast.error("Select a reason for reporting this ad.");
      return;
    }
    try {
      const input: {
        organizationId: string;
        adId: string;
        campaignId: string;
        websiteId: string;
        adZoneId: string;
        reason: string;
        description?: string;
      } = {
        organizationId,
        adId,
        campaignId,
        websiteId,
        adZoneId,
        reason,
      };
      const trimmed = description.trim();
      if (trimmed) {
        input.description = trimmed;
      }
      await mutation.mutateAsync(input);
      toast.success("Ad report submitted.");
      setReason(REASONS[0].value);
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't submit your ad report");
      toast.error(friendly.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this ad</DialogTitle>
          <DialogDescription>
            Tell us why you're reporting this ad. Your report helps keep the platform safe and
            relevant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad-report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason} disabled={mutation.isPending}>
              <SelectTrigger id="ad-report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-report-description">Description (optional)</Label>
            <Textarea
              id="ad-report-description"
              placeholder="Add any details about this ad..."
              rows={4}
              value={description}
              disabled={mutation.isPending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
