/**
 * Server functions for the AI Campaign Copilot.
 *
 * These are the only browser-accessible entry points into the AI service.
 * All OpenAI calls happen server-side.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkRateLimit, getRateLimitConfig, extractIpAddress } from "@/lib/rate-limit.server";
import {
  generateCampaignPlan,
  generateAdCopy,
  generateTargetingSuggestion,
  generateCreativeConcept,
  AIServiceError,
} from "@/lib/ai/campaign-copilot.server";

const uuid = z.string().uuid();

function getAiIpAddress(): string {
  try {
    const request = getRequest();
    return extractIpAddress(request);
  } catch {
    return "ai-copilot";
  }
}

export const generateAICampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown) =>
      z
        .object({
          organizationId: uuid,
          description: z.string().min(10).max(2000),
          currency: z.string().length(3).default("KES"),
          budget: z.number().positive().max(10_000_000).optional(),
          durationDays: z.number().int().positive().max(365).optional(),
          location: z.string().max(200).optional(),
          website: z.string().url().max(500).optional(),
          whatsapp: z.string().max(20).optional(),
          objective: z.string().max(200).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.supabase as never,
      getRateLimitConfig("ai_copilot"),
      getAiIpAddress(),
      context.userId,
      data.organizationId,
    );

    try {
      const plan = await generateCampaignPlan({
        description: data.description,
        currency: data.currency,
        budget: data.budget,
        durationDays: data.durationDays,
        location: data.location,
        website: data.website,
        whatsapp: data.whatsapp,
        objective: data.objective,
      });
      return plan;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw new Error(error.message);
      }
      throw new Error("We couldn't generate your campaign plan. Please try again.");
    }
  });

export const generateAIAdCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown) =>
      z
        .object({
          organizationId: uuid,
          product: z.string().min(1).max(500),
          audience: z.string().min(1).max(500),
          tone: z.string().max(50).optional(),
          cta: z.string().max(50).optional(),
          existingCopy: z.string().max(1000).optional(),
          action: z.enum(["generate", "improve", "shorter", "persuasive", "professional", "local"]).default("generate"),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.supabase as never,
      getRateLimitConfig("ai_copilot"),
      getAiIpAddress(),
      context.userId,
      data.organizationId,
    );

    try {
      const variants = await generateAdCopy({
        product: data.product,
        audience: data.audience,
        tone: data.tone,
        cta: data.cta,
        existingCopy: data.existingCopy,
        action: data.action,
      });
      return { variants };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw new Error(error.message);
      }
      throw new Error("We couldn't generate ad copy. Please try again.");
    }
  });

export const generateAITargeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown) =>
      z
        .object({
          organizationId: uuid,
          business: z.string().min(1).max(500),
          location: z.string().min(1).max(200),
          audience: z.string().min(1).max(500),
          budget: z.number().positive().max(10_000_000),
          currency: z.string().length(3).default("KES"),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.supabase as never,
      getRateLimitConfig("ai_copilot"),
      getAiIpAddress(),
      context.userId,
      data.organizationId,
    );

    try {
      const suggestion = await generateTargetingSuggestion({
        business: data.business,
        location: data.location,
        audience: data.audience,
        budget: data.budget,
        currency: data.currency,
      });
      return suggestion;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw new Error(error.message);
      }
      throw new Error("We couldn't generate targeting suggestions. Please try again.");
    }
  });

export const generateAICreativeConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown) =>
      z
        .object({
          organizationId: uuid,
          product: z.string().min(1).max(500),
          audience: z.string().min(1).max(500),
          message: z.string().min(1).max(500),
          formats: z.array(z.string()).min(1).max(10),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.supabase as never,
      getRateLimitConfig("ai_copilot"),
      getAiIpAddress(),
      context.userId,
      data.organizationId,
    );

    try {
      const concept = await generateCreativeConcept({
        product: data.product,
        audience: data.audience,
        message: data.message,
        formats: data.formats,
      });
      return concept;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw new Error(error.message);
      }
      throw new Error("We couldn't generate a creative concept. Please try again.");
    }
  });
