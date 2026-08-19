import { useMemo, useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Image, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useCreatives, useAdvertiserOrg } from "@/hooks/use-advertiser";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/advertiser/creatives")({
  head: () => ({
    meta: [
      { title: "Creatives — Advertiser — TradeMall" },
      { name: "description", content: "Uploaded creative assets and their review status." },
      { property: "og:title", content: "Creatives — Advertiser — TradeMall" },
      {
        property: "og:description",
        content: "Uploaded creative assets and their review status.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function CreativeCard({
  asset,
  previewUrl,
}: {
  asset: {
    id: string;
    file_name: string;
    mime_type: string;
    width: number | null;
    height: number | null;
    file_size: number;
    status: string;
    created_at: string;
  };
  previewUrl: string | null;
}) {
  const isImage = asset.mime_type.startsWith("image/");
  const sizeKb = Math.round((asset.file_size ?? 0) / 1024);

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={asset.file_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate text-sm font-medium" title={asset.file_name}>
          {asset.file_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{asset.mime_type.split("/")[1]?.toUpperCase() ?? asset.mime_type}</span>
          {asset.width && asset.height ? (
            <span>{asset.width}×{asset.height}</span>
          ) : null}
          <span>{sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <StatusBadge tone={mediaStatusTone(asset.status)}>
            {asset.status}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">
            {new Date(asset.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

const MEDIA_STATUS_TONE: Record<string, StatusTone> = {
  ready: "active",
  pending: "pending",
  rejected: "suspended",
  archived: "neutral",
};

function mediaStatusTone(status: string) {
  return MEDIA_STATUS_TONE[status] ?? "neutral";
}

function Page() {
  const { organizationId } = useAdvertiserOrg();
  const { data, isLoading, error, refetch } = useCreatives(organizationId);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("Creative upload requires storage configuration. Please contact support.");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (data ?? []).filter((asset) =>
      asset.file_name.toLowerCase().includes(term) || asset.mime_type.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <WorkspaceGuard workspace="advertiser">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <PageHeader
        eyebrow="Advertiser"
        title="Creatives"
        description="Uploaded creative assets and their review status."
        actions={
          <Button size="sm" variant="outline" onClick={handleUploadClick}>
            <Upload className="mr-2 size-4" />
            Upload
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading creatives" />
      ) : error ? (
        <ErrorState
          title="Couldn't load creatives"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Image className="size-5" />}
          title="No creatives yet"
          description="Upload images or other media to use in your ads."
          action={
            <Button size="sm" variant="outline" onClick={handleUploadClick}>
              <Upload className="mr-2 size-4" />
              Upload creative
            </Button>
          }
        />
      ) : (
        <>
          <div className="mt-6 max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search creatives..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => (
              <CreativeCard key={asset.id} asset={asset} previewUrl={null} />
            ))}
          </div>
        </>
      )}
    </WorkspaceGuard>
  );
}
