import { useState } from "react";
import { ExternalLink } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/patterns/status-badge";
import { CreativePreview } from "@/components/advertiser/creative-preview";
import { LoadingState } from "@/components/patterns/states";
import { useAdminCampaignDetail, useReviewAd, useReviewCampaign } from "@/hooks/use-advertiser";
import {
  campaignStatusLabel,
  campaignStatusTone,
  formatCurrency,
  type CampaignStatus,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";

type ReviewAction = "approve" | "reject" | "pause" | "reactivate" | "complete";

const ACTION_LABELS: Record<ReviewAction, string> = {
  approve: "Approve",
  reject: "Reject",
  pause: "Pause",
  reactivate: "Reactivate",
  complete: "Complete",
};

function actionsFor(status: CampaignStatus): ReviewAction[] {
  switch (status) {
    case "pending_review":
      return ["approve", "reject"];
    case "approved":
      return ["pause", "reject"];
    case "active":
      return ["pause", "complete"];
    case "paused":
      return ["reactivate", "complete"];
    default:
      return [];
  }
}

export function CampaignReviewDialog({
  campaignId,
  status,
  trigger,
}: {
  campaignId: string;
  status: CampaignStatus;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const detail = useAdminCampaignDetail(open ? campaignId : null);
  const review = useReviewCampaign();
  const reviewAd = useReviewAd();

  const available = actionsFor(status);

  async function run(action: ReviewAction) {
    if (action === "reject" && reason.trim().length < 5) {
      toast.error("A rejection reason is required so the advertiser knows what to fix.");
      return;
    }
    try {
      await review.mutateAsync({ campaignId, action, reason: reason.trim() || null });
      toast.success(`Campaign ${ACTION_LABELS[action].toLowerCase()}d.`);
      setOpen(false);
      setReason("");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't complete that review").message);
    }
  }

  const campaign = detail.data?.campaign ?? null;
  const ads = detail.data?.ads ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review campaign</DialogTitle>
          <DialogDescription>
            Inspect creatives and the landing page before approving. Rejections require a reason.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading || !campaign ? (
          <LoadingState rows={3} label="Loading campaign" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{campaign.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(campaign.total_budget)} total · {campaign.bid_type.toUpperCase()}{" "}
                  {formatCurrency(campaign.bid_amount)}
                </p>
              </div>
              <StatusBadge tone={campaignStatusTone(campaign.status)}>
                {campaignStatusLabel(campaign.status)}
              </StatusBadge>
            </div>

            <div className="space-y-1">
              <p className="text-eyebrow">Landing page</p>
              <a
                href={campaign.landing_page_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                {campaign.landing_page_url ?? "Not set"}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-eyebrow">Creatives ({ads.length})</p>
              {ads.length === 0 ? (
                <p className="text-sm text-muted-foreground">This campaign has no ads yet.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {ads.map((ad) => {
                    const asset = (ad as typeof ad & { media_assets: { id: string } | null })
                      .media_assets;
                    return (
                      <li key={ad.id} className="space-y-2 rounded-lg border border-border p-3">
                        <CreativePreview
                          assetId={asset?.id ?? null}
                          alt={ad.name}
                          className="h-28 w-full"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{ad.name}</p>
                            <p className="text-xs text-muted-foreground">{ad.format}</p>
                          </div>
                          <StatusBadge
                            tone={
                              ad.approval_status === "approved"
                                ? "active"
                                : ad.approval_status === "rejected"
                                  ? "suspended"
                                  : "pending"
                            }
                          >
                            {ad.approval_status}
                          </StatusBadge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewAd.isPending}
                            onClick={() =>
                              void reviewAd
                                .mutateAsync({ adId: ad.id, action: "approve" })
                                .then(() => toast.success("Ad approved."))
                                .catch((error: unknown) =>
                                  toast.error(
                                    toFriendlyError(error, "We couldn't approve that ad").message,
                                  ),
                                )
                            }
                          >
                            Approve ad
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={reviewAd.isPending}
                            onClick={() => {
                              if (reason.trim().length < 5) {
                                toast.error("Add a reason below before rejecting an ad.");
                                return;
                              }
                              void reviewAd
                                .mutateAsync({
                                  adId: ad.id,
                                  action: "reject",
                                  reason: reason.trim(),
                                })
                                .then(() => toast.success("Ad rejected."))
                                .catch((error: unknown) =>
                                  toast.error(
                                    toFriendlyError(error, "We couldn't reject that ad").message,
                                  ),
                                );
                            }}
                          >
                            Reject ad
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-review-reason">Reason</Label>
              <textarea
                id="campaign-review-reason"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Required when rejecting"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={review.isPending}>
            Close
          </Button>
          {available.map((action) => (
            <Button
              key={action}
              variant={
                action === "reject" ? "destructive" : action === "approve" ? "default" : "outline"
              }
              disabled={review.isPending}
              onClick={() => void run(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
