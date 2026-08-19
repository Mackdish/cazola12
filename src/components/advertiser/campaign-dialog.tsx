import { useState } from "react";
import { Plus } from "lucide-react";
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
import { useCreateCampaign } from "@/hooks/use-advertiser";
import { useBillingSettings } from "@/hooks/use-billing";
import {
  BID_TYPES,
  CAMPAIGN_OBJECTIVES,
  formatCurrency,
  normalizeDestinationUrl,
  type BidType,
  type CampaignObjective,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";

export function CampaignDialog({ organizationId }: { organizationId: string | null }) {
  const createCampaign = useCreateCampaign();
  const settings = useBillingSettings();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("traffic");
  const [bidType, setBidType] = useState<BidType>("cpm");
  const defaultBid = settings.data?.defaultBidAmount ?? 5;
  const defaultTotal = settings.data?.defaultTotalBudget ?? 500;
  const [bidAmount, setBidAmount] = useState(String(defaultBid));
  const [totalBudget, setTotalBudget] = useState(String(defaultTotal));
  const [dailyBudget, setDailyBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [landingPageUrl, setLandingPageUrl] = useState("");

  async function submit() {
    if (!organizationId) {
      toast.error("You need an advertiser organization to create campaigns.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Give the campaign a name.");
      return;
    }
    const url = normalizeDestinationUrl(landingPageUrl);
    if (!url) {
      toast.error("Enter a valid landing page URL, like https://example.com/offer.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error("The end date has to come after the start date.");
      return;
    }

    const total = Number(totalBudget || 0);
    const daily = dailyBudget ? Number(dailyBudget) : null;
    const bid = Number(bidAmount || 0);
    const minTotal = settings.data?.campaignMinimumBudget ?? 500;
    const minDaily = settings.data?.minimumDailyBudget ?? 100;
    const minBid = settings.data?.startingCpc ?? 5;

    if (total < minTotal) {
      toast.error(`Total budget must be at least ${formatCurrency(minTotal, settings.data?.currency)}.`);
      return;
    }
    if (daily !== null && daily < minDaily) {
      toast.error(`Daily budget must be at least ${formatCurrency(minDaily, settings.data?.currency)}.`);
      return;
    }
    if (bid < minBid) {
      toast.error(`Bid amount must be at least ${formatCurrency(minBid, settings.data?.currency)}.`);
      return;
    }
    if (daily !== null && daily > total) {
      toast.error("The daily budget can't exceed the total budget.");
      return;
    }

    try {
      await createCampaign.mutateAsync({
        organizationId,
        name: name.trim(),
        objective,
        bidType,
        bidAmount: bid,
        totalBudget: total,
        dailyBudget: daily,
        startDate: startDate || null,
        endDate: endDate || null,
        landingPageUrl: url,
      });
      toast.success("Campaign created as a draft.");
      setOpen(false);
      setName("");
      setLandingPageUrl("");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't create that campaign").message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" />
          New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a campaign</DialogTitle>
          <DialogDescription>
            Campaigns start as drafts. Add ads and targeting, then submit for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              placeholder="Spring launch — display"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-objective">Objective</Label>
              <Select
                value={objective}
                onValueChange={(value) => setObjective(value as CampaignObjective)}
              >
                <SelectTrigger id="campaign-objective">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_OBJECTIVES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-bid-type">Bid type</Label>
              <Select value={bidType} onValueChange={(value) => setBidType(value as BidType)}>
                <SelectTrigger id="campaign-bid-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BID_TYPES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="campaign-bid">Bid amount</Label>
              <Input
                id="campaign-bid"
                inputMode="decimal"
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Starting from {formatCurrency(settings.data?.startingCpc ?? 5, settings.data?.currency)}/click for CPC
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-total">Total budget</Label>
              <Input
                id="campaign-total"
                inputMode="decimal"
                value={totalBudget}
                onChange={(event) => setTotalBudget(event.target.value.replace(/[^0-9.]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Minimum {formatCurrency(settings.data?.campaignMinimumBudget ?? 500, settings.data?.currency)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-daily">Daily budget</Label>
              <Input
                id="campaign-daily"
                inputMode="decimal"
                placeholder="Optional"
                value={dailyBudget}
                onChange={(event) => setDailyBudget(event.target.value.replace(/[^0-9.]/g, ""))}
              />
              {dailyBudget && Number(dailyBudget) > 0 && Number(bidAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated {Math.floor(Number(dailyBudget) / Number(bidAmount))} clicks/day
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-url">Landing page URL</Label>
            <Input
              id="campaign-url"
              placeholder="https://example.com/offer"
              value={landingPageUrl}
              onChange={(event) => setLandingPageUrl(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={createCampaign.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={createCampaign.isPending}>
            {createCampaign.isPending ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
