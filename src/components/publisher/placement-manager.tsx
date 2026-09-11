import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Monitor, Smartphone, LayoutTop, AlignCenterVertical, PanelRight, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fetchWebsitePlacements, updateWebsitePlacement } from "@/lib/publisher-placement.functions";
import { toFriendlyError } from "@/lib/errors";

const iconMap = {
  top_page: LayoutTop,
  article_top: ArrowDownToLine,
  between_paragraphs: AlignCenterVertical,
  sidebar: PanelRight,
  bottom_article: ArrowDownToLine,
  mobile_sticky: Smartphone,
} as const;

const formats = [
  { value: "responsive", label: "Responsive" },
  { value: "300x250", label: "300 × 250" },
  { value: "336x280", label: "336 × 280" },
  { value: "728x90", label: "728 × 90" },
  { value: "970x250", label: "970 × 250" },
  { value: "320x50", label: "320 × 50" },
  { value: "320x100", label: "320 × 100" },
];

type Props = { websiteId: string; ready: boolean };

export function PlacementManager({ websiteId, ready }: Props) {
  const queryClient = useQueryClient();
  const fetch = useServerFn(fetchWebsitePlacements);
  const update = useServerFn(updateWebsitePlacement);
  const placements = useQuery({
    queryKey: ["publisher", "placements", websiteId],
    queryFn: () => fetch({ data: { websiteId } }),
  });
  const mutation = useMutation({
    mutationFn: (input: { placementKey: string; enabled: boolean; format?: string }) =>
      update({ data: { websiteId, ...input, placementKey: input.placementKey as any } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["publisher", "placements", websiteId] });
      void queryClient.invalidateQueries({ queryKey: ["publisher", "website", websiteId] });
    },
  });

  async function toggle(placement: any) {
    if (!ready) {
      toast.error("Verify and get approval for your website before activating placements.");
      return;
    }
    try {
      await mutation.mutateAsync({
        placementKey: placement.key,
        enabled: !placement.enabled,
        format: placement.ad_zones?.format ?? placement.recommendedFormat,
      });
      toast.success(`${placement.label} ${placement.enabled ? "disabled" : "activated"}.`);
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't update that placement").message);
    }
  }

  async function changeFormat(placement: any, format: string) {
    if (!placement.enabled) return;
    try {
      await mutation.mutateAsync({ placementKey: placement.key, enabled: true, format });
      toast.success(`${placement.label} format updated.`);
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't update that format").message);
    }
  }

  if (placements.isLoading) {
    return <Card className="shadow-none"><CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading placements…</CardContent></Card>;
  }
  if (placements.error) {
    return <Card className="shadow-none"><CardContent className="py-8 text-sm text-destructive">{placements.error.message}</CardContent></Card>;
  }

  const rows = placements.data ?? [];
  const activeCount = rows.filter((p: any) => p.enabled && p.ad_zones?.status === "active").length;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Placement manager</CardTitle>
            <CardDescription>Choose where you want TradeMall inventory on this website. We create and manage the ad zone behind each placement.</CardDescription>
          </div>
          <Badge variant="secondary">{activeCount} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ready ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            Complete domain verification and website approval before activating a placement.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((placement: any) => {
            const Icon = iconMap[placement.key as keyof typeof iconMap] ?? Monitor;
            const active = placement.enabled && placement.ad_zones?.status === "active";
            const format = placement.ad_zones?.format ?? placement.recommendedFormat;
            return (
              <div key={placement.key} className={`rounded-xl border p-4 transition-colors ${active ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border bg-background p-2"><Icon className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{placement.label}</p>
                      {active ? <Badge variant="outline" className="text-xs"><Check className="mr-1 size-3" /> Active</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{placement.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={format} onValueChange={(value) => void changeFormat(placement, value)} disabled={!active || mutation.isPending}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{formats.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant={active ? "outline" : "default"} onClick={() => void toggle(placement)} disabled={mutation.isPending || !ready}>
                        {mutation.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                        {active ? "Disable" : "Activate"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="pt-2 text-xs text-muted-foreground">Your placement choices are stored per website. Existing ad zones continue to work, so this manager can be adopted without breaking current integrations.</p>
      </CardContent>
    </Card>
  );
}
