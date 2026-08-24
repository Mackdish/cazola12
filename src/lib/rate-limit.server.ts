/**
 * Server-only rate limiter.
 *
 * Uses database-backed sliding window counters so rate limits survive
 * across process restarts and work in multi-instance deployments.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export class RateLimitError extends Error {}

export type RateLimitConfig = {
  key: string;
  action: string;
  limit: number;
  windowSeconds: number;
};

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  ad_request: { key: "ad:request", action: "ad_request", limit: 200, windowSeconds: 60 },
  impression: { key: "impression", action: "impression", limit: 200, windowSeconds: 60 },
  click: { key: "click", action: "click", limit: 30, windowSeconds: 60 },
  login: { key: "auth:login", action: "login", limit: 10, windowSeconds: 300 },
  registration: { key: "auth:register", action: "registration", limit: 5, windowSeconds: 3600 },
  verification: {
    key: "publisher:verification",
    action: "verification",
    limit: 10,
    windowSeconds: 3600,
  },
  upload: { key: "upload", action: "upload", limit: 20, windowSeconds: 3600 },
  payout: { key: "payout", action: "payout", limit: 5, windowSeconds: 86400 },
  ai_copilot: { key: "ai:copilot", action: "ai_copilot", limit: 20, windowSeconds: 3600 },
  admin_mutation: { key: "admin:mutation", action: "admin_mutation", limit: 100, windowSeconds: 60 },
  admin_login: { key: "admin:login", action: "admin_login", limit: 20, windowSeconds: 300 },
};

export function getRateLimitConfig(action: keyof typeof DEFAULT_LIMITS): RateLimitConfig {
  return DEFAULT_LIMITS[action]!;
}

export async function checkRateLimit(
  client: Client,
  config: RateLimitConfig,
  ipAddress: string,
  userId?: string,
  organizationId?: string,
): Promise<void> {
  const params: Record<string, unknown> = {
    _key: config.key,
    _action: config.action,
    _ip_address: ipAddress,
    _limit: config.limit,
    _window_seconds: config.windowSeconds,
  };
  if (userId) params["_user_id"] = userId;
  if (organizationId) params["_organization_id"] = organizationId;

  const { data, error } = await client.rpc("check_rate_limit", params as never);

  if (error) {
    throw new RateLimitError("We couldn't verify the rate limit. Please try again.");
  }

  if (!data) {
    throw new RateLimitError("Too many requests. Please wait before trying again.");
  }
}

export async function checkAdminRateLimit(
  client: Client,
  userId: string,
  action: "admin_mutation" | "admin_login" = "admin_mutation",
): Promise<void> {
  const config = getRateLimitConfig(action);
  await checkRateLimit(client, config, "admin", userId);
}

export function extractIpAddress(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export interface GeoAndBotScore {
  ipAddress: string;
  country: string | null;
  region: string | null;
  botScore: number | null;
  isLikelyBot: boolean;
}

export function extractGeoAndBotScore(request: Request): GeoAndBotScore {
  const ipAddress = extractIpAddress(request);
  const country = request.headers.get("cf-ipcountry") ?? null;
  const region = request.headers.get("cf-region") ?? null;
  const botScoreHeader = request.headers.get("cf-bot-management-score");
  let botScore: number | null = null;
  let isLikelyBot = false;
  if (botScoreHeader) {
    const parsed = Number(botScoreHeader);
    if (!Number.isNaN(parsed)) {
      botScore = parsed;
      isLikelyBot = parsed <= 10;
    }
  }
  return { ipAddress, country, region, botScore, isLikelyBot };
}
