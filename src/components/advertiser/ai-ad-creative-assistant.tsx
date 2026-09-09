import { useMemo, useState } from "react";
import { Copy, ImagePlus, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAiGenerateAdCreative } from "@/hooks/use-ai-ad-creative";
import { useAiGenerateAdImage } from "@/hooks/use-ai-image";
import { useCreateAd, useCampaignDetail } from "@/hooks/use-advertiser";
import type { AdFormat } from "@/lib/advertiser-domain";

export function AiAdCreativeAssistant({ organizationId, campaignId, adGroupId, websiteUrl, brandName, format }: { organizationId: string; campaignId: string; adGroupId: string; websiteUrl: string; brandName?: string; format?: string }) {
  const generate = useAiGenerateAdCreative();
  const generateImage = useAiGenerateAdImage();
  const createAd = useCreateAd();
  const { data: campaignDetail } = useCampaignDetail(campaignId);
  const availableAdGroups = campaignDetail?.adGroups ?? [];
  const [url, setUrl] = useState(websiteUrl);
  const [goal, setGoal] = useState("Drive clicks and conversions");
  const [result, setResult] = useState<Awaited<ReturnType<typeof generate.mutateAsync>> | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [generatedImage, setGeneratedImage] = useState<Awaited<ReturnType<typeof generateImage.mutateAsync>> | null>(null);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState(adGroupId);
  const currentFormat = useMemo(() => format || "300x250", [format]);
  const effectiveAdGroupId = availableAdGroups.some((group) => group.id === selectedAdGroupId) ? selectedAdGroupId : adGroupId;

  async function run() {
    if (!url.trim()) return toast.error("Enter the advertiser website URL first.");
    try { const data = await generate.mutateAsync({ organizationId, websiteUrl: url.trim(), format: currentFormat, brandName, goal }); setResult(data); setGeneratedImage(null); setSelectedConcept(null); toast.success("AI ad copy and creative recommendations are ready."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "AI creative generation failed."); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard."); } catch { toast.error("Clipboard access failed. Copy the text manually."); } }
  async function generateBanner(concept: string, index: number) {
    if (!result) return; setSelectedConcept(index);
    try { const image = await generateImage.mutateAsync({ organizationId, campaignId, productFocus: result.productFocus, productHighlights: result.productHighlights, concept, brandName, headline: result.headlines[0], cta: result.ctaRecommendations[0], format: "responsive" }); setGeneratedImage(image); toast.success("AI banner generated and saved to the Creative Library."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "AI banner generation failed."); } finally { setSelectedConcept(null); }
  }
  async function createDraft() {
    if (!result) return;
    if (!effectiveAdGroupId) return toast.error("Select an ad group before creating the ad.");
    if (!generatedImage?.assetId) return toast.error("Generate an AI banner before creating the ad draft. Every ad needs a creative before submitting.");
    let destinationUrl: string;
    try { const parsed = new URL(url.trim()); if (parsed.protocol !== "https:") throw new Error(); destinationUrl = parsed.toString(); }
    catch { return toast.error("Enter a valid HTTPS destination URL before creating the draft."); }
    try { await createAd.mutateAsync({ campaignId, adGroupId: effectiveAdGroupId, name: `${result.productFocus.slice(0, 90)} — AI Draft`, format: "responsive" as AdFormat, destinationUrl, mediaAssetId: generatedImage.assetId, adType: "static_image", brandName: brandName?.trim() || result.productFocus.slice(0, 120), headlines: result.headlines.slice(0, 5), longHeadline: result.longHeadline, descriptions: result.descriptions.slice(0, 5), cta: result.ctaRecommendations[0] ?? "Learn More", optimization: "auto_optimize" }); toast.success("AI banner and ad copy applied. Ad saved as a draft."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "We couldn't create the AI ad draft."); }
  }

  return <Card className="border-primary/20 bg-primary/[0.02] shadow-none">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" /> AI Creative Assistant</CardTitle><CardDescription>Analyze the advertiser website, write the ad, and generate a product-focused banner.</CardDescription></div><Button size="sm" onClick={() => void run()} disabled={generate.isPending || generateImage.isPending || createAd.isPending}>{generate.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <WandSparkles className="mr-1.5 size-4" />}Generate</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]"><div className="space-y-1.5"><Label htmlFor="ai-ad-website">Advertiser website / product page</Label><Input id="ai-ad-website" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/products" /></div><div className="space-y-1.5"><Label htmlFor="ai-ad-goal">Campaign goal</Label><Input id="ai-ad-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Drive sales" /></div></div>
      {result ? <div className="space-y-4">
        <div className="rounded-lg border bg-background p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product focus</p><p className="mt-1 text-sm font-semibold">{result.productFocus}</p>{result.productHighlights.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{result.productHighlights.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div>
        <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Suggested Headlines (5)</p><Button size="sm" variant="outline" onClick={() => void copy(result.headlines.join("\n"))}><Copy className="mr-1 size-3.5" /> Copy all</Button></div><div className="space-y-2">{result.headlines.map((headline, index) => <div key={`${headline}-${index}`} className="flex items-center gap-2 rounded-md border bg-background p-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="min-w-0 flex-1 text-sm">{headline}</span><Button size="icon" variant="ghost" aria-label="Copy headline" onClick={() => void copy(headline)}><Copy className="size-3.5" /></Button></div>)}</div></div>
        <div><p className="mb-2 text-sm font-semibold">Suggested Descriptions</p><div className="space-y-2">{result.descriptions.map((description, index) => <div key={`${description}-${index}`} className="flex gap-2 rounded-md border bg-background p-2"><span className="flex-1 text-xs leading-5">{description}</span><Button size="icon" variant="ghost" aria-label="Copy description" onClick={() => void copy(description)}><Copy className="size-3.5" /></Button></div>)}</div></div>
        <div className="grid gap-4 md:grid-cols-2"><div className="rounded-lg border bg-background p-3"><p className="text-sm font-semibold">Long headline</p><p className="mt-1 text-sm text-muted-foreground">{result.longHeadline}</p></div><div className="rounded-lg border bg-background p-3"><p className="text-sm font-semibold">Recommended CTAs</p><div className="mt-2 flex flex-wrap gap-1.5">{result.ctaRecommendations.map((item) => <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs">{item}</span>)}</div></div></div>
        <div><p className="mb-2 text-sm font-semibold">AI creative concepts</p><div className="grid gap-2 sm:grid-cols-2">{result.creativeConcepts.map((concept, index) => <div key={`${concept}-${index}`} className="rounded-lg border bg-background p-3"><p className="text-xs font-semibold text-primary">Concept {index + 1}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{concept}</p><Button size="sm" variant={generatedImage ? "outline" : "default"} className="mt-3" onClick={() => void generateBanner(concept, index)} disabled={generateImage.isPending || createAd.isPending}>{generateImage.isPending && selectedConcept === index ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 size-3.5" />}{generateImage.isPending && selectedConcept === index ? "Generating…" : "Generate banner"}</Button></div>)}</div></div>
        {generatedImage ? <div className="rounded-lg border border-primary/20 bg-background p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Generated AI banner</p><p className="text-xs text-muted-foreground">Saved to the Creative Library · {generatedImage.width}×{generatedImage.height}</p></div><Button size="sm" variant="outline" onClick={() => void createDraft()} disabled={createAd.isPending}>{createAd.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <WandSparkles className="mr-1.5 size-4" />}{createAd.isPending ? "Creating…" : "Use in Draft Ad"}</Button></div><div className="overflow-hidden rounded-md border bg-muted"><img src={generatedImage.previewUrl} alt="AI generated ad banner preview" className="max-h-[420px] w-full object-contain" /></div></div> : null}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3"><div><p className="text-sm font-semibold">Ad group</p><p className="text-xs text-muted-foreground">Choose where this AI ad should be placed before creating the draft.</p></div><Select value={effectiveAdGroupId} onValueChange={setSelectedAdGroupId}><SelectTrigger><SelectValue placeholder="Select an ad group" /></SelectTrigger><SelectContent>{availableAdGroups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Apply AI creative to this campaign</p><p className="text-xs text-muted-foreground">{generatedImage ? "Creates a responsive image ad draft in the selected ad group." : "Generate a banner above before creating the ad draft. Every ad needs a creative before submitting."}</p></div><Button onClick={() => void createDraft()} disabled={!generatedImage || !effectiveAdGroupId || createAd.isPending || generateImage.isPending}>{createAd.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <WandSparkles className="mr-1.5 size-4" />}{createAd.isPending ? "Creating…" : generatedImage ? "Create Draft Ad" : "Generate Banner First"}</Button></div></div>
        <p className="text-[11px] text-muted-foreground">Copy generated with {result.provider} · {result.model}. Image generated with Gemini · {generatedImage?.model ?? "not generated yet"}. Review AI assets before publishing.</p>
      </div> : null}
    </CardContent>
  </Card>;
}
