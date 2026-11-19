import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/page-header";
import { LoadingState, ErrorState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { getMyEmailPreferences, updateMyEmailPreferences } from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/email-preferences")({
  head: () => ({ meta: [{ title: "Email preferences — TradeMall" }] }),
  component: PreferencesPage,
});
function PreferencesPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["my-email-preferences"], queryFn: () => getMyEmailPreferences() });
  const [marketing, setMarketing] = useState<boolean | null>(null);
  const [updates, setUpdates] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: () => updateMyEmailPreferences({
      marketingEnabled: marketing ?? Boolean(query.data?.marketing_enabled),
      productUpdatesEnabled: updates ?? Boolean(query.data?.product_updates_enabled),
    }),
    onSuccess: () => { setMarketing(null); setUpdates(null); void client.invalidateQueries({ queryKey: ["my-email-preferences"] }); },
  });
  if (query.isLoading) return <WorkspaceGuard workspace="advertiser"><LoadingState rows={3} label="Loading preferences" /></WorkspaceGuard>;
  if (query.error || !query.data) return <WorkspaceGuard workspace="advertiser"><ErrorState title="Couldn't load preferences" message={query.error?.message ?? "Please try again."} onRetry={() => void query.refetch()} /></WorkspaceGuard>;
  const marketingValue = marketing ?? Boolean(query.data.marketing_enabled);
  const updatesValue = updates ?? Boolean(query.data.product_updates_enabled);
  return <WorkspaceGuard workspace="advertiser">
    <PageHeader eyebrow="Account" title="Email preferences" description="Choose which non-essential TradeMall messages you want to receive." />
    <Card className="max-w-2xl"><CardHeader><CardTitle className="text-base">Marketing and product updates</CardTitle></CardHeader><CardContent className="space-y-5">
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={marketingValue} onChange={e => setMarketing(e.target.checked)} /><span><span className="font-medium">Marketing emails</span><span className="block text-sm text-muted-foreground">Tips, offers, product announcements and occasional platform news.</span></span></label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={updatesValue} onChange={e => setUpdates(e.target.checked)} /><span><span className="font-medium">Product updates</span><span className="block text-sm text-muted-foreground">New features, platform improvements and educational updates.</span></span></label>
      <p className="text-sm text-muted-foreground">You will continue to receive essential account, security, billing, campaign and publisher service notifications even when both options are off.</p>
      <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save preferences"}</Button>
      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      {query.data.unsubscribed_at && <p className="text-xs text-muted-foreground">Marketing email opt-out recorded on {new Date(query.data.unsubscribed_at).toLocaleDateString()}.</p>}
    </CardContent></Card>
  </WorkspaceGuard>;
}
