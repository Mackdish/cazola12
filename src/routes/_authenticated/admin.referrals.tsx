import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { MetricCard } from "@/components/patterns/metric-card";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useAdminProcessReferrals,
  useAdminReferralOverview,
  useAdminUpdateReferralSettings,
  useAdminVoidReferral,
} from "@/hooks/use-referral";
import { REFERRAL_STATUS_LABEL, formatKes } from "@/lib/referral-domain";
import type { AdminReferralOverview } from "@/lib/referral.functions";

type Row = AdminReferralOverview["referrals"][number];
const TONE: Record<Row["status"], StatusTone> = { pending: "pending", qualified: "active", void: "suspended" };

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — Platform Admin — TradeMall" },
      { name: "description", content: "Configure and monitor the TradeMall referral program." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReferrals,
});

function AdminReferrals() {
  const overview = useAdminReferralOverview();
  const save = useAdminUpdateReferralSettings();
  const voidReferral = useAdminVoidReferral();
  const processNow = useAdminProcessReferrals();

  const [form, setForm] = useState({ enabled: false, commissionPercent: "10", windowMonths: "12", advertiserMilestone: "1000", publisherMilestone: "500" });
  const [target, setTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const s = overview.data?.settings;
    if (!s) return;
    setForm({
      enabled: s.enabled,
      commissionPercent: String(s.commissionPercent),
      windowMonths: String(s.windowMonths),
      advertiserMilestone: String(s.advertiserMilestone),
      publisherMilestone: String(s.publisherMilestone),
    });
  }, [overview.data?.settings]);

  async function submit() {
    const commissionPercent = Number(form.commissionPercent);
    const windowMonths = Number(form.windowMonths);
    const advertiserMilestone = Number(form.advertiserMilestone);
    const publisherMilestone = Number(form.publisherMilestone);
    if (![commissionPercent, windowMonths, advertiserMilestone, publisherMilestone].every(Number.isFinite)) {
      toast.error("Enter a number in every field.");
      return;
    }
    if (commissionPercent < 0 || commissionPercent > 40) {
      toast.error("The commission must be between 0% and 40%.");
      return;
    }
    if (!Number.isInteger(windowMonths) || windowMonths < 0 || windowMonths > 120) {
      toast.error("The reward period must be a whole number of months (0–120).");
      return;
    }
    try {
      await save.mutateAsync({ enabled: form.enabled, commissionPercent, windowMonths, advertiserMilestone, publisherMilestone });
      toast.success(form.enabled ? "Settings saved. The referral program is ON." : "Settings saved. The referral program is OFF.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save settings.");
    }
  }

  async function runNow() {
    try {
      const result = await processNow.mutateAsync();
      toast.success(
        result.skipped
          ? "Another run is already in progress — try again in a moment."
          : !result.enabled
            ? "The program is off, so nothing was processed."
            : `Processed: ${result.accrued} new, ${result.qualified} qualified, ${result.released} released, ${result.walletsCredited} wallets credited.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't process referrals.");
    }
  }

  async function confirmVoid() {
    if (!target) return;
    try {
      const trimmed = reason.trim();
      await voidReferral.mutateAsync({ referralId: target.id, ...(trimmed ? { reason: trimmed } : {}) });
      toast.success("Referral cancelled. Unpaid rewards were cancelled; anything already paid stays paid.");
      setTarget(null);
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't cancel the referral.");
    }
  }

  const columns: DataTableColumn<Row>[] = [
    {
      id: "referrer",
      header: "Referrer",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.referrerName}</div>
          <div className="text-xs capitalize text-muted-foreground">{row.referrerType}</div>
        </div>
      ),
    },
    {
      id: "referred",
      header: "Referred",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.referredName ?? "Not set up yet"}</div>
          <div className="text-xs capitalize text-muted-foreground">{row.referredType ?? "—"}</div>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge tone={TONE[row.status]}>{REFERRAL_STATUS_LABEL[row.status]}</StatusBadge> },
    { id: "joined", header: "Joined", cell: (row) => new Date(row.createdAt).toLocaleDateString("en-KE") },
    { id: "earned", header: "Earned", align: "right", cell: (row) => formatKes(row.earned) },
    { id: "pending", header: "Pending", align: "right", cell: (row) => formatKes(row.pending) },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        row.status === "void" ? (
          <span className="text-xs text-muted-foreground">{row.voidReason ?? "Cancelled"}</span>
        ) : (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setTarget(row)}>
            Cancel
          </Button>
        ),
    },
  ];

  if (overview.isLoading)
    return (
      <WorkspaceGuard workspace="admin">
        <LoadingState rows={5} label="Loading referrals" />
      </WorkspaceGuard>
    );
  if (overview.error)
    return (
      <WorkspaceGuard workspace="admin">
        <ErrorState title="Couldn't load referrals" message={overview.error.message} onRetry={() => void overview.refetch()} />
      </WorkspaceGuard>
    );

  const { stats } = overview.data!;
  const field = (id: keyof typeof form, label: string, hint: string) => (
    <div className="space-y-2">
      <Label htmlFor={`ref-${id}`}>{label}</Label>
      <Input id={`ref-${id}`} inputMode="decimal" value={String(form[id])} onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Referral Program"
        description="Referrers earn a share of TradeMall's revenue from the people they bring in. Advertisers are paid in ad credit, publishers in cash."
        actions={
          <Button variant="outline" onClick={() => void runNow()} disabled={processNow.isPending}>
            {processNow.isPending ? "Processing…" : "Process now"}
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Referrals" value={stats.referralsTotal} hint={`${stats.referralsQualified} qualified · ${stats.referralsVoid} cancelled`} />
        <MetricCard label="Pending rewards" value={formatKes(stats.commissionPending)} hint="Waiting for milestone / hold period" />
        <MetricCard label="Ready to withdraw" value={formatKes(stats.commissionAvailable)} hint="Publisher cash not yet paid out" />
        <MetricCard label="Paid out" value={formatKes(stats.commissionPaid)} hint="Ad credit + cash paid" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Program settings</CardTitle>
          <CardDescription>
            Changes apply to new activity straight away. Turn the program off to pause it — nothing accrues or is paid until it's back on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Switch id="ref-enabled" checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))} />
            <div>
              <Label htmlFor="ref-enabled" className="cursor-pointer">
                {form.enabled ? "Program is ON — people can be referred and rewards are paid" : "Program is OFF"}
              </Label>
              <p className="text-xs text-muted-foreground">Review the numbers below before switching it on.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("commissionPercent", "Commission (%)", "Share of TradeMall's own revenue from the referred account's activity. Max 40%, so two referrers on one click never exceed TradeMall's share.")}
            {field("windowMonths", "Reward period (months)", "How long after signup a referral keeps earning. 0 = no limit.")}
            {field("advertiserMilestone", "Advertiser milestone (KES)", "Lifetime ad spend a referred advertiser must reach before rewards unlock. 0 = immediately.")}
            {field("publisherMilestone", "Publisher milestone (KES)", "Lifetime earnings a referred publisher must reach before rewards unlock. 0 = immediately.")}
          </div>
          <Button onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">All referrals</h2>
        {overview.data!.referrals.length ? (
          <DataTable columns={columns} rows={overview.data!.referrals} rowKey={(row) => row.id} caption="All referrals" />
        ) : (
          <EmptyState title="No referrals yet" description="They'll appear here once the program is on and people sign up with a referral link." />
        )}
      </section>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this referral?</DialogTitle>
            <DialogDescription>
              {target ? `${target.referrerName} → ${target.referredName ?? "unregistered account"}` : ""}. Rewards not yet paid or
              claimed in a payout are cancelled and no more will accrue. Rewards already paid stay paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason (kept in the audit log)</Label>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. self-referral / fake account" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void confirmVoid()} disabled={voidReferral.isPending}>
              Cancel referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}
