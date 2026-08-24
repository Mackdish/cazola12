import { describe, it, expect, beforeEach } from "vitest";
import { CampaignPlanSchema, AdCopyVariantSchema, TargetingSuggestionSchema, CreativeConceptSchema } from "@/lib/ai/campaign-schema";
import { generateCampaignPlan, generateAdCopy, generateTargetingSuggestion, generateCreativeConcept, AIServiceError } from "@/lib/ai/campaign-copilot.server";
import { resetAiCache, getAiConfigurationStatus } from "@/lib/ai/openai.server";

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
    resetAiCache();
  });

  it("reports missing when API key is absent", () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    try {
      expect(getAiConfigurationStatus()).toBe("missing");
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it("reports invalid when API key is too short", () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "short";
    try {
      expect(getAiConfigurationStatus()).toBe("invalid");
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });
});

describe("AI service error handling", () => {
  beforeEach(() => {
    resetAiCache();
  });

  it("throws AIServiceError when API key is missing", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    try {
      await expect(generateCampaignPlan({ description: "test", currency: "KES" })).rejects.toThrow(AIServiceError);
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it("throws AIServiceError for empty description", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    try {
      await expect(generateCampaignPlan({ description: "", currency: "KES" })).rejects.toThrow(AIServiceError);
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });
});
