import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdvertiserProfile } from "@/lib/advertiser-service.server";
import { generateAdImage, AiImageError } from "@/lib/ai-image.server";
import { uploadCreativeToR2 } from "@/lib/media-service.server";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit.server";

const uuid = z.string().uuid();

const inputSchema = z.object({
  organizationId: uuid,
  campaignId: uuid,
  productFocus: z.string().trim().min(1).max(200),
  productHighlights: z.array(z.string().trim().min(1).max(300)).max(8),
  concept: z.string().trim().min(1).max(600),
  brandName: z.string().trim().max(120).optional().default(""),
  headline: z.string().trim().max(90).optional().default(""),
  cta: z.string().trim().max(40).optional().default(""),
  format: z.string().trim().min(1).max(40).default("responsive"),
});

export const aiGenerateAdImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const advertiser = await getAdvertiserProfile(context, data.organizationId);
    if (!advertiser) throw new Error("Complete your advertiser profile before generating creatives.");

    const { data: campaign, error: campaignError } = await context.supabase
      .from("campaigns")
      .select("id, organization_id, status")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (campaignError || !campaign) throw new Error("That campaign doesn't exist or you don't have access to it.");
    if (campaign.organization_id !== data.organizationId) throw new Error("That campaign doesn't belong to this organization.");
    if (campaign.status !== "draft" && campaign.status !== "rejected") {
      throw new Error("AI creative generation is only available while the campaign is editable.");
    }

    await checkRateLimit(
      context.supabase,
      getRateLimitConfig("ai_creative"),
      `user:${context.userId}:image`,
      context.userId,
      data.organizationId,
    );

    const brand = data.brandName.trim() || advertiser.business_name?.trim() || "";
    const prompt = [
      "Create a polished, production-ready digital advertising banner for TradeMall, targeting customers in Kenya and Africa.",
      "LANGUAGE AND TEXT ACCURACY ARE CRITICAL: use English only for all generated advertising text. Never use Swahili, another language, pseudo-language, random characters, fake words, lorem ipsum, or decorative gibberish.",
      "TEXT MUST BE VERBATIM: if a brand, headline, or CTA is supplied below, copy it character-for-character. Do not translate it, paraphrase it, shorten it, spell it differently, or invent variations.",
      "ALLOWED VISIBLE TEXT ONLY: the supplied brand name, the supplied headline, and the supplied CTA. Do not add prices, percentages, discounts, badges, labels, slogans, feature claims, testimonials, website addresses, phone numbers, watermarks, awards, or other text.",
      "If you cannot render the supplied text with high confidence, OMIT THE TEXT rather than generating incorrect or non-English text. Never substitute invented text.",
      `Brand name (use exactly as written, only if non-empty): ${brand || "NONE — do not invent a brand name or logo"}`,
      `Exact headline (use exactly as written, only if non-empty): ${data.headline.trim() || "NONE"}`,
      `Exact CTA (use exactly as written, only if non-empty): ${data.cta.trim() || "NONE"}`,
      `Product/service to promote: ${data.productFocus}`,
      `Verified product highlights: ${data.productHighlights.join("; ") || "Use the product focus only."}`,
      `Creative direction: ${data.concept}`,
      "Use only the supplied product facts. Do not invent prices, discounts, guarantees, testimonials, logos, awards or product features.",
      "Create a premium commercial composition with clear visual hierarchy, realistic product presentation, strong contrast, generous negative space and a clear focal point.",
      "Do not create a fake website screenshot or app interface. Do not place text inside product packaging, device screens, signs, books, storefronts or other background objects. Do not add fake logos or brand marks.",
      "Keep any permitted banner text large, simple, highly legible and separated from complex imagery. Do not add any other writing anywhere in the image.",
      "The result will be paired with ad copy in the TradeMall ad system, so prioritize an accurate product/service visual over dense text.",
      `Requested ad format: ${data.format}`,
    ].filter(Boolean).join("\n\n");

    try {
      const generated = await generateAdImage({ prompt, format: data.format });
      const extension = generated.mimeType === "image/jpeg" ? "jpg" : "png";
      const file = new File([generated.bytes], `ai-${crypto.randomUUID()}.${extension}`, { type: generated.mimeType });
      const asset = await uploadCreativeToR2(context, {
        organizationId: data.organizationId,
        advertiserId: advertiser.id,
        campaignId: data.campaignId,
        file,
      });

      return {
        assetId: asset.id,
        previewUrl: asset.storage_path,
        fileName: asset.file_name,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mime_type,
        provider: generated.provider,
        model: generated.model,
      };
    } catch (error) {
      if (error instanceof AiImageError) throw new Error(error.message);
      throw error;
    }
  });
