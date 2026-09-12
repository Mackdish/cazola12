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
  productFocus: z.string().trim().max(200).optional().default(""),
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
    const productFocus =
      data.productFocus.trim() ||
      data.productHighlights[0]?.trim() ||
      data.concept.trim().slice(0, 200) ||
      brand ||
      "the advertised product or service";
    const highlights = data.productHighlights.slice(0, 3).join("; ");

    // Keep the prompt compact and make the image stage visual-only. Exact ad copy is
    // already controlled by TradeMall and should not be rendered by the image model,
    // because image models can distort arbitrary text into gibberish.
    const prompt = [
      "Create a premium commercial advertising image for the EXACT product/service below.",
      `PRODUCT: ${productFocus}`,
      `KEY FACTS: ${highlights || "Use only the product named above."}`,
      `VISUAL DIRECTION: ${data.concept}`,
      `FORMAT: ${data.format}`,
      "PRODUCT ACCURACY IS THE TOP PRIORITY. Show the named product/service, not a generic alternative or unrelated product. Do not substitute cars, phones, laptops, storage devices, food, people, buildings, or other objects unless they are explicitly part of the product or visual direction.",
      "Use realistic commercial photography or a polished product-focused advertising composition. Match the exact product category, appearance, use case and context described above.",
      "Do not invent product features, prices, discounts, reviews, guarantees, brands, logos or claims.",
      "NO TEXT: do not render any text, letters, words, numbers, logos, watermarks, labels, badges, signs, captions or typography anywhere in the image. Leave clean negative space suitable for TradeMall to overlay verified ad copy separately.",
      "Clean layout, strong focal point, professional lighting, realistic materials, high-quality commercial advertising aesthetic.",
    ].join("\n");

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
