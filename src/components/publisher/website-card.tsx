import { Link } from "@tanstack/react-router";
import { ChevronRight, Globe } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/patterns/status-badge";
import {
  approvalLabel,
  approvalTone,
  categoryLabel,
  type Website,
  verificationLabel,
  verificationTone,
} from "@/lib/publisher-domain";

type WebsiteCardProps = {
  website: Website & { zoneCount?: number; activeZoneCount?: number };
};

export function WebsiteCard({ website }: WebsiteCardProps) {
  return (
    <Card className="shadow-none transition-colors hover:bg-muted/30">
      <CardContent className="p-4">
        <Link
          to="/publisher/websites/$websiteId"
          params={{ websiteId: website.id }}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Globe className="size-4" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">{website.name}</p>
              <p className="text-xs text-muted-foreground">{website.domain}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <StatusBadge tone={verificationTone(website.verification_status)}>
                  {verificationLabel(website.verification_status)}
                </StatusBadge>
                <StatusBadge tone={approvalTone(website.approval_status)}>
                  {approvalLabel(website.approval_status)}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {categoryLabel(website.category)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-numeric text-sm font-medium">{website.zoneCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{website.activeZoneCount ?? 0} active</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
