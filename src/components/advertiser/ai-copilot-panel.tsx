import { useState } from "react";
import { Loader2, Sparkles, Check, Copy, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useServerFn } from "@tanstack/react-start";
import {
  generateAICampaignPlan,
  generateAIAdCopy,
  generateAITargeting,
  generateAICreativeConcept,
} from "@/lib/ai-copilot.functions";
import type { CampaignPlan, AdCopyVariant, TargetingSuggestion, CreativeConcept } from "@/lib/ai/campaign-schema";

type PlanState = {
  loading: boolean;
  data: CampaignPlan | null;
  error: string | null;
};

type CopyState = {
  loading: boolean;
  data: AdCopyVariant[] | null;
  error: string | null;
};

type TargetingState = {
  loading: boolean;
  data: TargetingSuggestion | null;
  error: string | null;
};

type CreativeState = {
  loading: boolean;
  data: CreativeConcept | null;
  error: string | null;
};

export function AICopilotPanel({
  organizationId,
  onApplyCampaign,
  onApplyAdCopy,
  onApplyTargeting,
  onApplyCreative,
}: {
  organizationId: string;
  onApplyCampaign?: (plan: CampaignPlan) => void;
  onApplyAdCopy?: (variant: AdCopyVariant) => void;
  onApplyTargeting?: (suggestion: TargetingSuggestion) => void;
  onApplyCreative?: (concept: CreativeConcept) => void;
}) {
  const [activeTab, setActiveTab] = useState("campaign");
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [business, setBusiness] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [durationDays, setDurationDays] = useState("14");
  const [objective, setObjective] = useState("");
  const [website, setWebsite] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [planState, setPlanState] = useState<PlanState>({ loading: false, data: null, error: null });
  const [copyState, setCopyState] = useState<CopyState>({ loading: false, data: null, error: null });
  const [targetingState, setTargetingState] = useState<TargetingState>({ loading: false, data: null, error: null });
  const [creativeState, setCreativeState] = useState<CreativeState>({ loading: false, data: null, error: null });

  const generatePlan = useServerFn(generateAICampaignPlan);
  const generateCopy = useServerFn(generateAIAdCopy);
  const generateTargeting = useServerFn(generateAITargeting);
  const generateCreative = useServerFn(generateAICreativeConcept);

  const handleGeneratePlan = async () => {
    if (!description.trim()) return;
    setPlanState({ loading: true, data: null, error: null });
    try {
      const result = await generatePlan({
        data: {
          organizationId,
          description: description.trim(),
          currency,
          budget: budget ? Number(budget) : undefined,
          durationDays: durationDays ? Number(durationDays) : undefined,
          location: location || undefined,
          website: website || undefined,
          whatsapp: whatsapp || undefined,
          objective: objective || undefined,
        },
      });
      setPlanState({ loading: false, data: result, error: null });
    } catch (err) {
      setPlanState({ loading: false, data: null, error: err instanceof Error ? err.message : "Failed to generate plan" });
    }
  };

  const handleGenerateCopy = async () => {
    if (!product.trim() || !audience.trim()) return;
    setCopyState({ loading: true, data: null, error: null });
    try {
      const result = await generateCopy({
        data: {
          organizationId,
          product: product.trim(),
          audience: audience.trim(),
          action: "generate",
        },
      });
      setCopyState({ loading: false, data: result.variants, error: null });
    } catch (err) {
      setCopyState({ loading: false, data: null, error: err instanceof Error ? err.message : "Failed to generate copy" });
    }
  };

  const handleGenerateTargeting = async () => {
    if (!business.trim() || !location.trim() || !audience.trim()) return;
    setTargetingState({ loading: true, data: null, error: null });
    try {
      const result = await generateTargeting({
        data: {
          organizationId,
          business: business.trim(),
          location: location.trim(),
          audience: audience.trim(),
          budget: budget ? Number(budget) : 10000,
          currency,
        },
      });
      setTargetingState({ loading: true, data: result, error: null });
    } catch (err) {
      setTargetingState({ loading: false, data: null, error: err instanceof Error ? err.message : "Failed to generate targeting" });
    }
  };

  const handleGenerateCreative = async () => {
    if (!product.trim() || !audience.trim() || !message.trim()) return;
    setCreativeState({ loading: true, data: null, error: null });
    try {
      const result = await generateCreative({
        data: {
          organizationId,
          product: product.trim(),
          audience: audience.trim(),
          message: message.trim(),
          formats: ["300x250", "728x90", "320x50"],
        },
      });
      setCreativeState({ loading: true, data: result, error: null });
    } catch (err) {
      setCreativeState({ loading: false, data: null, error: err instanceof Error ? err.message : "Failed to generate creative concept" });
    }
  };

  const [message, setMessage] = useState("");
  const [copilotTab, setCopilotTab] = useState("campaign");

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Campaign Copilot</h3>
        </div>

        <Tabs value={copilotTab} onValueChange={setCopilotTab}>
          <TabsList className="w-full">
            <TabsTrigger value="campaign" className="flex-1">Campaign Plan</TabsTrigger>
            <TabsTrigger value="copy" className="flex-1">Ad Copy</TabsTrigger>
            <TabsTrigger value="targeting" className="flex-1">Targeting</TabsTrigger>
            <TabsTrigger value="creative" className="flex-1">Creative</TabsTrigger>
          </TabsList>

          <TabsContent value="campaign" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ai-description">What are you advertising?</Label>
              <Textarea
                id="ai-description"
                placeholder="I own a furniture shop in Nairobi. I want to promote office desks and chairs to businesses and homeowners..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-budget">Budget ({currency})</Label>
                <input
                  id="ai-budget"
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="10000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-duration">Duration (days)</Label>
                <input
                  id="ai-duration"
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="14"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-location">Location</Label>
                <input
                  id="ai-location"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Nairobi, Kenya"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-website">Website (optional)</Label>
                <input
                  id="ai-website"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-whatsapp">WhatsApp (optional)</Label>
              <input
                id="ai-whatsapp"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="+254712345678"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-objective">Campaign Objective (optional)</Label>
              <input
                id="ai-objective"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Sales, leads, awareness..."
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>

            <Button onClick={handleGeneratePlan} disabled={planState.loading || !description.trim()} className="w-full">
              {planState.loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Generate Campaign Plan
            </Button>

            {planState.error && <p className="text-sm text-destructive">{planState.error}</p>}

            {planState.data && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">AI Suggested Campaign Plan</h4>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">AI Suggested</span>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="overview">
                    <AccordionTrigger>Campaign Overview</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Name:</strong> {planState.data.campaign.name}</div>
                        <div><strong>Objective:</strong> {planState.data.campaign.objective}</div>
                        <div><strong>Summary:</strong> {planState.data.campaign.summary}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="budget">
                    <AccordionTrigger>Budget</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Total:</strong> {planState.data.budget.currency} {planState.data.budget.total.toLocaleString()}</div>
                        <div><strong>Daily:</strong> {planState.data.budget.currency} {planState.data.budget.daily.toLocaleString()}</div>
                        <div><strong>Duration:</strong> {planState.data.budget.duration_days} days</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="targeting">
                    <AccordionTrigger>Targeting</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        {planState.data.targeting.counties.length > 0 && (
                          <div><strong>Counties:</strong> {planState.data.targeting.counties.join(", ")}</div>
                        )}
                        {planState.data.targeting.cities.length > 0 && (
                          <div><strong>Cities:</strong> {planState.data.targeting.cities.join(", ")}</div>
                        )}
                        <div><strong>Age:</strong> {planState.data.targeting.age_min} - {planState.data.targeting.age_max}</div>
                        <div><strong>Devices:</strong> {planState.data.targeting.devices.join(", ")}</div>
                        {planState.data.targeting.interests.length > 0 && (
                          <div><strong>Interests:</strong> {planState.data.targeting.interests.join(", ")}</div>
                        )}
                        {planState.data.targeting.keywords.length > 0 && (
                          <div><strong>Keywords:</strong> {planState.data.targeting.keywords.join(", ")}</div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="ads">
                    <AccordionTrigger>Ad Variants ({planState.data.ads.length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {planState.data.ads.map((ad, i) => (
                          <div key={i} className="border rounded-md p-3 space-y-2">
                            <div className="font-medium">Variant {i + 1}</div>
                            <div className="text-sm"><strong>Headline:</strong> {ad.headline}</div>
                            <div className="text-sm"><strong>Primary Text:</strong> {ad.primary_text}</div>
                            <div className="text-sm"><strong>CTA:</strong> {ad.cta}</div>
                            <div className="text-sm text-muted-foreground"><strong>Concept:</strong> {ad.creative_concept}</div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {planState.data.recommendations.length > 0 && (
                    <AccordionItem value="recommendations">
                      <AccordionTrigger>Recommendations</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {planState.data.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {planState.data.warnings.length > 0 && (
                    <AccordionItem value="warnings">
                      <AccordionTrigger>Warnings</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                          {planState.data.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>

                {onApplyCampaign && (
                  <Button onClick={() => onApplyCampaign(planState.data!)} className="w-full">
                    Apply Recommendation
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="copy" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ai-product">Product/Service</Label>
              <input
                id="ai-product"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Office desks and chairs"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-audience">Target Audience</Label>
              <input
                id="ai-audience"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Businesses and homeowners in Nairobi"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>

            <Button onClick={handleGenerateCopy} disabled={copyState.loading || !product.trim() || !audience.trim()} className="w-full">
              {copyState.loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Generate Ad Copy
            </Button>

            {copyState.error && <p className="text-sm text-destructive">{copyState.error}</p>}

            {copyState.data && copyState.data.length > 0 && (
              <div className="space-y-3 mt-4">
                {copyState.data.map((variant, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Variant {i + 1} — {variant.tone}</span>
                      {onApplyAdCopy && (
                        <Button size="sm" variant="ghost" onClick={() => onApplyAdCopy(variant)}>
                          <Check className="size-3 mr-1" /> Use
                        </Button>
                      )}
                    </div>
                    <div className="text-sm"><strong>Headline:</strong> {variant.headline}</div>
                    <div className="text-sm"><strong>Primary Text:</strong> {variant.primary_text}</div>
                    <div className="text-sm"><strong>Description:</strong> {variant.description}</div>
                    <div className="text-sm"><strong>CTA:</strong> {variant.cta}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="targeting" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ai-business">Business</Label>
              <input
                id="ai-business"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Furniture shop in Nairobi"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-target-location">Location</Label>
              <input
                id="ai-target-location"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Nairobi, Kenya"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-target-audience">Audience</Label>
              <input
                id="ai-target-audience"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Business owners, homeowners"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>

            <Button onClick={handleGenerateTargeting} disabled={targetingState.loading || !business.trim() || !location.trim() || !audience.trim()} className="w-full">
              {targetingState.loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Suggest Targeting
            </Button>

            {targetingState.error && <p className="text-sm text-destructive">{targetingState.error}</p>}

            {targetingState.data && (
              <div className="space-y-2 mt-4 text-sm">
                <div><strong>Counties:</strong> {targetingState.data.counties.join(", ") || "None"}</div>
                <div><strong>Cities:</strong> {targetingState.data.cities.join(", ") || "None"}</div>
                <div><strong>Age:</strong> {targetingState.data.age_min} - {targetingState.data.age_max}</div>
                <div><strong>Devices:</strong> {targetingState.data.devices.join(", ")}</div>
                <div><strong>Interests:</strong> {targetingState.data.interests.join(", ") || "None"}</div>
                <div><strong>Keywords:</strong> {targetingState.data.keywords.join(", ") || "None"}</div>
                <div className="text-muted-foreground italic">{targetingState.data.reasoning}</div>
                {onApplyTargeting && (
                  <Button size="sm" onClick={() => onApplyTargeting(targetingState.data!)} className="mt-2">
                    Apply Targeting
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="creative" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ai-creative-product">Product/Service</Label>
              <input
                id="ai-creative-product"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Office desks and chairs"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-creative-audience">Audience</Label>
              <input
                id="ai-creative-audience"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Businesses and homeowners"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-message">Key Message</Label>
              <Textarea
                id="ai-message"
                placeholder="Quality furniture at affordable prices. Contact us on WhatsApp..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleGenerateCreative} disabled={creativeState.loading || !product.trim() || !audience.trim() || !message.trim()} className="w-full">
              {creativeState.loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Generate Creative Concept
            </Button>

            {creativeState.error && <p className="text-sm text-destructive">{creativeState.error}</p>}

            {creativeState.data && (
              <div className="space-y-2 mt-4 text-sm border rounded-md p-3">
                <div><strong>Headline:</strong> {creativeState.data.headline}</div>
                <div><strong>Supporting Text:</strong> {creativeState.data.supporting_text}</div>
                <div><strong>CTA:</strong> {creativeState.data.cta}</div>
                <div><strong>Visual Concept:</strong> {creativeState.data.visual_concept}</div>
                <div><strong>Dimensions:</strong> {creativeState.data.recommended_dimensions.join(", ")}</div>
                <div><strong>Composition:</strong> {creativeState.data.composition_notes}</div>
                <div><strong>Branding:</strong> {creativeState.data.branding_guidance}</div>
                {onApplyCreative && (
                  <Button size="sm" onClick={() => onApplyCreative(creativeState.data!)} className="mt-2">
                    Apply Concept
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
