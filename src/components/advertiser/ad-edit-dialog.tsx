import { useEffect, useState } from "react";
import { Edit3, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateAdvertiserAd } from "@/hooks/use-advertiser-edit";
import { AD_FORMATS, normalizeDestinationUrl, type AdFormat, type MediaAsset } from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";

type Ad = {
  id: string;
  name: string;
  format: AdFormat;
  destination_url: string;
  media_asset_id: string | null;
  brand_name: string | null;
  logo_media_asset_id: string | null;
  headlines: unknown;
  long_headline: string | null;
  descriptions: unknown;
  cta: string | null;
  tracking_url: string | null;
  optimization: string | null;
};

const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function AdEditDialog({
  ad,
  mediaAssets,
  disabled,
  autoOpen,
  selectedCreativeId,
}: {
  ad: Ad;
  mediaAssets: MediaAsset[];
  disabled?: boolean;
  autoOpen?: boolean;
  selectedCreativeId?: string | null;
}) {
  const update = useUpdateAdvertiserAd();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [name, setName] = useState(ad.name);
  const [format, setFormat] = useState<AdFormat>(ad.format);
  const [destinationUrl, setDestinationUrl] = useState(ad.destination_url);
  const [mediaAssetId, setMediaAssetId] = useState(ad.media_asset_id ?? "");
  const [brandName, setBrandName] = useState(ad.brand_name ?? "");
  const [logoMediaAssetId, setLogoMediaAssetId] = useState(ad.logo_media_asset_id ?? "");
  const [headlines, setHeadlines] = useState<string[]>([...asStrings(ad.headlines), "", "", "", "", ""].slice(0, 5));
  const [longHeadline, setLongHeadline] = useState(ad.long_headline ?? "");
  const [descriptions, setDescriptions] = useState<string[]>([...asStrings(ad.descriptions), "", "", "", "", ""].slice(0, 5));
  const [cta, setCta] = useState(ad.cta ?? "");
  const [trackingUrl, setTrackingUrl] = useState(ad.tracking_url ?? "");
  const [optimization, setOptimization] = useState(ad.optimization ?? "auto_optimize");

  useEffect(() => {
    if (!open) return;
    setName(ad.name); setFormat(ad.format); setDestinationUrl(ad.destination_url);
    setMediaAssetId(selectedCreativeId || ad.media_asset_id || "");
    setBrandName(ad.brand_name ?? ""); setLogoMediaAssetId(ad.logo_media_asset_id ?? "");
    setHeadlines([...asStrings(ad.headlines), "", "", "", "", ""].slice(0, 5)); setLongHeadline(ad.long_headline ?? "");
    setDescriptions([...asStrings(ad.descriptions), "", "", "", "", ""].slice(0, 5)); setCta(ad.cta ?? "");
    setTrackingUrl(ad.tracking_url ?? ""); setOptimization(ad.optimization ?? "auto_optimize");
  }, [open, ad, selectedCreativeId]);

  async function save() {
    const url = normalizeDestinationUrl(destinationUrl);
    const cleanHeadlines = headlines.map((value) => value.trim()).filter(Boolean);
    const cleanDescriptions = descriptions.map((value) => value.trim()).filter(Boolean);
    if (!url) return toast.error("Enter a valid HTTPS destination URL.");
    if (name.trim().length < 2) return toast.error("Ad name is required.");
    if (!mediaAssetId) return toast.error("Select a creative image.");
    if (!cleanHeadlines.length) return toast.error("Add at least one headline.");
    if (!cleanDescriptions.length) return toast.error("Add at least one description.");
    try {
      await update.mutateAsync({ adId: ad.id, name: name.trim(), format, destinationUrl: url, mediaAssetId, brandName: brandName.trim() || null, logoMediaAssetId: logoMediaAssetId || null, headlines: cleanHeadlines, longHeadline: longHeadline.trim() || null, descriptions: cleanDescriptions, cta: cta.trim() || null, trackingUrl: trackingUrl.trim() || null, optimization });
      toast.success("Ad changes saved. The ad is ready for review again.");
      setOpen(false);
    } catch (error) { toast.error(toFriendlyError(error, "We couldn't save the ad").message); }
  }

  function openCreativeLibrary() {
    const params = new URLSearchParams({ selectForAd: ad.id });
    window.location.href = `/advertiser/creatives?${params.toString()}`;
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" disabled={disabled}><Edit3 className="mr-1.5 size-3.5" />Edit</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Edit advertisement</DialogTitle><DialogDescription>Edit AI-generated or existing ad content. Changes to submitted/approved ads return the creative to review.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2"><Label>Ad name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Format</Label><Select value={format} onValueChange={(value) => setFormat(value as AdFormat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AD_FORMATS.map((entry) => <SelectItem key={entry.format} value={entry.format}>{entry.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Creative</Label><div className="rounded-md border bg-muted/20 p-2"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">Selected creative</p><p className="truncate text-sm font-medium">{mediaAssets.find((asset) => asset.id === mediaAssetId)?.file_name ?? (mediaAssetId ? "Selected creative" : "No creative selected")}</p></div><Button type="button" size="sm" variant="outline" onClick={openCreativeLibrary}><ExternalLink className="mr-1.5 size-3.5" />Choose from Creatives</Button></div></div></div>
        </div>
        <div className="space-y-2"><Label>Destination URL</Label><Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} maxLength={2048} /></div>
        <div className="space-y-2"><Label>Brand name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={120} /></div>
        <div className="space-y-2"><Label>Logo</Label><Select value={logoMediaAssetId || "none"} onValueChange={(value) => setLogoMediaAssetId(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="No logo" /></SelectTrigger><SelectContent><SelectItem value="none">No logo</SelectItem>{mediaAssets.filter((asset) => asset.status === "ready").map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.file_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-3"><Label>Headlines</Label>{headlines.map((value, index) => <div key={index} className="space-y-1"><Input value={value} onChange={(e) => setHeadlines((prev) => { const next = [...prev]; next[index] = e.target.value.slice(0, 90); return next; })} placeholder={`Headline ${index + 1}`} maxLength={90} /><p className="text-right text-[11px] text-muted-foreground">{value.length}/90</p></div>)}</div>
        <div className="space-y-2"><Label>Long headline</Label><Input value={longHeadline} onChange={(e) => setLongHeadline(e.target.value.slice(0, 120))} maxLength={120} /><p className="text-right text-[11px] text-muted-foreground">{longHeadline.length}/120</p></div>
        <div className="space-y-3"><Label>Descriptions</Label>{descriptions.map((value, index) => <div key={index} className="space-y-1"><Textarea value={value} onChange={(e) => setDescriptions((prev) => { const next = [...prev]; next[index] = e.target.value.slice(0, 150); return next; })} placeholder={`Description ${index + 1}`} maxLength={150} rows={2} /><p className="text-right text-[11px] text-muted-foreground">{value.length}/150</p></div>)}</div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>CTA</Label><Input value={cta} onChange={(e) => setCta(e.target.value.slice(0, 40))} maxLength={40} /></div><div className="space-y-2"><Label>Optimization</Label><Select value={optimization} onValueChange={setOptimization}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto_optimize">Automatically optimize</SelectItem><SelectItem value="rotate_evenly">Rotate evenly</SelectItem></SelectContent></Select></div></div>
        <div className="space-y-2"><Label>Tracking URL</Label><Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} maxLength={2048} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={update.isPending}>{update.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}{update.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
