import { useEffect, useMemo, useState } from "react";
import { Image, Search, Trash2, Upload, Check, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/states";
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { useCreatives, useAdvertiserOrg, useAdvertiserProfile, useDeleteCreative } from "@/hooks/use-advertiser";
import { toast } from "sonner";
import { CreativeUpload } from "@/components/advertiser/creative-upload";
import { toFriendlyError } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  onDelete,
  selectable,
  selected,
  onSelect,
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
    bucket: string;
    storage_path: string;
  };
  previewUrl: string | null;
  onDelete?: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const isImage = asset.mime_type.startsWith("image/");
  const sizeKb = Math.round((asset.file_size ?? 0) / 1024);

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-lg border ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
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
        <div className="flex items-center justify-between gap-2 pt-2">
          <StatusBadge tone={mediaStatusTone(asset.status)}>
            {asset.status}
          </StatusBadge>
          <div className="flex items-center gap-2">
            {selectable && asset.status === "ready" ? (
              <Button size="sm" onClick={() => onSelect?.(asset.id)}>
                <Check className="mr-1.5 size-3.5" />
                {selected ? "Selected" : "Use creative"}
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(asset.id)}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {new Date(asset.created_at).toLocaleDateString()}
            </span>
          </div>
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
  const profile = useAdvertiserProfile(organizationId);
  const deleteCreative = useDeleteCreative();
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectForAd, setSelectForAd] = useState<string | null>(null);
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectForAd(params.get("selectForAd"));
  }, []);

  async function handleDelete(assetId: string) {
    if (!window.confirm("Delete this creative? This can't be undone.")) return;
    try {
      const data = await deleteCreative.mutateAsync({ assetId });
      if (data?.archived) {
        toast.success("Creative archived because it's being used by an active ad.");
      } else {
        toast.success("Creative deleted.");
      }
      void refetch();
    } catch (error) {
      const message = toFriendlyError(error, "We couldn't delete that creative.").message;
      if (message.includes("doesn't exist")) {
        toast.success("Creative was already removed.");
        void refetch();
        return;
      }
      toast.error(message);
    }
  }

  function selectCreative(assetId: string) {
    if (!selectForAd) return;
    setSelectedCreative(assetId);
    window.location.href = `/advertiser/advertisements?editAd=${encodeURIComponent(selectForAd)}&creative=${encodeURIComponent(assetId)}`;
  }

  function UploadButton({ label }: { label: string }) {
    return (
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={!profile.data?.id}>
            <Upload className="mr-2 size-4" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload creative</DialogTitle>
            <DialogDescription>
              Add an image to your library so you can attach it to ads.
            </DialogDescription>
          </DialogHeader>
          {profile.data?.id && organizationId ? (
            <CreativeUpload
              organizationId={organizationId}
              advertiserId={profile.data.id}
              onUploaded={() => {
                setUploadOpen(false);
                void refetch();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete your advertiser profile in Settings before uploading creatives.
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (data ?? []).filter((asset) =>
      asset.file_name.toLowerCase().includes(term) || asset.mime_type.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <WorkspaceGuard workspace="advertiser">
      <PageHeader
        eyebrow="Advertiser"
        title="Creatives"
        description="Uploaded creative assets and their review status."
        actions={<UploadButton label="Upload" />}
      />

      {selectForAd ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold">Select a creative for your advertisement</p>
            <p className="text-xs text-muted-foreground">Choose a ready creative below. You will return to the advertisement editor automatically.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = "/advertiser/advertisements"; }}>
            <ArrowLeft className="mr-1.5 size-3.5" />Back to advertisements
          </Button>
        </div>
      ) : null}

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
          action={<UploadButton label="Upload creative" />}
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
            {filtered.map((asset) => {
              const publicUrl =
                asset.storage_provider === "cloudflare_r2"
                  ? asset.storage_path
                  : supabase.storage.from(asset.bucket).getPublicUrl(asset.storage_path).data.publicUrl;
              return (
                <CreativeCard
                  key={asset.id}
                  asset={asset}
                  previewUrl={publicUrl}
                  onDelete={selectForAd ? undefined : handleDelete}
                  selectable={Boolean(selectForAd)}
                  selected={selectedCreative === asset.id}
                  onSelect={selectCreative}
                />
              );
            })}
          </div>
        </>
      )}
    </WorkspaceGuard>
  );
}
