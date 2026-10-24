import { useEffect, useMemo, useState } from "react";
import { Plus, Monitor, Smartphone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreativeUpload } from "@/components/advertiser/creative-upload";
import { CreativePreview } from "@/components/advertiser/creative-preview";
import { useCreateAd } from "@/hooks/use-advertiser";
import {
  AD_FORMATS,
  normalizeDestinationUrl,
  validateCreativeAgainstFormat,
  type AdFormat,
  type MediaAsset,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";

const AD_TYPES = [
  { value: "static_image", label: "Static Image", enabled: true },
  { value: "responsive_display", label: "Responsive Display", enabled: true },
  { value: "native", label: "Native", enabled: false },
  { value: "html5", label: "HTML5", enabled: false },
] as const;

const CTA_OPTIONS = [
  "Learn More",
  "Get Started",
  "Shop Now",
  "Sign Up",
  "Contact Us",
  "Book Now",
  "Download",
  "Apply Now",
  "Get Quote",
];

const OPTIMIZATION_OPTIONS = [
  {
    value: "auto_optimize",
    label: "Automatically optimize performance",
    description: "Let the system optimize delivery over time.",
  },
  {
    value: "rotate_evenly",
    label: "Rotate creatives evenly",
    description: "Show each creative in your set equally.",
  },
];

type AdType = (typeof AD_TYPES)[number]["value"];

export function AdDialog({
  campaignId,
  organizationId,
  advertiserId,
  adGroups,
  mediaAssets,
  disabled,
}: {
  campaignId: string;
  organizationId: string;
  advertiserId: string;
  adGroups: Array<{ id: string; name: string }>;
  mediaAssets: MediaAsset[];
  disabled?: boolean;
}) {
  const createAd = useCreateAd();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [adGroupId, setAdGroupId] = useState(adGroups[0]?.id ?? "");
  const [format, setFormat] = useState<AdFormat>("300x250");
  const [adType, setAdType] = useState<AdType>("static_image");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [logoAssetId, setLogoAssetId] = useState<string>("");
  const [creativeAssetId, setCreativeAssetId] = useState<string>("");
  const [creativeSelectOpen, setCreativeSelectOpen] = useState(false);
  const [logoSelectOpen, setLogoSelectOpen] = useState(false);
  const [headlines, setHeadlines] = useState<string[]>(["", "", "", "", ""]);
  const [longHeadline, setLongHeadline] = useState("");
  const [descriptions, setDescriptions] = useState<string[]>(["", "", "", "", ""]);
  const [cta, setCta] = useState("");
  const [optimization, setOptimization] = useState("auto_optimize");

  const [submitting, setSubmitting] = useState(false);
  const [destinationValid, setDestinationValid] = useState<boolean | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);

  const selectedCreative = mediaAssets.find((a) => a.id === creativeAssetId) ?? null;
  const selectedLogo = mediaAssets.find((a) => a.id === logoAssetId) ?? null;

  const dimensionCheck = selectedCreative
    ? validateCreativeAgainstFormat(format, {
        width: selectedCreative.width ?? 0,
        height: selectedCreative.height ?? 0,
      })
    : null;

  const filteredMediaAssets = useMemo(() => {
    if (adType === "responsive_display" || adType === "static_image") return mediaAssets;
    return [];
  }, [adType, mediaAssets]);

  const generatedUtm = useMemo(() => {
    if (!destinationUrl) return null;
    try {
      const url = new URL(destinationUrl);
      url.searchParams.set("utm_source", "trademall");
      url.searchParams.set("utm_medium", "ad");
      url.searchParams.set("utm_campaign", name.trim() || "campaign");
      return url.toString();
    } catch {
      return null;
    }
  }, [destinationUrl, name]);

  useEffect(() => {
    let active = true;
    async function check() {
      const url = normalizeDestinationUrl(destinationUrl);
      if (!url) {
        if (active) setDestinationValid(null);
        return;
      }
      if (active) setCheckingUrl(true);
      try {
        const res = await fetch(url, {
          method: "HEAD",
          mode: "no-cors",
          signal: AbortSignal.timeout(8000),
        });
        if (active) setDestinationValid(res.ok || true);
      } catch {
        if (active) setDestinationValid(false);
      } finally {
        if (active) setCheckingUrl(false);
      }
    }
    const timer = setTimeout(check, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [destinationUrl]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (name.trim().length < 2) errors.push("Ad name is required.");
    if (!adGroupId) errors.push("Select an ad group.");
    if (!format) errors.push("Select a format.");
    if (!adType) errors.push("Select an ad type.");
    const url = normalizeDestinationUrl(destinationUrl);
    if (!url) errors.push("Enter a valid HTTPS destination URL.");
    if (destinationValid === false) errors.push("Destination URL is not reachable.");
    if (!brandName.trim()) errors.push("Enter a brand or business name.");
    if (!selectedCreative && adType === "static_image") errors.push("Upload a creative image.");
    if (dimensionCheck && !dimensionCheck.ok) errors.push(dimensionCheck.message);
    const nonEmptyHeadlines = headlines.filter((h) => h.trim().length > 0);
    if (nonEmptyHeadlines.length === 0) errors.push("Add at least one headline.");
    const nonEmptyDescriptions = descriptions.filter((d) => d.trim().length > 0);
    if (nonEmptyDescriptions.length === 0) errors.push("Add at least one description.");
    if (!cta) errors.push("Select a call-to-action.");

    return {
      errors,
      valid: errors.length === 0,
      creativeValid: !!selectedCreative && (!dimensionCheck || dimensionCheck.ok),
      destinationValid: !!url && destinationValid !== false,
      fieldsComplete:
        name.trim().length >= 2 &&
        !!adGroupId &&
        !!format &&
        !!adType &&
        !!brandName.trim() &&
        !!cta,
    };
  }, [
    name,
    adGroupId,
    format,
    adType,
    destinationUrl,
    brandName,
    selectedCreative,
    dimensionCheck,
    headlines,
    descriptions,
    cta,
    destinationValid,
  ]);

  async function submit() {
    if (!validation.valid) {
      toast.error("Please fix the validation errors before creating the ad.");
      return;
    }
    setSubmitting(true);
    try {
      const url = normalizeDestinationUrl(destinationUrl);
      if (!url) throw new Error("Enter a valid HTTPS destination URL.");

      await createAd.mutateAsync({
        campaignId,
        adGroupId,
        name: name.trim(),
        format,
        adType,
        destinationUrl: url,
        trackingUrl: trackingUrl.trim() || null,
        mediaAssetId: creativeAssetId || null,
        brandName: brandName.trim(),
        logoMediaAssetId: logoAssetId || null,
        headlines: headlines.filter((h) => h.trim().length > 0),
        longHeadline: longHeadline.trim() || null,
        descriptions: descriptions.filter((d) => d.trim().length > 0),
        cta: cta || null,
        optimization,
      });
      toast.success("Ad created as a draft.");
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't create that ad").message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setAdGroupId(adGroups[0]?.id ?? "");
    setFormat("300x250");
    setAdType("static_image");
    setDestinationUrl("");
    setTrackingUrl("");
    setBrandName("");
    setLogoAssetId("");
    setCreativeAssetId("");
    setHeadlines(["", "", "", "", ""]);
    setLongHeadline("");
    setDescriptions(["", "", "", "", ""]);
    setCta("");
    setOptimization("auto_optimize");
    setDestinationValid(null);
  }

  function renderHeadlineInput(index: number) {
    return (
      <Input
        key={`headline-${index}`}
        placeholder={`Headline ${index + 1}`}
        value={headlines[index] ?? ""}
        onChange={(e) =>
          setHeadlines((prev) => {
            const next = [...prev];
            next[index] = e.target.value.slice(0, 90);
            return next;
          })
        }
        maxLength={90}
      />
    );
  }

  function renderDescriptionInput(index: number) {
    return (
      <Textarea
        key={`desc-${index}`}
        placeholder={`Description ${index + 1}`}
        value={descriptions[index] ?? ""}
        onChange={(e) =>
          setDescriptions((prev) => {
            const next = [...prev];
            next[index] = e.target.value.slice(0, 150);
            return next;
          })
        }
        maxLength={150}
        rows={2}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="mr-1 size-4" />
          New ad
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create an ad</DialogTitle>
          <DialogDescription>
            Build your creative, set the destination, and preview how it will look.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Basic information</p>
            <div className="space-y-2">
              <Label htmlFor="ad-name">Ad name *</Label>
              <Input
                id="ad-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer sale — display"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ad-group">Ad group *</Label>
                <Select value={adGroupId} onValueChange={setAdGroupId}>
                  <SelectTrigger id="ad-group">
                    <SelectValue placeholder="Select an ad group" />
                  </SelectTrigger>
                  <SelectContent>
                    {adGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-format">Format *</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as AdFormat)}>
                  <SelectTrigger id="ad-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_FORMATS.map((entry) => (
                      <SelectItem key={entry.format} value={entry.format}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-type">Ad type *</Label>
              <Select value={adType} onValueChange={(value) => setAdType(value as AdType)}>
                <SelectTrigger id="ad-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_TYPES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value} disabled={!entry.enabled}>
                      {entry.label}
                      {!entry.enabled ? " (coming soon)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Destination</p>
            <div className="space-y-2">
              <Label htmlFor="ad-url">Final URL *</Label>
              <Input
                id="ad-url"
                placeholder="https://example.com/offer"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
              />
              {checkingUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Checking reachability…
                </p>
              )}
              {generatedUtm && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Auto-generated URL with UTM
                  </p>
                  <code className="block rounded bg-muted p-2 text-xs break-all">
                    {generatedUtm}
                  </code>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-tracking">Tracking URL (optional)</Label>
              <Input
                id="ad-tracking"
                placeholder="https://tracker.example.com/click?aid=123"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Brand Assets */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Brand assets</p>
            <div className="space-y-2">
              <Label htmlFor="ad-brand">Business / brand name *</Label>
              <Input
                id="ad-brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {selectedLogo ? (
                <div className="flex items-center gap-3">
                  <CreativePreview
                    assetId={selectedLogo.id}
                    alt={selectedLogo.file_name}
                    className="h-12 w-12 object-contain"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setLogoAssetId("")}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <CreativeUpload
                    organizationId={organizationId}
                    advertiserId={advertiserId}
                    campaignId={campaignId}
                    onUploaded={(id) => setLogoAssetId(id)}
                    label="Upload a logo"
                  />
                  {mediaAssets.length > 0 ? (
                    <Dialog open={logoSelectOpen} onOpenChange={setLogoSelectOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Select existing
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Select existing logo</DialogTitle>
                          <DialogDescription>
                            Choose a logo from your organization's existing media assets.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {mediaAssets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                setLogoAssetId(asset.id);
                                setLogoSelectOpen(false);
                              }}
                              className="flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary"
                            >
                              <img
                                src={
                                  asset.storage_provider === "cloudflare_r2"
                                    ? asset.storage_path
                                    : supabase.storage.from(asset.bucket).getPublicUrl(asset.storage_path).data.publicUrl
                                }
                                alt={asset.file_name}
                                loading="lazy"
                                decoding="async"
                                className="h-16 w-16 rounded object-contain"
                              />
                              <span className="truncate text-xs font-medium">{asset.file_name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {asset.mime_type.split("/")[1]?.toUpperCase() ?? asset.mime_type}
                                {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Creative Assets */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Creative assets</p>
            {selectedCreative ? (
              <div className="space-y-2">
                <Label>Selected creative</Label>
                <div className="flex items-center gap-3">
                  <CreativePreview
                    assetId={selectedCreative.id}
                    alt={selectedCreative.file_name}
                    className="h-24 w-40 object-contain"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setCreativeAssetId("")}>
                    Change
                  </Button>
                </div>
                {dimensionCheck && !dimensionCheck.ok && (
                  <p className="text-xs text-destructive">{dimensionCheck.message}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <CreativeUpload
                  organizationId={organizationId}
                  advertiserId={advertiserId}
                  campaignId={campaignId}
                  onUploaded={(id) => setCreativeAssetId(id)}
                  label="Upload a creative"
                />
                {mediaAssets.length > 0 ? (
                  <Dialog open={creativeSelectOpen} onOpenChange={setCreativeSelectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Select existing
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Select existing creative</DialogTitle>
                        <DialogDescription>
                          Choose a creative from your organization's existing media assets.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {mediaAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              setCreativeAssetId(asset.id);
                              setCreativeSelectOpen(false);
                            }}
                            className="flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary"
                          >
                            <img
                              src={
                                asset.storage_provider === "cloudflare_r2"
                                  ? asset.storage_path
                                  : supabase.storage.from(asset.bucket).getPublicUrl(asset.storage_path).data.publicUrl
                              }
                              alt={asset.file_name}
                              loading="lazy"
                              decoding="async"
                              className="h-16 w-16 rounded object-contain"
                            />
                            <span className="truncate text-xs font-medium">{asset.file_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {asset.mime_type.split("/")[1]?.toUpperCase() ?? asset.mime_type}
                              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <Label>Headlines (up to 5)</Label>
              <div className="grid gap-2">{headlines.map((_, i) => renderHeadlineInput(i))}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-long-headline">Long headline</Label>
              <Input
                id="ad-long-headline"
                value={longHeadline}
                onChange={(e) => setLongHeadline(e.target.value.slice(0, 120))}
                placeholder="One compelling sentence about your offer"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Descriptions (up to 5)</Label>
              <div className="grid gap-2">
                {descriptions.map((_, i) => renderDescriptionInput(i))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-cta">Call to action *</Label>
              <Select value={cta} onValueChange={setCta}>
                <SelectTrigger id="ad-cta">
                  <SelectValue placeholder="Select a CTA" />
                </SelectTrigger>
                <SelectContent>
                  {CTA_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Format Requirements */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Format requirements</p>
            <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
              {(() => {
                const spec = AD_FORMATS.find((f) => f.format === format);
                if (!spec) return null;
                return (
                  <>
                    <p>
                      <span className="font-medium text-foreground">Format:</span> {spec.label} (
                      {spec.format})
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Dimensions:</span>{" "}
                      {spec.width && spec.height
                        ? `${spec.width} × ${spec.height}px`
                        : "Responsive (any size)"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Max file size:</span>{" "}
                      {format === "responsive" ? "2 MB" : "2 MB (images), 1 MB (GIF)"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Supported types:</span> PNG,
                      JPG, WebP, GIF
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Live preview</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Advertisement
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={undefined}
                className="flex-1"
                onClick={() => {}}
              >
                <Monitor className="mr-1 size-4" /> Desktop
              </Button>
              <Button type="button" size="sm" variant="ghost" className="flex-1" onClick={() => {}}>
                <Smartphone className="mr-1 size-4" /> Mobile
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mx-auto max-w-lg space-y-3">
                {selectedCreative ? (
                  <CreativePreview
                    assetId={selectedCreative.id}
                    alt={name || "Ad preview"}
                    className="w-full rounded-md"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
                    Upload a creative to preview
                  </div>
                )}
                <div className="space-y-1">
                  {headlines
                    .filter((h) => h.trim())
                    .slice(0, 1)
                    .map((h) => (
                      <p key={h} className="text-sm font-semibold leading-tight">
                        {h}
                      </p>
                    ))}
                  {longHeadline && <p className="text-xs text-muted-foreground">{longHeadline}</p>}
                  {descriptions
                    .filter((d) => d.trim())
                    .slice(0, 1)
                    .map((d) => (
                      <p key={d} className="text-xs text-muted-foreground line-clamp-2">
                        {d}
                      </p>
                    ))}
                  {brandName && (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {brandName}
                    </p>
                  )}
                  {cta && (
                    <span className="inline-block rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                      {cta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Creative Optimization */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Creative optimization</p>
            {OPTIMIZATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  optimization === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name="optimization"
                  value={option.value}
                  checked={optimization === option.value}
                  onChange={(e) => setOptimization(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Validation */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Before you create</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                {validation.fieldsComplete ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>Required fields complete</span>
              </div>
              <div className="flex items-center gap-2">
                {validation.creativeValid ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>Creative valid</span>
              </div>
              <div className="flex items-center gap-2">
                {validation.destinationValid ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>Destination valid</span>
              </div>
            </div>
            {validation.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.errors.map((err) => (
                  <p key={err} className="text-xs text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={submitting || createAd.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || createAd.isPending || !validation.valid}
          >
            {submitting || createAd.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
