import { ImageOff } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCreativeUrl } from "@/hooks/use-advertiser";
import { cn } from "@/lib/utils";

/**
 * Renders a creative through the media service. Components never build
 * storage URLs themselves — the server hands back a short-lived signed URL.
 */
export function CreativePreview({
  assetId,
  alt,
  className,
}: {
  assetId: string | null;
  alt: string;
  className?: string;
}) {
  const { data, isLoading, error } = useCreativeUrl(assetId);

  if (!assetId || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-4" aria-hidden="true" />
        <span className="sr-only">{assetId ? "Preview unavailable" : "No creative attached"}</span>
      </div>
    );
  }

  if (isLoading || !data) return <Skeleton className={cn("rounded-md", className)} />;

  return (
    <img
      src={data.url}
      alt={alt}
      loading="lazy"
      className={cn("rounded-md border border-border bg-muted/30 object-contain", className)}
    />
  );
}
