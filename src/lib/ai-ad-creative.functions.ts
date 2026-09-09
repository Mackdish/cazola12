import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdvertiserProfile } from "@/lib/advertiser-service.server";
import { generateStructured, AiProviderError } from "@/lib/ai-provider.server";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit.server";

const uuid = z.string().uuid();
const adCreativeSchema = {
  type: "object",
  required: ["productFocus", "productHighlights", "headlines", "longHeadline", "descriptions", "ctaRecommendations", "creativeConcepts", "recommendedFormats"],
  properties: {
    productFocus: { type: "string" },
    productHighlights: { type: "array", items: { type: "string" } },
    headlines: { type: "array", items: { type: "string" } },
    longHeadline: { type: "string" },
    descriptions: { type: "array", items: { type: "string" } },
    ctaRecommendations: { type: "array", items: { type: "string" } },
    creativeConcepts: { type: "array", items: { type: "string" } },
    recommendedFormats: { type: "array", items: { type: "string" } },
  },
} as const;
const validation = z.object({
  productFocus: z.string().trim().min(1).max(200),
  productHighlights: z.array(z.string().trim().min(1).max(300)).max(8),
  headlines: z.array(z.string().trim().min(1).max(90)).max(5),
  longHeadline: z.string().trim().min(1).max(120),
  descriptions: z.array(z.string().trim().min(1).max(150)).max(5),
  ctaRecommendations: z.array(z.string().trim().min(1).max(40)).max(6),
  creativeConcepts: z.array(z.string().trim().min(1).max(600)).max(6),
  recommendedFormats: z.array(z.string().trim().min(1).max(80)).max(6),
});
function textFromHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim().slice(0, 24000);
}
function extractMeta(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  return html.match(pattern)?.[1]?.trim() ?? "";
}
async function fetchProductSnapshot(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "TradeMall-AI-Copilot/1.0" }, redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 500000);
  return {
    url: response.url,
    title: extractMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "",
    description: extractMeta(html, "og:description") || extractMeta(html, "description"),
    text: textFromHtml(html),
  };
}
export const aiGenerateAdCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ organizationId: uuid, websiteUrl: z.string().trim().url().max(2048), format: z.string().trim().min(1).max(40), brandName: z.string().trim().max(120).optional().default(""), goal: z.string().trim().max(500).optional().default("Drive clicks and conversions") }).parse(data))
  .handler(async ({ data, context }) => {
    await getAdvertiserProfile(context, data.organizationId);
    await checkRateLimit(context.supabase, getRateLimitConfig("ai_creative"), `user:${context.userId}`, context.userId, data.organizationId);
    const snapshot = await fetchProductSnapshot(data.websiteUrl);
    const prompt = `You are TradeMall's ad creative strategist for Kenya and Africa. Analyze the supplied advertiser website and create truthful ad copy and creative directions based only on website facts. Identify the strongest product, service, offer or category to promote. Never invent prices, discounts, guarantees, features or testimonials.\n\nBrand: ${data.brandName || "Use the website brand"}\nCampaign goal: ${data.goal}\nRequested ad format: ${data.format}\n\nWebsite title: ${snapshot.title}\nWebsite description: ${snapshot.description}\nWebsite content:\n${snapshot.text}\n\nReturn exactly the requested JSON. Generate 5 distinct short headlines using different angles (benefit, problem/solution, curiosity, trust, direct conversion), 1 long headline, 5 descriptions, up to 6 suitable CTAs, up to 6 concrete visual creative concepts based on actual products/services, and recommended ad formats. Keep copy concise and suitable for display advertising.`;
    try {
      const result = await generateStructured<z.infer<typeof validation>>({ prompt, schema: adCreativeSchema as Record<string, unknown>, systemInstruction: "TradeMall AI must ground product claims in the supplied website content. Return concise, production-ready advertising copy and creative concepts." });
      const safe = validation.parse(result.data);
      return { ...safe, provider: result.provider, model: result.model, usage: result.usage ?? null };
    } catch (error) {
      if (error instanceof AiProviderError) throw new Error(error.message);
      throw error;
    }
  });
