import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useAdminWebsites } from "@/hooks/use-publisher";
import type { AdsTxtRecord } from "@/lib/ads-txt.service.server";
import type { Website } from "@/lib/publisher-domain";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchAdsTxtRecord } from "@/lib/publisher-ecosystem.functions";

export const Route = createFileRoute("/_authenticated/admin/ads-txt")({
  head: () => ({
    meta: [
      { title: "Ads.txt Verification — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Ads.txt verification status across all publisher websites.",
      },
      { property: "og:title", content: "Ads.txt Verification — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Ads.txt verification status across all publisher websites.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdsTxtPage,
});

type AdsTxtRow = Website & {
  adsTxtRecord: AdsTxtRecord | null;
  publisher?: { business_name: string } | null;
};

type DetailDialogState = {
  open: boolean;
  websiteId: string;
  websiteName: string;
};

function AdminAdsTxtPage() {
  const websitesQuery = useAdminWebsites();
  const fetchAdsTxtFn = useServerFn(fetchAdsTxtRecord);
  const [detailDialog, setDetailDialog] = useState<DetailDialogState>({
    open: false,
    websiteId: "",
    websiteName: "",
  });

  const adsTxtQuery = useQuery<AdsTxtRecord[]>({
    queryKey: ["admin", "ads-txt"],
    queryFn: () =>
      Promise.all(
        websitesQuery.data!.map((website) =>
          fetchAdsTxtFn({ data: { websiteId: website.id } }),
        ),
      ).then((results) => results.filter((r): r is AdsTxtRecord => r !== null)),
  });

  const websites = websitesQuery.data ?? [];
  const adsTxtRecords = adsTxtQuery.data ?? [];

  const recordsByWebsite = new Map<string, AdsTxtRecord>();
  for (const record of adsTxtRecords) {
    recordsByWebsite.set(record.website_id, record);
  }

  const rows: AdsTxtRow[] = websites.map((website) => {
    const publisher = (website as typeof website & { publishers: { business_name: string } | null }).publishers;
    return { ...website, adsTxtRecord: recordsByWebsite.get(website.id) ?? null, publisher };
  });

  const columns: DataTableColumn<AdsTxtRow>[] = [
    { id: "name", header: "Website", cell: (row) => row.name },
    { id: "domain", header: "Domain", cell: (row) => row.domain },
    { id: "publisher", header: "Publisher", cell: (row) => row.publisher?.business_name ?? "—" },
    {
      id: "verification",
      header: "Website Status",
      cell: (row) => (
        <StatusBadge tone={verificationTone(row.verification_status)}>
          {row.verification_status}
        </StatusBadge>
      ),
    },
    {
      id: "ads_txt",
      header: "Ads.txt",
      cell: (row) => {
        const record = row.adsTxtRecord;
        if (!record) return <span className="text-muted-foreground">No record</span>;
        return (
          <StatusBadge tone={record.is_verified ? "active" : "suspended"}>
            {record.is_verified ? "Verified" : "Not Verified"}
          </StatusBadge>
        );
      },
    },
    {
      id: "last_verified",
      header: "Last Verified",
      cell: (row) => {
        const record = row.adsTxtRecord;
        if (!record?.last_verified_at) return "—";
        return new Date(record.last_verified_at).toLocaleString();
      },
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDetailDialog({
              open: true,
              websiteId: row.id,
              websiteName: row.name,
            })
          }
        >
          View Record
        </Button>
      ),
    },
  ];

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Ads.txt Verification"
        description="Ads.txt verification status across all publisher websites."
      />

      {websitesQuery.isLoading ? (
        <LoadingState rows={4} label="Loading websites" />
      ) : adsTxtQuery.error ? (
        <ErrorState
          title="Couldn't load ads.txt records"
          message={adsTxtQuery.error.message}
          onRetry={() => void adsTxtQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle="No websites yet"
          emptyDescription="Websites will appear here once publishers add them."
        />
      )}

      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ads.txt Record — {detailDialog.websiteName}</DialogTitle>
            <DialogDescription>
              Ads.txt record details for this website.
            </DialogDescription>
          </DialogHeader>
          <AdsTxtDetail websiteId={detailDialog.websiteId} />
        </DialogContent>
      </Dialog>
    </WorkspaceGuard>
  );
}

function AdsTxtDetail({ websiteId }: { websiteId: string }) {
  const fetchAdsTxtFn = useServerFn(fetchAdsTxtRecord);

  const { data: record, isLoading, error } = useQuery({
    queryKey: ["publisher", "ads-txt", websiteId],
    enabled: Boolean(websiteId),
    queryFn: async () => {
      return fetchAdsTxtFn({ data: { websiteId } });
    },
  });

  if (isLoading) return <LoadingState rows={3} label="Loading ads.txt record" />;
  if (error) return <ErrorState title="Couldn't load record" message={error.message} />;
  if (!record) return <p className="text-sm text-muted-foreground">No ads.txt record found.</p>;

  const adsTxt = record as AdsTxtRecord;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Status</span>
        <StatusBadge tone={adsTxt.is_verified ? "active" : "suspended"}>
          {adsTxt.is_verified ? "Verified" : "Not Verified"}
        </StatusBadge>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Seller Record</p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{adsTxt.seller_record}</pre>
      </div>
      {adsTxt.last_verified_at && (
        <p className="text-xs text-muted-foreground">
          Last verified: {new Date(adsTxt.last_verified_at).toLocaleString()}
        </p>
      )}
      {adsTxt.verification_error && (
        <p className="text-xs text-destructive">Error: {adsTxt.verification_error}</p>
      )}
    </div>
  );
}

function verificationTone(status: string) {
  if (status === "verified") return "active";
  if (status === "failed") return "suspended";
  if (status === "pending") return "pending";
  return "neutral";
}
