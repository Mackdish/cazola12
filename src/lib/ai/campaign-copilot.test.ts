import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
import { CampaignPlanSchema, AdCopyVariantSchema, TargetingSuggestionSchema, CreativeConceptSchema } from "@/lib/ai/campaign-schema";
import { generateCampaignPlan, generateAdCopy, generateTargetingSuggestion, generateCreativeConcept, AIServiceError, getAiConfigurationStatus, resetAiCache } from "@/lib/ai/campaign-copilot.server";
import { createWorkersAIProvider, isWorkersAIConfigured } from "@/lib/ai/workers-ai.provider";
import { captureRuntimeBindings } from "@/lib/runtime-bindings.server";

describe("AI campaign schemas", () => {
  it("validates a complete campaign plan", () => {
    const input = {
      campaign: { name: "Test", objective: "traffic", summary: "Summary" },
      budget: { currency: "KES", total: 10000, daily: 714, duration_days: 14 },
      targeting: { countries: [], counties: ["Nairobi"], cities: [], age_min: 25, age_max: 55, devices: ["mobile"], interests: [], keywords: [] },
      ads: [{ headline: "H1", primary_text: "PT", description: "D", cta: "Buy", creative_concept: "CC" }],
      recommendations: [],
      warnings: [],
    };
    expect(CampaignPlanSchema.safeParse(input).success).toBe(true);
  });

  it("rejects invalid campaign plan", () => {
    const input = {
      campaign: { name: "", objective: "", summary: "" },
      budget: { currency: "KES", total: -1, daily: -1, duration_days: -1 },
      targeting: { countries: [], counties: [], cities: [], age_min: 0, age_max: 0, devices: [], interests: [], keywords: [] },
      ads: [],
      recommendations: [],
      warnings: [],
    };
    expect(CampaignPlanSchema.safeParse(input).success).toBe(false);
  });

  it("validates ad copy variants", () => {
    const input = { headline: "H1", primary_text: "PT", description: "D", cta: "Buy", tone: "sales" };
    expect(AdCopyVariantSchema.safeParse(input).success).toBe(true);
  });

  it("validates targeting suggestion", () => {
    const input = { countries: ["KE"], counties: ["Nairobi"], cities: [], age_min: 25, age_max: 55, devices: ["mobile"], interests: ["business"], keywords: ["office"], reasoning: "Because Nairobi has many businesses" };
    expect(TargetingSuggestionSchema.safeParse(input).success).toBe(true);
  });

  it("validates creative concept", () => {
    const input = { headline: "H1", supporting_text: "ST", cta: "Buy", visual_concept: "VC", recommended_dimensions: ["300x250"], composition_notes: "CN", branding_guidance: "BG" };
    expect(CreativeConceptSchema.safeParse(input).success).toBe(true);
  });
});

describe("AI service configuration", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
    resetAiCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports missing when Workers AI binding is unavailable", () => {
    expect(getAiConfigurationStatus()).toBe("missing");
  });
});

describe("Cloudflare Workers AI provider", () => {
  beforeEach(() => {
    captureRuntimeBindings({});
  });

  afterEach(() => {
    captureRuntimeBindings({});
  });

  it("generates text from the Workers AI binding", async () => {
    const run = vi.fn().mockResolvedValue({ response: "Generated copy" });
    captureRuntimeBindings({ AI: { run } });

    const provider = createWorkersAIProvider();
    await expect(provider?.generateText("System instructions", "User request")).resolves.toBe("Generated copy");
    expect(run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct",
      expect.objectContaining({
        messages: [
          { role: "system", content: "System instructions" },
          { role: "user", content: "User request" },
        ],
      }),
    );
  });

  it("is unavailable when the Workers AI binding is missing", () => {
    expect(isWorkersAIConfigured()).toBe(false);
    expect(createWorkersAIProvider()).toBeNull();
  });

  it("rejects a malformed Workers AI response", async () => {
    captureRuntimeBindings({ AI: { run: vi.fn().mockResolvedValue({}) } });

    const provider = createWorkersAIProvider();
    await expect(provider?.generateText("System instructions", "User request")).rejects.toMatchObject({
      category: "AI_RESPONSE_INVALID",
    });
  });
});
