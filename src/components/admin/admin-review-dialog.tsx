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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReviewPublisher, useReviewWebsite } from "@/hooks/use-publisher";
import { toFriendlyError } from "@/lib/errors";
import { type ApprovalStatus } from "@/lib/publisher-domain";

type AdminReviewTarget = "publisher" | "website";

type AdminReviewDialogProps = {
  target: AdminReviewTarget;
  id: string;
  currentApprovalStatus?: ApprovalStatus;
  currentStatus?: "active" | "pending" | "suspended";
  trigger: React.ReactNode;
};

export function AdminReviewDialog({
  target,
  id,
  currentApprovalStatus,
  currentStatus,
  trigger,
}: AdminReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | undefined>(
    currentApprovalStatus,
  );
  const [status, setStatus] = useState<"active" | "pending" | "suspended" | undefined>(
    currentStatus,
  );
  const [reason, setReason] = useState("");

  const reviewPublisher = useReviewPublisher();
  const reviewWebsite = useReviewWebsite();
  const mutation = target === "publisher" ? reviewPublisher : reviewWebsite;

  async function submit() {
    if (!approvalStatus && !status) {
      toast.error("Choose an approval or status change.");
      return;
    }
    try {
      const input =
        target === "publisher"
          ? { publisherId: id, approvalStatus, status, reason: reason.trim() || null }
          : { websiteId: id, approvalStatus, status, reason: reason.trim() || null };
      await mutation.mutateAsync(input);
      toast.success("Review saved.");
      setOpen(false);
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't save that review");
      toast.error(friendly.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review {target}</DialogTitle>
          <DialogDescription>
            Approve or reject the {target}. A reason is required for rejections and helps publishers
            understand the decision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="review-approval">Approval status</Label>
            <Select
              value={approvalStatus ?? ""}
              onValueChange={(value) => setApprovalStatus(value as ApprovalStatus)}
            >
              <SelectTrigger id="review-approval">
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-status">Entity status</Label>
            <Select
              value={status ?? ""}
              onValueChange={(value) => setStatus(value as "active" | "pending" | "suspended")}
            >
              <SelectTrigger id="review-status">
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-reason">Reason</Label>
            <textarea
              id="review-reason"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Required for rejection or suspension"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
