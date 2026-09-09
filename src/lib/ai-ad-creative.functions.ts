import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdvertiserProfile } from "@/lib/advertiser-service.server";
import { generateStructured, AiProviderError } from "@/lib/ai-provider.server";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit.server";
import { normalizeAiCreativeOutput } from "@/lib/ai-creative-normalizer";

const uuid = z.string().uuid();
const adCreativeSchema = {
  type: "object",
  required: ["productFocus", "productHighlights", "headlines", "longHeadline", "descriptions", "ctaRecommendations", "creativeConcepts", "recommendedFormats"],
  properties: {
    productFocus: { type: "string", maxLength: 200 },
    productHighlights: { type: "array", maxItems: 8, items: { type: "string", maxLength: 300 } },
    headlines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string", maxLength: 90 } },
    longHeadline: { type: "string", maxLength: 120 },
    descriptions: { type: "array", minItems: 5, maxItems: 5, items: { type: "string", maxLength: 150 } },
    ctaRecommendations: { type: "array", maxItems: 6, items: { type: "string", maxLength: 40 } },
    creativeConcepts: { type: "array", maxItems: 6, items: { type: "string", maxLength: 600 } },
    recommendedFormats: { type: "array", maxItems: 6, items: { type: "string", maxLength: 80 } },
  },
} as const;
const validation = z.object({
  productFocus: z.string().trim().min(1).max(200),
  productHighlights: z.array(z.string().trim().min(1).max(300)).max(8),
  headlines: z.array(z.string().trim().min(1).max(90)).length(5),
  longHeadline: z.string().trim().min(1).max(120),
  descriptions: z.array(z.string().trim().min(1).max(150)).length(5),
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
    const prompt = `You are TradeMall's ad creative strategist for Kenya and Africa. Analyze the supplied advertiser website and create truthful ad copy and creative directions based only on website facts. Identify the strongest product, service, offer or category to promote. Never invent prices, discounts, guarantees, features or testimonials.

STRICT OUTPUT LIMITS — these are hard limits and must be obeyed:
- headlines: EXACTLY 5 items. Every headline MUST be 90 characters or fewer.
- descriptions: EXACTLY 5 items. Every description MUST be 150 characters or fewer.
- productHighlights: maximum 8 items, each 300 characters or fewer.
- ctaRecommendations: maximum 6 items, each 40 characters or fewer.
- creativeConcepts: maximum 6 items, each 600 characters or fewer.
- recommendedFormats: maximum 6 items, each 80 characters or fewer.
- longHeadline: maximum 120 characters.
Count characters before returning. If any item exceeds its limit, rewrite it shorter. Do not return extra array items. Return ONLY JSON, with no markdown or code fences.

Brand: ${data.brandName || "Use the website brand"}
Campaign goal: ${data.goal}
Requested ad format: ${data.format}

Website title: ${snapshot.title}
Website description: ${snapshot.description}
Website content:
${snapshot.text}

Generate exactly 5 distinct short headlines using different angles (benefit, problem/solution, curiosity, trust, direct conversion), exactly 5 descriptions, 1 long headline, up to 6 suitable CTAs, up to 6 concrete visual creative concepts based on actual products/services, and recommended ad formats.`;
    try {
      const result = await generateStructured<z.infer<typeof validation>>({ prompt, schema: adCreativeSchema as Record<string, unknown>, systemInstruction: "TradeMall AI must ground product claims in the supplied website content. Return concise, production-ready advertising copy and creative concepts. Obey every output limit exactly, especially exactly 5 headlines and exactly 5 descriptions." });

      // Cloudflare/LLM output is treated as untrusted. Normalize counts and character limits
      // before the application schema runs so harmless over-generation cannot break ad creation.
      const normalized = normalizeAiCreativeOutput(result.data);
      const safe = validation.parse(normalized);
      return { ...safe, provider: result.provider, model: result.model, usage: result.usage ?? null };
    } catch (error) {
      if (error instanceof AiProviderError) throw new Error(error.message);
      throw error;
    }
  });
