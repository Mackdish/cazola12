import { z } from "zod";

export const CampaignPlanSchema = z.object({
  campaign: z.object({
    name: z.string().min(1).max(120),
    objective: z.string().min(1).max(200),
    summary: z.string().min(1).max(500),
  }),
  budget: z.object({
    currency: z.string().length(3).default("KES"),
    total: z.number().positive().max(10_000_000),
    daily: z.number().positive().max(1_000_000),
    duration_days: z.number().int().positive().max(365),
  }),
  targeting: z.object({
    countries: z.array(z.string()).default([]),
    counties: z.array(z.string()).default([]),
    cities: z.array(z.string()).default([]),
    age_min: z.number().int().min(13).max(100).default(18),
    age_max: z.number().int().min(13).max(100).default(65),
    devices: z.array(z.enum(["mobile", "desktop", "tablet"])).default(["mobile"]),
    interests: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
  }),
  ads: z.array(
    z.object({
      headline: z.string().min(1).max(100),
      primary_text: z.string().min(1).max(500),
      description: z.string().min(1).max(200),
      cta: z.string().min(1).max(50),
      creative_concept: z.string().min(1).max(500),
    }),
  ).min(1).max(5),
  recommendations: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;

export const AdCopyVariantSchema = z.object({
  headline: z.string().min(1).max(100),
  primary_text: z.string().min(1).max(500),
  description: z.string().min(1).max(200),
  cta: z.string().min(1).max(50),
  tone: z.string().min(1).max(50),
});

export type AdCopyVariant = z.infer<typeof AdCopyVariantSchema>;

export const TargetingSuggestionSchema = z.object({
  countries: z.array(z.string()).default([]),
  counties: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  age_min: z.number().int().min(13).max(100).default(18),
  age_max: z.number().int().min(13).max(100).default(65),
  devices: z.array(z.enum(["mobile", "desktop", "tablet"])).default(["mobile"]),
  interests: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  reasoning: z.string().min(1).max(300),
});

export type TargetingSuggestion = z.infer<typeof TargetingSuggestionSchema>;

export const CreativeConceptSchema = z.object({
  headline: z.string().min(1).max(100),
  supporting_text: z.string().min(1).max(300),
  cta: z.string().min(1).max(50),
  visual_concept: z.string().min(1).max(500),
  recommended_dimensions: z.array(z.string()).default(["300x250", "728x90", "320x50"]),
  composition_notes: z.string().min(1).max(300),
  branding_guidance: z.string().min(1).max(200),
});

export type CreativeConcept = z.infer<typeof CreativeConceptSchema>;
