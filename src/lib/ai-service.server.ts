/**
 * TradeMall AI intelligence service.
 *
 * Gemini is used for reasoning/vision. All marketplace facts come from
 * TradeMall's own database, and all returned IDs are validated before they
 * can be used by the application.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  generateStructured,
  generateStructuredWithImage,
  AiProviderError,
} from "@/lib/ai-provider.server";
import { safeFetch } from "@/lib/safe-fetch.server";
import { signedCreativeUrl } from "@/lib/media-service.server";
import { getAdvertiserAnalytics } from "@/lib/analytics-service.server";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit.server";
import { logAuditEvent } from "@/lib/audit-log.server";
import { z } from "zod";

export type Ctx = { supabase: SupabaseClient<Database>; userId: string };
export class AiServiceError extends Error {}

function fail(message: string): never {
  throw new AiServiceError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

async function assertOrgMember(ctx: Ctx, organizationId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) fail("We couldn't verify your organization access.");
  if (!data || data.status !== "active")
    fail("You don't have permission to use TradeMall AI for this organization.");
}

async function protectAiAction(
  ctx: Ctx,
  organizationId: string,
  action: "ai_campaign" | "ai_website" | "ai_creative" | "ai_optimize",
) {
  await checkRateLimit(
    ctx.supabase,
    getRateLimitConfig(action),
    `user:${ctx.userId}`,
    ctx.userId,
    organizationId,
  );
}

async function safeAudit(
  ctx: Ctx,
  action: string,
  organizationId: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await logAuditEvent(ctx, {
      action,
      targetType: "ai_copilot",
      targetId: organizationId,
      metadata,
    });
  } catch {
    // AI responses must not fail because audit logging is temporarily unavailable.
  }
}

async function readResponseTextLimited(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) fail("The website response is too large to analyze.");
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        fail("The website response is too large to analyze.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function readResponseBytesLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) fail("That creative is too large for AI analysis.");
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        fail("That creative is too large for AI analysis.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18000);
}

function normalizeWebsiteUrl(value: string): string {
  try {
    const raw = value.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error();
    if (url.port && !["80", "443"].includes(url.port)) throw new Error();
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )
      throw new Error();
    url.hash = "";
    return url.toString();
  } catch {
    fail("Enter a valid public HTTP(S) website URL.");
  }
}

async function fetchWebsiteSnapshot(url: string) {
  const normalized = normalizeWebsiteUrl(url);
  let response: Response;
  try {
    response = await safeFetch(normalized, {
      timeoutMs: 10_000,
      maxRedirects: 3,
      headers: { "User-Agent": "TradeMall-AI-Audit/1.0" },
    });
  } catch (error) {
    fail(
      error instanceof Error
        ? `We couldn't scan that website: ${error.message}`
        : "We couldn't scan that website.",
    );
  }
  if (!response.ok) fail(`The website returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/(html|plain)|application\/(xhtml\+xml|json)/i.test(contentType))
    fail("That URL does not appear to be a web page.");
  const html = await readResponseTextLimited(response, 512 * 1024);
  const title =
    html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ??
    "";
  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((m) => cleanHtml(m[1] ?? ""))
    .filter(Boolean)
    .slice(0, 20);
  return { url: normalized, title, description, headings, text: cleanHtml(html) };
}

const campaignPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "campaignName",
    "objective",
    "bidType",
    "bidAmount",
    "totalBudget",
    "dailyBudget",
    "durationDays",
    "landingPageUrl",
    "audience",
    "targeting",
    "publisherRecommendations",
    "creative",
    "confidence",
    "reasoning",
  ],
  properties: {
    campaignName: { type: "string" },
    objective: {
      type: "string",
      enum: ["awareness", "traffic", "engagement", "conversions", "app_installs"],
    },
    bidType: { type: "string", enum: ["cpm", "cpc"] },
    bidAmount: { type: "number", minimum: 0 },
    totalBudget: { type: "number", minimum: 0 },
    dailyBudget: { type: ["number", "null"] },
    durationDays: { type: "integer", minimum: 1, maximum: 365 },
    landingPageUrl: { type: "string" },
    audience: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "ageRange", "locations", "interests"],
      properties: {
        summary: { type: "string" },
        ageRange: { type: "string" },
        locations: { type: "array", items: { type: "string" }, maxItems: 20 },
        interests: { type: "array", items: { type: "string" }, maxItems: 15 },
      },
    },
    targeting: {
      type: "object",
      additionalProperties: false,
      required: ["countries", "counties", "cities", "devices", "websiteCategories"],
      properties: {
        countries: { type: "array", items: { type: "string" }, maxItems: 20 },
        counties: { type: "array", items: { type: "string" }, maxItems: 30 },
        cities: { type: "array", items: { type: "string" }, maxItems: 30 },
        devices: {
          type: "array",
          items: { type: "string", enum: ["desktop", "mobile", "tablet"] },
          maxItems: 3,
        },
        websiteCategories: { type: "array", items: { type: "string" }, maxItems: 15 },
      },
    },
    publisherRecommendations: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "publisherId",
          "websiteId",
          "websiteName",
          "matchScore",
          "budgetAllocation",
          "reason",
        ],
        properties: {
          publisherId: { type: "string" },
          websiteId: { type: "string" },
          websiteName: { type: "string" },
          matchScore: { type: "number", minimum: 0, maximum: 100 },
          budgetAllocation: { type: "number", minimum: 0 },
          reason: { type: "string" },
        },
      },
    },
    creative: {
      type: "object",
      additionalProperties: false,
      required: ["headlines", "descriptions", "cta", "concepts"],
      properties: {
        headlines: { type: "array", items: { type: "string" }, maxItems: 5 },
        descriptions: { type: "array", items: { type: "string" }, maxItems: 5 },
        cta: { type: "string" },
        concepts: { type: "array", items: { type: "string" }, maxItems: 5 },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
} as const;

export type CampaignPlan = {
  campaignName: string;
  objective: "awareness" | "traffic" | "engagement" | "conversions" | "app_installs";
  bidType: "cpm" | "cpc";
  bidAmount: number;
  totalBudget: number;
  dailyBudget: number | null;
  durationDays: number;
  landingPageUrl: string;
  audience: { summary: string; ageRange: string; locations: string[]; interests: string[] };
  targeting: {
    countries: string[];
    counties: string[];
    cities: string[];
    devices: Array<"desktop" | "mobile" | "tablet">;
    websiteCategories: string[];
  };
  publisherRecommendations: Array<{
    publisherId: string;
    websiteId: string;
    websiteName: string;
    matchScore: number;
    budgetAllocation: number;
    reason: string;
  }>;
  creative: { headlines: string[]; descriptions: string[]; cta: string; concepts: string[] };
  confidence: number;
  reasoning: string[];
};

const campaignPlanValidation = z.object({
  campaignName: z.string().trim().min(1).max(120),
  objective: z.enum(["awareness", "traffic", "engagement", "conversions", "app_installs"]),
  bidType: z.enum(["cpm", "cpc"]),
  bidAmount: z.number().finite().nonnegative().max(1_000_000),
  totalBudget: z.number().finite().nonnegative().max(100_000_000),
  dailyBudget: z.number().finite().nonnegative().max(100_000_000).nullable(),
  durationDays: z.number().int().min(1).max(365),
  landingPageUrl: z.string().url().max(2048),
  audience: z.object({
    summary: z.string().max(1000),
    ageRange: z.string().max(100),
    locations: z.array(z.string().max(100)).max(20),
    interests: z.array(z.string().max(100)).max(15),
  }),
  targeting: z.object({
    countries: z.array(z.string().max(100)).max(20),
    counties: z.array(z.string().max(100)).max(30),
    cities: z.array(z.string().max(100)).max(30),
    devices: z.array(z.enum(["desktop", "mobile", "tablet"])).max(3),
    websiteCategories: z.array(z.string().max(100)).max(15),
  }),
  publisherRecommendations: z
    .array(
      z.object({
        publisherId: z.string().uuid(),
        websiteId: z.string().uuid(),
        websiteName: z.string().max(200),
        matchScore: z.number().finite().min(0).max(100),
        budgetAllocation: z.number().finite().nonnegative().max(100_000_000),
        reason: z.string().max(1000),
      }),
    )
    .max(8),
  creative: z.object({
    headlines: z.array(z.string().trim().min(1).max(120)).max(5),
    descriptions: z.array(z.string().trim().min(1).max(500)).max(5),
    cta: z.string().trim().min(1).max(80),
    concepts: z.array(z.string().max(500)).max(5),
  }),
  confidence: z.number().finite().min(0).max(1),
  reasoning: z.array(z.string().max(1000)).max(8),
});

function validateAiOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    fail("Gemini returned an unsafe or incomplete AI response. Please try again.");
  return parsed.data;
}

async function loadPublisherInventory(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from("websites")
    .select(
      "id, name, domain, category, monthly_pageviews, publisher_id, publishers!inner(id, business_name, status, approval_status)",
    )
    .eq("status", "active")
    .eq("approval_status", "approved")
    .eq("verification_status", "verified")
    .eq("publishers.status", "active")
    .eq("publishers.approval_status", "approved")
    .order("monthly_pageviews", { ascending: false })
    .limit(100);
  if (error) fail("We couldn't load TradeMall publisher inventory.");
  return (data ?? []).map((row) => {
    const publisher = row.publishers as unknown as { id: string; business_name: string };
    return {
      websiteId: row.id,
      websiteName: row.name,
      domain: row.domain,
      category: row.category,
      monthlyPageviews: row.monthly_pageviews,
      publisherId: publisher.id,
      publisherName: publisher.business_name,
    };
  });
}

export async function buildCampaignPlan(
  ctx: Ctx,
  input: {
    organizationId: string;
    websiteUrl: string;
    goal: string;
    budget: number;
    durationDays: number;
  },
) {
  await assertOrgMember(ctx, input.organizationId);
  await protectAiAction(ctx, input.organizationId, "ai_campaign");
  if (input.budget < 1) fail("Enter a campaign budget greater than zero.");
  if (input.durationDays < 1 || input.durationDays > 365)
    fail("Campaign duration must be between 1 and 365 days.");

  const db = await admin();
  const [profileResult, inventory, snapshot] = await Promise.all([
    db
      .from("advertisers")
      .select("business_name, industry, contact_email")
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
    loadPublisherInventory(db),
    fetchWebsiteSnapshot(input.websiteUrl),
  ]);
  if (profileResult.error) fail("We couldn't load your advertiser profile.");

  const prompt = `You are TradeMall Campaign Copilot, an advertising strategist for Kenya/Africa. Build a practical campaign using ONLY the supplied website facts and TradeMall inventory. Do not invent publisher IDs, traffic figures, prices, or guarantees.

Advertiser:
${JSON.stringify(profileResult.data ?? {}, null, 2)}

Campaign request:
${JSON.stringify({ goal: input.goal, budget: input.budget, durationDays: input.durationDays }, null, 2)}

Website snapshot:
${JSON.stringify(snapshot, null, 2)}

TradeMall publisher inventory:
${JSON.stringify(inventory, null, 2)}

Rules:
- Prefer realistic Kenya-focused targeting unless the website clearly indicates another market.
- Choose publishers based on category relevance and available monthly pageviews, but treat pageviews as directional rather than guaranteed reach.
- Allocate the full budget across recommended publishers when possible; never exceed the requested budget.
- Choose CPC for click/traffic/conversion goals unless CPM is clearly better for awareness.
- Keep ad copy concise and truthful. Never invent discounts or product claims.
- Return only the requested JSON structure.`;

  let result: Awaited<ReturnType<typeof generateStructured<CampaignPlan>>>;
  try {
    result = await generateStructured<CampaignPlan>({
      prompt,
      schema: campaignPlanSchema as Record<string, unknown>,
      systemInstruction:
        "You produce structured, conservative advertising recommendations. TradeMall application code validates all IDs and financial values after generation.",
    });
  } catch (error) {
    if (error instanceof AiProviderError) throw new AiServiceError(error.message);
    throw error;
  }

  const safePlan = validateAiOutput(campaignPlanValidation, result.data);
  const validPairs = new Map(
    inventory.map((item) => [`${item.websiteId}:${item.publisherId}`, item]),
  );
  const recommendations = safePlan.publisherRecommendations
    .filter((item) => validPairs.has(`${item.websiteId}:${item.publisherId}`))
    .map((item) => {
      const inventoryItem = validPairs.get(`${item.websiteId}:${item.publisherId}`)!;
      return {
        ...item,
        websiteName: inventoryItem.websiteName,
        budgetAllocation: Math.max(0, Number(item.budgetAllocation) || 0),
        matchScore: Math.min(100, Math.max(0, Number(item.matchScore) || 0)),
      };
    });
  const totalAllocated = recommendations.reduce((sum, item) => sum + item.budgetAllocation, 0);
  const scale =
    totalAllocated > input.budget && totalAllocated > 0 ? input.budget / totalAllocated : 1;

  await safeAudit(ctx, "ai.campaign_plan", input.organizationId, {
    model: result.model,
    provider: result.provider,
    durationDays: input.durationDays,
  });

  return {
    ...safePlan,
    totalBudget: input.budget,
    durationDays: input.durationDays,
    dailyBudget: Math.min(
      input.budget,
      Math.max(0, safePlan.dailyBudget ?? input.budget / input.durationDays),
    ),
    landingPageUrl: snapshot.url,
    publisherRecommendations: recommendations.map((item) => ({
      ...item,
      budgetAllocation: Math.round(Math.max(0, item.budgetAllocation * scale) * 100) / 100,
    })),
    websiteSnapshot: {
      url: snapshot.url,
      title: snapshot.title,
      description: snapshot.description,
    },
    model: result.model,
    provider: result.provider,
    usage: result.usage ?? null,
  };
}

const websiteAuditSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "businessSummary",
    "targetAudience",
    "strengths",
    "issues",
    "campaignOpportunities",
    "recommendedObjective",
    "recommendedCta",
  ],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    businessSummary: { type: "string" },
    targetAudience: { type: "array", items: { type: "string" }, maxItems: 10 },
    strengths: { type: "array", items: { type: "string" }, maxItems: 10 },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "severity", "finding", "recommendation"],
        properties: {
          area: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          finding: { type: "string" },
          recommendation: { type: "string" },
        },
      },
      maxItems: 12,
    },
    campaignOpportunities: { type: "array", items: { type: "string" }, maxItems: 8 },
    recommendedObjective: {
      type: "string",
      enum: ["awareness", "traffic", "engagement", "conversions", "app_installs"],
    },
    recommendedCta: { type: "string" },
  },
} as const;

export async function auditWebsite(
  ctx: Ctx,
  input: { organizationId: string; websiteUrl: string },
) {
  await assertOrgMember(ctx, input.organizationId);
  await protectAiAction(ctx, input.organizationId, "ai_website");
  const snapshot = await fetchWebsiteSnapshot(input.websiteUrl);
  const prompt = `Audit this advertiser website for TradeMall campaign readiness. Base conclusions on the supplied page content. Score conversion readiness, clarity of value proposition, CTA quality, trust, offer clarity and mobile/ad landing-page suitability. Do not claim technical metrics you cannot observe.

Website:
${JSON.stringify(snapshot, null, 2)}`;
  try {
    const result = await generateStructured<zWebsiteAudit>({
      prompt,
      schema: websiteAuditSchema as Record<string, unknown>,
    });
    const safeResult = validateAiOutput(websiteAuditValidation, result.data);
    await safeAudit(ctx, "ai.website_audit", input.organizationId, {
      model: result.model,
      provider: result.provider,
    });
    return {
      ...safeResult,
      url: snapshot.url,
      title: snapshot.title,
      model: result.model,
      provider: result.provider,
    };
  } catch (error) {
    if (error instanceof AiProviderError) throw new AiServiceError(error.message);
    throw error;
  }
}

const websiteAuditValidation = z.object({
  score: z.number().int().min(0).max(100),
  businessSummary: z.string().max(2000),
  targetAudience: z.array(z.string().max(200)).max(10),
  strengths: z.array(z.string().max(500)).max(10),
  issues: z
    .array(
      z.object({
        area: z.string().max(100),
        severity: z.enum(["low", "medium", "high"]),
        finding: z.string().max(1000),
        recommendation: z.string().max(1000),
      }),
    )
    .max(12),
  campaignOpportunities: z.array(z.string().max(500)).max(8),
  recommendedObjective: z.enum([
    "awareness",
    "traffic",
    "engagement",
    "conversions",
    "app_installs",
  ]),
  recommendedCta: z.string().trim().min(1).max(80),
});

type zWebsiteAudit = {
  score: number;
  businessSummary: string;
  targetAudience: string[];
  strengths: string[];
  issues: Array<{
    area: string;
    severity: "low" | "medium" | "high";
    finding: string;
    recommendation: string;
  }>;
  campaignOpportunities: string[];
  recommendedObjective: "awareness" | "traffic" | "engagement" | "conversions" | "app_installs";
  recommendedCta: string;
};

const creativeAuditSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "productVisibility",
    "textReadability",
    "branding",
    "mobileSuitability",
    "issues",
    "recommendations",
    "copySuggestions",
  ],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    productVisibility: { type: "integer", minimum: 0, maximum: 100 },
    textReadability: { type: "integer", minimum: 0, maximum: 100 },
    branding: { type: "integer", minimum: 0, maximum: 100 },
    mobileSuitability: { type: "integer", minimum: 0, maximum: 100 },
    issues: { type: "array", items: { type: "string" }, maxItems: 10 },
    recommendations: { type: "array", items: { type: "string" }, maxItems: 10 },
    copySuggestions: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
} as const;

const creativeAuditValidation = z.object({
  score: z.number().int().min(0).max(100),
  productVisibility: z.number().int().min(0).max(100),
  textReadability: z.number().int().min(0).max(100),
  branding: z.number().int().min(0).max(100),
  mobileSuitability: z.number().int().min(0).max(100),
  issues: z.array(z.string().max(500)).max(10),
  recommendations: z.array(z.string().max(500)).max(10),
  copySuggestions: z.array(z.string().max(500)).max(6),
});

type CreativeAudit = {
  score: number;
  productVisibility: number;
  textReadability: number;
  branding: number;
  mobileSuitability: number;
  issues: string[];
  recommendations: string[];
  copySuggestions: string[];
};

export async function analyzeCreative(
  ctx: Ctx,
  input: { organizationId: string; assetId: string },
) {
  await assertOrgMember(ctx, input.organizationId);
  await protectAiAction(ctx, input.organizationId, "ai_creative");
  const db = await admin();
  const { data: asset, error } = await db
    .from("media_assets")
    .select("id, organization_id, mime_type, file_name, width, height, status")
    .eq("id", input.assetId)
    .maybeSingle();
  if (
    error ||
    !asset ||
    asset.organization_id !== input.organizationId ||
    asset.status === "archived"
  )
    fail("That creative isn't available to this organization.");
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(asset.mime_type))
    fail("TradeMall AI supports PNG, JPEG, WebP and GIF creatives only.");

  const preview = await signedCreativeUrl(ctx, asset.id);
  let response: Response;
  try {
    response = await safeFetch(preview.url, { timeoutMs: 15_000, maxRedirects: 2 });
  } catch {
    fail("We couldn't read the creative for AI analysis.");
  }
  if (!response.ok) fail("We couldn't read the creative for AI analysis.");
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType && contentType !== asset.mime_type.toLowerCase())
    fail("The stored creative type does not match the uploaded file.");
  const bytes = await readResponseBytesLimited(response, 3 * 1024 * 1024);

  const prompt = `Analyze this TradeMall advertising creative. It is ${asset.width ?? "unknown"}x${asset.height ?? "unknown"} ${asset.mime_type}. Focus on product/offer visibility, hierarchy, readable text, brand consistency, CTA clarity, composition, and mobile ad suitability. Do not invent information not visible in the image. Provide actionable recommendations for a Kenyan digital advertising context.`;
  try {
    const result = await generateStructuredWithImage<CreativeAudit>({
      prompt,
      schema: creativeAuditSchema as Record<string, unknown>,
      mimeType: asset.mime_type,
      bytes,
    });
    const safeResult = validateAiOutput(creativeAuditValidation, result.data);
    await safeAudit(ctx, "ai.creative_analysis", input.organizationId, {
      model: result.model,
      provider: result.provider,
      assetId: asset.id,
    });
    return {
      ...safeResult,
      assetId: asset.id,
      fileName: asset.file_name,
      width: asset.width,
      height: asset.height,
      model: result.model,
      provider: result.provider,
    };
  } catch (error) {
    if (error instanceof AiProviderError) throw new AiServiceError(error.message);
    throw error;
  }
}

const optimizationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallAssessment",
    "recommendations",
    "creativeActions",
    "publisherActions",
    "targetingActions",
    "priority",
  ],
  properties: {
    overallAssessment: { type: "string" },
    priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "expectedImpact", "action"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          expectedImpact: { type: "string" },
          action: { type: "string" },
        },
      },
      maxItems: 8,
    },
    creativeActions: { type: "array", items: { type: "string" }, maxItems: 8 },
    publisherActions: { type: "array", items: { type: "string" }, maxItems: 8 },
    targetingActions: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
} as const;

const optimizationValidation = z.object({
  overallAssessment: z.string().max(2000),
  recommendations: z
    .array(
      z.object({
        title: z.string().max(200),
        reason: z.string().max(1000),
        expectedImpact: z.string().max(500),
        action: z.string().max(1000),
      }),
    )
    .max(8),
  creativeActions: z.array(z.string().max(500)).max(8),
  publisherActions: z.array(z.string().max(500)).max(8),
  targetingActions: z.array(z.string().max(500)).max(8),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

type Optimization = {
  overallAssessment: string;
  recommendations: Array<{ title: string; reason: string; expectedImpact: string; action: string }>;
  creativeActions: string[];
  publisherActions: string[];
  targetingActions: string[];
  priority: "low" | "medium" | "high" | "critical";
};

export async function optimizeCampaign(
  ctx: Ctx,
  input: { organizationId: string; campaignId?: string | null; days?: number },
) {
  await assertOrgMember(ctx, input.organizationId);
  await protectAiAction(ctx, input.organizationId, "ai_optimize");
  const db = await admin();
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select(
      "id, name, objective, status, bid_type, bid_amount, total_budget, daily_budget, spent_amount, impressions_count, clicks_count, landing_page_url, start_date, end_date",
    )
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("We couldn't load campaign data for optimization.");
  const selected = input.campaignId
    ? (campaigns ?? []).find((c) => c.id === input.campaignId)
    : (campaigns?.find((c) => c.status === "active") ?? campaigns?.[0]);
  if (!selected) fail("Create a campaign before asking Copilot to optimize it.");

  const days = Math.min(90, Math.max(1, input.days ?? 30));
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const analytics = await getAdvertiserAnalytics(
    { supabase: db, userId: ctx.userId },
    {
      organizationId: input.organizationId,
      dateRange: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      campaignId: selected.id,
    },
  );

  const { data: ads } = await db
    .from("ads")
    .select(
      "id, name, status, approval_status, format, headlines, descriptions, cta, media_asset_id",
    )
    .eq("campaign_id", selected.id)
    .limit(20);
  const prompt = `You are optimizing an active TradeMall campaign. Analyze the actual metrics and recommend actions, but do not invent conversion data or claim guaranteed results. Recommendations must be advisory; the application requires human approval before changing budgets or status.

Campaign:
${JSON.stringify(selected, null, 2)}

Analytics:
${JSON.stringify(analytics, null, 2)}

Ads:
${JSON.stringify(ads ?? [], null, 2)}`;
  try {
    const result = await generateStructured<Optimization>({
      prompt,
      schema: optimizationSchema as Record<string, unknown>,
    });
    const safeResult = validateAiOutput(optimizationValidation, result.data);
    await safeAudit(ctx, "ai.campaign_optimization", input.organizationId, {
      model: result.model,
      provider: result.provider,
      campaignId: selected.id,
      days,
    });
    return {
      campaign: selected,
      analytics,
      ...safeResult,
      model: result.model,
      provider: result.provider,
    };
  } catch (error) {
    if (error instanceof AiProviderError) throw new AiServiceError(error.message);
    throw error;
  }
}
