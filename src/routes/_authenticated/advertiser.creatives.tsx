import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Image, Search, Trash2, Upload } from "lucide-react";

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
          <div className="flex items-center gap-2">
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
                <CreativeCard key={asset.id} asset={asset} previewUrl={publicUrl} onDelete={handleDelete} />
              );
            })}
          </div>
        </>
      )}
    </WorkspaceGuard>
  );
}
