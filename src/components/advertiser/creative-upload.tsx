import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUploadCreative } from "@/hooks/use-advertiser";
import {
  ALLOWED_CREATIVE_MIME_TYPES,
  formatFileSize,
  MAX_CREATIVE_BYTES,
  validateCreativeFile,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";

export function CreativeUpload({
  organizationId,
  advertiserId,
  campaignId,
  onUploaded,
  label = "Upload creative",
}: {
  organizationId: string;
  advertiserId: string;
  campaignId?: string | null;
  onUploaded?: (assetId: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCreative();
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    const check = validateCreativeFile({ mimeType: file.type, fileSize: file.size });
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    try {
      const asset = await upload.mutateAsync({
        organizationId,
        advertiserId,
        campaignId: campaignId ?? null,
        file,
      });
      toast.success(`Uploaded ${asset.file_name} (${asset.width}×${asset.height}).`);
      onUploaded?.(asset.id);
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't upload that creative").message);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WebP or GIF · up to {formatFileSize(MAX_CREATIVE_BYTES)}. Dimensions are read from
        the file itself.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_CREATIVE_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? "Uploading…" : "Choose file"}
      </Button>
    </div>
  );
}
