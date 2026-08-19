import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EyeOff, Flag, HelpCircle, MoreHorizontal } from "lucide-react";
import { toFriendlyError } from "@/lib/errors";
import { useSubmitAdReport } from "@/hooks/use-publisher";
import { AdReportDialog } from "./ad-report-dialog";

export type AdReportMenuProps = {
  adId: string;
  campaignId: string;
  websiteId: string;
  adZoneId: string;
  organizationId: string;
};

export function AdReportMenu({
  adId,
  campaignId,
  websiteId,
  adZoneId,
  organizationId,
}: AdReportMenuProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const mutation = useSubmitAdReport();

  async function hideAd() {
    try {
      await mutation.mutateAsync({
        organizationId,
        adId,
        campaignId,
        websiteId,
        adZoneId,
        reason: "repetitive",
      });
      toast.success("Ad hidden.");
    } catch (error) {
      const friendly = toFriendlyError(error, "We couldn't hide that ad");
      toast.error(friendly.message);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Ad options"
            className="size-7"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                toast.info(
                  "This ad is being shown because it matches your site's content and audience.",
                );
              }}
            >
              <HelpCircle className="mr-2 size-4" />
              Why am I seeing this ad?
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setReportOpen(true)}
            disabled={mutation.isPending}
          >
            <Flag className="mr-2 size-4" />
            Report this ad
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={hideAd} disabled={mutation.isPending}>
            <EyeOff className="mr-2 size-4" />
            {mutation.isPending ? "Hiding…" : "Hide this ad"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AdReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        adId={adId}
        campaignId={campaignId}
        websiteId={websiteId}
        adZoneId={adZoneId}
        organizationId={organizationId}
      />
    </>
  );
}
