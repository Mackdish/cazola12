import { useMemo, useState } from "react";
import { Copy, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAiGenerateAdCreative } from "@/hooks/use-ai-ad-creative";
import { useCreateAd } from "@/hooks/use-advertiser";
import type { AdFormat } from "@/lib/advertiser-domain";

export function AiAdCreativeAssistant({
  organizationId,
  campaignId,
  adGroupId,
  websiteUrl,
  brandName,
  format,
}: {
  organizationId: string;
  campaignId: string;
  adGroupId: string;
  websiteUrl: string;
  brandName?: string;
  format?: string;
}) {
  const generate = useAiGenerateAdCreative();
  const createAd = useCreateAd();
  const [url, setUrl] = useState(websiteUrl);
  const [goal, setGoal] = useState("Drive clicks and conversions");
  const [result, setResult] = useState<Awaited<ReturnType<typeof generate.mutateAsync>> | null>(null);

  const currentFormat = useMemo(() => format || "300x250", [format]);

  async function run() {
    if (!url.trim()) {
      toast.error("Enter the advertiser website URL first.");
      return;
    }
    try {
      const data = await generate.mutateAsync({
        organizationId,
        websiteUrl: url.trim(),
        format: currentFormat,
        brandName,
        goal,
      });
      setResult(data);
      toast.success("AI ad copy and creative recommendations are ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI creative generation failed.");
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  }

  async function createDraft() {
    if (!result) return;
    let destinationUrl: string;
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:") throw new Error("Use an HTTPS destination URL.");
      destinationUrl = parsed.toString();
    } catch {
      toast.error("Enter a valid HTTPS destination URL before creating the draft.");
      return;
    }

    try {
      await createAd.mutateAsync({
        campaignId,
        adGroupId,
        name: `${result.productFocus.slice(0, 90)} — AI Draft`,
        format: currentFormat as AdFormat,
        destinationUrl,
        adType: "responsive_display",
        brandName: brandName?.trim() || result.productFocus.slice(0, 120),
        headlines: result.headlines.slice(0, 5),
        longHeadline: result.longHeadline,
        descriptions: result.descriptions.slice(0, 5),
        cta: result.ctaRecommendations[0] ?? "Learn More",
        optimization: "auto_optimize",
      });
      toast.success("AI creative applied. Ad saved as a draft.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't create the AI ad draft.");
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> AI Creative Assistant
            </CardTitle>
            <CardDescription>
              Analyze the advertiser website and recommend product-focused ad copy and creative concepts.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => void run()} disabled={generate.isPending || createAd.isPending}>
            {generate.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <WandSparkles className="mr-1.5 size-4" />}
            Generate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <div className="space-y-1.5">
            <Label htmlFor="ai-ad-website">Advertiser website / product page</Label>
            <Input id="ai-ad-website" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/products" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-ad-goal">Campaign goal</Label>
            <Input id="ai-ad-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Drive sales" />
          </div>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product focus</p>
              <p className="mt-1 text-sm font-semibold">{result.productFocus}</p>
              {result.productHighlights.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {result.productHighlights.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Suggested Headlines (5)</p>
                <Button size="sm" variant="outline" onClick={() => void copy(result.headlines.join("\n"))}><Copy className="mr-1 size-3.5" /> Copy all</Button>
              </div>
              <div className="space-y-2">
                {result.headlines.map((headline, index) => (
                  <div key={`${headline}-${index}`} className="flex items-center gap-2 rounded-md border bg-background p-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                    <span className="min-w-0 flex-1 text-sm">{headline}</span>
                    <Button size="icon" variant="ghost" aria-label="Copy headline" onClick={() => void copy(headline)}><Copy className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Suggested Descriptions</p>
              <div className="space-y-2">
                {result.descriptions.map((description, index) => (
                  <div key={`${description}-${index}`} className="flex gap-2 rounded-md border bg-background p-2">
                    <span className="flex-1 text-xs leading-5">{description}</span>
                    <Button size="icon" variant="ghost" aria-label="Copy description" onClick={() => void copy(description)}><Copy className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">Long headline</p>
                <p className="mt-1 text-sm text-muted-foreground">{result.longHeadline}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">Recommended CTAs</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.ctaRecommendations.map((item) => <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs">{item}</span>)}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">AI creative concepts</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.creativeConcepts.map((concept, index) => (
                  <div key={`${concept}-${index}`} className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-semibold text-primary">Concept {index + 1}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{concept}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm font-semibold">Recommended formats</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.recommendedFormats.map((item) => <span key={item} className="rounded-full border px-2.5 py-1 text-xs">{item}</span>)}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div>
                <p className="text-sm font-semibold">Apply AI creative to this campaign</p>
                <p className="text-xs text-muted-foreground">Creates a responsive-display ad draft with the generated copy. You can add the final image creative before publishing.</p>
              </div>
              <Button onClick={() => void createDraft()} disabled={createAd.isPending}>
                {createAd.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <WandSparkles className="mr-1.5 size-4" />}
                {createAd.isPending ? "Creating…" : "Create Draft Ad"}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">Generated with {result.provider} · {result.model}. Review AI copy before publishing.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
