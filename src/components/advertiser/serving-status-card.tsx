import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Info, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { campaignServingStatus, type ServingIssue, type ServingStatusInput } from "@/lib/serving-status";

const FIX_LINK: Record<NonNullable<ServingIssue["fix"]>, { to: string; label: string } | null> = {
  wallet: { to: "/advertiser/wallet", label: "Add funds" },
  creatives: { to: "/advertiser/creatives", label: "Open creatives" },
  campaign: null,
  ads: null,
  targeting: null,
};

const ICON = { blocker: XCircle, warning: AlertTriangle, info: Info } as const;
const TONE = {
  blocker: "text-destructive",
  warning: "text-orange-600 dark:text-orange-400",
  info: "text-muted-foreground",
} as const;

/**
 * Tells the campaign owner, in plain language, whether the campaign can serve and
 * what to change if it cannot. It only reports what this account can see.
 */
export function ServingStatusCard({ input }: { input: ServingStatusInput }) {
  const status = campaignServingStatus(input);
  const Lead = status.state === "serving" ? CheckCircle2 : status.state === "waiting" ? Clock : XCircle;
  const leadTone =
    status.state === "serving" ? "text-emerald-600" : status.state === "waiting" ? "text-muted-foreground" : "text-destructive";

  return (
    <section className="panel space-y-3 p-4" aria-label="Delivery status">
      <div className="flex items-center gap-2">
        <Lead className={`size-5 ${leadTone}`} aria-hidden />
        <h2 className="text-sm font-semibold">{status.headline}</h2>
      </div>
      {status.state === "serving" && status.issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing on your side is blocking delivery. Impressions depend on approved publisher sites that match your
          format and targeting.
        </p>
      ) : null}
      {status.issues.length > 0 ? (
        <ul className="space-y-2">
          {status.issues.map((issue) => {
            const Icon = ICON[issue.severity];
            const link = issue.fix ? FIX_LINK[issue.fix] : null;
            return (
              <li key={issue.code} className="flex items-start gap-2 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[issue.severity]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-muted-foreground">{issue.advice}</p>
                </div>
                {link ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={link.to}>{link.label}</Link>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
