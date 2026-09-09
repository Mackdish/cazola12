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

    await checkRateLimit(
      context.supabase,
      getRateLimitConfig("ai_creative"),
      `user:${context.userId}:image`,
      context.userId,
      data.organizationId,
    );

    const prompt = [
      "Create a polished, production-ready digital advertising visual for TradeMall, targeting customers in Kenya and Africa.",
      `Brand: ${data.brandName || advertiser.business_name || "Advertiser"}`,
      `Product/service to promote: ${data.productFocus}`,
      `Verified product highlights: ${data.productHighlights.join("; ") || "Use the product focus only."}`,
      `Creative direction: ${data.concept}`,
      data.headline ? `Suggested headline to support visually: ${data.headline}` : "",
      data.cta ? `Suggested CTA: ${data.cta}` : "",
      "Use only the supplied product facts. Do not invent prices, discounts, guarantees, testimonials, logos, awards or product features.",
      "Create a premium commercial composition with clear visual hierarchy, realistic product presentation, strong contrast, generous negative space and a clear focal point.",
      "Do not create a fake website screenshot. Do not include illegible filler text. If text is rendered, keep it minimal and use only the supplied brand, headline or CTA.",
      "The result will be paired with ad copy in the TradeMall ad system, so prioritize the product/service visual over dense text.",
      `Requested ad format: ${data.format}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const generated = await generateAdImage({ prompt, format: data.format });
      const file = new File([generated.bytes], `ai-${crypto.randomUUID()}.png`, {
        type: generated.mimeType,
      });
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
        provider: "gemini",
        model: generated.model,
      };
    } catch (error) {
      if (error instanceof AiImageError) throw new Error(error.message);
      throw error;
    }
  });
