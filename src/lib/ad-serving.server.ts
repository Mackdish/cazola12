/**
 * Serving-path data access. Server-only.
 *
 * Kept deliberately thin and index-friendly: two queries to serve an ad
 * (zone lookup + candidate fetch), one signed-URL call for the creative, and a
 * single insert per impression or click. No dashboard code is reachable here.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseSchedule, type RequestSignals } from "@/lib/advertiser-domain";
import {
  FORMAT_SIZES,
  classifyUserAgent,
  deriveSessionId,
  isSafeDestination,
  rankCandidates,
  selectAd,
  weekdayOf,
  zoneIsServeable,
  type IneligibleReason,
  type ServingCandidate,
  type ZoneContext,
} from "@/lib/ad-serving-domain";
import { CREATIVE_BUCKET } from "@/lib/media-service.server";
import { issueServedToken, type ServedTokenPayload } from "@/lib/ad-token.server";
import { checkRateLimit, extractIpAddress, getRateLimitConfig } from "@/lib/rate-limit.server";
import {
  evaluateClickFraud,
  evaluateImpressionFraud,
  recordFraudEvent,
} from "@/lib/fraud-detection.server";
import { cachedServePathGet } from "@/lib/cache.server";
import {
  bufferImpression,
  type ImpressionEvent,
} from "@/lib/impression-buffer.server";

const CREATIVE_URL_TTL_SECONDS = 60 * 30;
const DEFAULT_AD_SERVE_TIMEOUT_MS = 2500;
const MAX_AD_SERVE_TIMEOUT_MS = 3000;
const AD_SERVE_TIMEOUT_MS = Math.min(
  MAX_AD_SERVE_TIMEOUT_MS,
  Math.max(200, Number(process.env["AD_SERVE_TIMEOUT_MS"] ?? DEFAULT_AD_SERVE_TIMEOUT_MS) || DEFAULT_AD_SERVE_TIMEOUT_MS),
);
const AD_CANDIDATE_LIMIT = 500;

type TargetingRow = {
  countries: string[];
  counties: string[];
  cities: string[];
  devices: ServingCandidate["targeting"]["devices"];
  operating_systems: ServingCandidate["targeting"]["operatingSystems"];
  browsers: ServingCandidate["targeting"]["browsers"];
  website_categories: ServingCandidate["targeting"]["websiteCategories"];
  schedule: unknown;
  frequency_cap: { impressions: number; periodHours: number } | null;
};

const CREATIVE_CACHE = new Map<
  string,
  { url: string; width: number | null; height: number | null; _ts: number }
>();
const CREATIVE_CACHE_TTL_MS = 60 * 1000;
let lastCacheCleanup = Date.now();

function cleanupCreativeCache() {
  const now = Date.now();
  if (now - lastCacheCleanup < CREATIVE_CACHE_TTL_MS) return;
  lastCacheCleanup = now;
  for (const [key, entry] of CREATIVE_CACHE) {
    if (now - entry._ts > CREATIVE_CACHE_TTL_MS) CREATIVE_CACHE.delete(key);
  }
}

export function invalidateCreativeCache(mediaAssetId?: string) {
  if (mediaAssetId) {
    CREATIVE_CACHE.delete(mediaAssetId);
  } else {
    CREATIVE_CACHE.clear();
  }
}

/** One row, one index hit on ad_zones.zone_key. */
export async function loadZoneContext(zoneKey: string): Promise<ZoneContext | null> {
  return cachedServePathGet(zoneKey, 60, async () => {
    const t0 = Date.now();
    const { data, error } = await supabaseAdmin
      .from("ad_zones")
      .select(
        `id, status, format, website_id, publisher_id, websites!inner(status, approval_status, verification_status, category), publishers!inner(status, approval_status)`,
      )
      .eq("zone_key", zoneKey)
      .maybeSingle();

    console.debug("[ad] zone_lookup_ms", Date.now() - t0);

    if (error || !data) return null;
    const website = data.websites as unknown as {
      status: ZoneContext["websiteStatus"];
      approval_status: ZoneContext["websiteApproval"];
      verification_status: ZoneContext["websiteVerification"];
      category: ZoneContext["websiteCategory"];
    };
    const publisher = data.publishers as unknown as {
      status: ZoneContext["publisherStatus"];
      approval_status: ZoneContext["publisherApproval"];
    };

    return {
      zoneId: data.id,
      zoneStatus: data.status,
      zoneFormat: data.format,
      websiteId: data.website_id,
      websiteStatus: website.status,
      websiteApproval: website.approval_status,
      websiteVerification: website.verification_status,
      websiteCategory: website.category,
      publisherId: data.publisher_id,
      publisherStatus: publisher.status,
      publisherApproval: publisher.approval_status,
    };
  });
}

/**
 * Candidate pool. Pre-filtered in SQL on the indexed serving columns so the
 * in-memory eligibility pass only handles dates, budget, format and targeting.
 * The pool is intentionally bounded to protect the hot path while giving the
 * auction enough breadth as the marketplace grows.
 */
export async function loadCandidates(zone: ZoneContext): Promise<ServingCandidate[]> {
  const t0 = Date.now();
  const formats =
    zone.zoneFormat === "responsive" ? null : ([zone.zoneFormat, "responsive"] as const);

  let query = supabaseAdmin
    .from("ads")
    .select(
      `id, name, format, status, approval_status, destination_url, media_asset_id, campaign_id, campaigns!inner(id, organization_id, status, approval_status, bid_type, bid_amount, total_budget, spent_amount, priority, start_date, end_date, campaign_targeting(countries, counties, cities, devices, operating_systems, browsers, website_categories, schedule, frequency_cap))`,
    )
    .eq("status", "active")
    .eq("approval_status", "approved")
    .not("media_asset_id", "is", null)
    .eq("campaigns.approval_status", "approved")
    .in("campaigns.status", ["active", "approved"])
    .limit(AD_CANDIDATE_LIMIT);

  if (formats) query = query.in("format", formats);

  const { data, error } = await query;
  console.debug("[ad] candidates_lookup_ms", Date.now() - t0, "limit", AD_CANDIDATE_LIMIT);

  if (error || !data) return [];

  return data.map((row) => {
    const campaign = row.campaigns as unknown as {
      id: string;
      organization_id: string;
      status: ServingCandidate["campaignStatus"];
      approval_status: ServingCandidate["campaignApproval"];
      bid_type: ServingCandidate["bidType"];
      bid_amount: number;
      total_budget: number;
      spent_amount: number;
      priority: number;
      start_date: string | null;
      end_date: string | null;
      campaign_targeting: TargetingRow | TargetingRow[] | null;
    };
    const raw = campaign.campaign_targeting;
    const targeting = Array.isArray(raw) ? raw[0] : (raw ?? undefined);

    return {
      adId: row.id,
      adName: row.name,
      adFormat: row.format,
      adStatus: row.status,
      adApproval: row.approval_status,
      destinationUrl: row.destination_url,
      mediaAssetId: row.media_asset_id,
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      campaignApproval: campaign.approval_status,
      bidType: campaign.bid_type,
      bidAmount: Number(campaign.bid_amount),
      totalBudget: Number(campaign.total_budget),
      spentAmount: Number(campaign.spent_amount ?? 0),
      priority: Number(campaign.priority ?? 5),
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      organizationId: campaign.organization_id,
      targeting: {
        countries: targeting?.countries ?? [],
        counties: targeting?.counties ?? [],
        cities: targeting?.cities ?? [],
        devices: targeting?.devices ?? [],
        operatingSystems: targeting?.operating_systems ?? [],
        browsers: targeting?.browsers ?? [],
        websiteCategories: targeting?.website_categories ?? [],
        schedule: parseSchedule(targeting?.schedule),
        frequencyCap: targeting?.frequency_cap ?? null,
      },
      frequencyCap: targeting?.frequency_cap ?? null,
    } satisfies ServingCandidate;
  });
}

async function creativeUrl(
  mediaAssetId: string,
): Promise<{ url: string; width: number | null; height: number | null } | null> {
  cleanupCreativeCache();
  const t0 = Date.now();
  const cached = CREATIVE_CACHE.get(mediaAssetId);
  if (cached) {
    console.debug("[ad] creative_lookup_ms", Date.now() - t0, "cache_hit=true");
    return { url: cached.url, width: cached.width, height: cached.height };
  }

  const { data: asset, error } = await supabaseAdmin
    .from("media_assets")
    .select("storage_path, width, height, status, storage_provider")
    .eq("id", mediaAssetId)
    .maybeSingle();
  console.debug("[ad] creative_lookup_ms", Date.now() - t0, "cache_hit=false");

  if (error || !asset || asset.status !== "ready") return null;

  let url: string;
  if (asset.storage_provider === "supabase") {
    const publicUrl = supabaseAdmin.storage.from(CREATIVE_BUCKET).getPublicUrl(asset.storage_path)
      .data.publicUrl;
    if (publicUrl) {
      url = publicUrl;
    } else {
      const signed = await supabaseAdmin.storage
        .from(CREATIVE_BUCKET)
        .createSignedUrl(asset.storage_path, CREATIVE_URL_TTL_SECONDS);
      if (signed.error || !signed.data?.signedUrl) return null;
      url = signed.data.signedUrl;
    }
  } else {
    url = asset.storage_path;
  }

  CREATIVE_CACHE.set(mediaAssetId, {
    url,
    width: asset.width,
    height: asset.height,
    _ts: Date.now(),
  });
  return { url, width: asset.width, height: asset.height };
}

export type AdRequestInput = {
  zoneKey: string;
  userAgent: string | null;
  country: string | null;
  county: string | null;
  city: string | null;
  requestId: string;
  ipAddress: string;
};

/** Exactly what the browser is allowed to see. No campaign or bid data. */
export type AdResponse =
  | {
      ok: true;
      requestId: string;
      token: string;
      fillType?: "house_ad";
      ad: {
        format: string;
        width: number | null;
        height: number | null;
        imageUrl: string;
        alt: string;
        clickUrl: string;
      };
    }
  | { ok: false; reason: "unknown_zone" | "zone_unavailable" | "no_ad" | "blocked_ip" | "serve_timeout" };

async function serveAdInner(input: AdRequestInput): Promise<AdResponse> {
  const t0 = Date.now();
  console.debug("[ad] serve_ip", input.ipAddress);

  const zone = await loadZoneContext(input.zoneKey);
  if (!zone) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "unknown_zone" };
  }
  if (!zoneIsServeable(zone).eligible) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "zone_unavailable" };
  }

  const now = new Date();
  const agent = classifyUserAgent(input.userAgent);
  const sessionId = deriveSessionId({
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    device: agent.device,
    os: agent.os,
    browser: agent.browser,
  });
  const signals: RequestSignals = {
    device: agent.device,
    os: agent.os,
    browser: agent.browser,
    websiteCategory: zone.websiteCategory,
    weekday: weekdayOf(now),
    hour: now.getUTCHours(),
    sessionId,
    ...(input.country ? { country: input.country } : {}),
    ...(input.county ? { county: input.county } : {}),
    ...(input.city ? { city: input.city } : {}),
  };

  const candidates = await loadCandidates(zone);
  if (candidates.length === 0) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
  }

  const { fundedOrganizationIds } = await import("@/lib/billing-charge.server");
  const funded = await fundedOrganizationIds([
    ...new Set(candidates.map((c) => c.organizationId).filter((id): id is string => Boolean(id))),
  ]);
  const fundedCandidates = candidates.filter(
    (c) => !c.organizationId || funded.has(c.organizationId),
  );
  if (fundedCandidates.length === 0) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
  }

  const { checkFrequencyCap, recordFrequencyCap } = await import("@/lib/frequency-cap.server");

  // Rank first, then check caps in auction order. This avoids issuing one
  // Redis request for every candidate before we know which ad can win.
  const rankedCandidates = rankCandidates(fundedCandidates, zone, { now, signals });
  let winner: ServingCandidate | null = null;
  for (const entry of rankedCandidates) {
    const cap = await checkFrequencyCap(sessionId, entry.candidate.campaignId, entry.candidate.frequencyCap);
    if (!cap.capped) {
      winner = entry.candidate;
      break;
    }
  }

  if (!winner || !winner.mediaAssetId) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
  }
  if (!winner || !winner.mediaAssetId) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
  }

  const creative = await creativeUrl(winner.mediaAssetId);
  if (!creative) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
  }

  // Consume the frequency-cap slot only after we have a renderable winner.
  // Failure to update the cap must not turn a valid ad request into a no-fill.
  try {
    await recordFrequencyCap(sessionId, winner.campaignId, winner.frequencyCap);
  } catch (error) {
    console.warn("[ad] frequency_cap_record_failed", {
      campaignId: winner.campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const token = issueServedToken({
    rid: input.requestId,
    adId: winner.adId,
    campaignId: winner.campaignId,
    publisherId: zone.publisherId,
    websiteId: zone.websiteId,
    zoneId: zone.zoneId,
    device: agent.device,
    browser: agent.browser,
    os: agent.os,
    country: input.country,
  });

  const fallbackSize = FORMAT_SIZES[winner.adFormat];
  console.debug("[ad] serve_total_ms", Date.now() - t0);
  return {
    ok: true,
    requestId: input.requestId,
    token,
    ad: {
      format: winner.adFormat,
      width: creative.width ?? fallbackSize.width,
      height: creative.height ?? fallbackSize.height,
      imageUrl: creative.url,
      alt: winner.adName,
      clickUrl: "", // filled in by the route, which knows the request origin
    },
  };
}

async function loadHouseAd(): Promise<{
  creativeUrl: string;
  clickUrl: string;
  format: string;
  width: number | null;
  height: number | null;
} | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("house_ads")
      .select("creative_url, click_url")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      creativeUrl: data.creative_url,
      clickUrl: data.click_url,
      format: "300x250",
      width: 300,
      height: 250,
    };
  } catch {
    return null;
  }
}

export async function serveAd(input: AdRequestInput): Promise<AdResponse> {
  if (redis && input.ipAddress) {
    const blocked = await redis.sismember("blocked_ips", input.ipAddress);
    if (blocked) {
      console.warn("[ad] blocklist_hit", { ip: input.ipAddress, zone: input.zoneKey });
      const { recordBlockedIpHit } = await import("@/lib/fraud-center.server");
      void recordBlockedIpHit(input.ipAddress, input.zoneKey, "serve");
      return { ok: false, reason: "blocked_ip" };
    }
  }

  try {
    const result = await Promise.race([
      serveAdInner(input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("serve_timeout")), AD_SERVE_TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "serve_timeout";
    console.warn("[ad] serve_timeout_or_error", {
      zone: input.zoneKey,
      timeout: isTimeout,
      timeoutMs: AD_SERVE_TIMEOUT_MS,
      error: error instanceof Error ? error.message : String(error),
    });

    const houseAd = await loadHouseAd();
    if (houseAd) {
      console.debug("[ad] house_ad_served", { zone: input.zoneKey, reason: isTimeout ? "timeout" : "error" });
      return {
        ok: true,
        requestId: input.requestId,
        fillType: "house_ad",
        ad: {
          format: houseAd.format,
          width: houseAd.width,
          height: houseAd.height,
          imageUrl: houseAd.creativeUrl,
          alt: "Advertisement",
          clickUrl: houseAd.clickUrl,
        },
      };
    }

    return { ok: false, reason: isTimeout ? "serve_timeout" : "no_ad" };
  }
}

/** Idempotent: the unique index on request_id absorbs duplicate beacons. */
export async function recordImpression(
  payload: ServedTokenPayload,
  ipAddress?: string,
  userAgent?: string,
  botScore?: number | null,
  isLikelyBot?: boolean,
  country?: string | null,
  region?: string | null,
): Promise<"recorded" | "duplicate" | "failed"> {
  const useBuffer = process.env["USE_BUFFERED_IMPRESSIONS"] === "true";

  if (useBuffer) {
    const event: ImpressionEvent = {
      request_id: payload.rid,
      ad_id: payload.adId,
      campaign_id: payload.campaignId,
      publisher_id: payload.publisherId,
      website_id: payload.websiteId,
      ad_zone_id: payload.zoneId,
      device_type: payload.device as never,
      browser: payload.browser as never,
      operating_system: payload.os as never,
      country: country ?? payload.country,
      ip_address: ipAddress,
      user_agent: userAgent,
      bot_score: botScore ?? null,
      is_likely_bot: isLikelyBot ?? false,
      region: region ?? null,
      timestamp: Date.now(),
    };

    const buffered = await bufferImpression(event);
    if (buffered) {
      return "recorded";
    }

    console.warn("[impression-buffer] buffer write failed, falling back to direct insert");
  }

  const { error } = await supabaseAdmin.from("impressions").insert({
    request_id: payload.rid,
    ad_id: payload.adId,
    campaign_id: payload.campaignId,
    publisher_id: payload.publisherId,
    website_id: payload.websiteId,
    ad_zone_id: payload.zoneId,
    device_type: payload.device as never,
    browser: payload.browser as never,
    operating_system: payload.os as never,
    country: country ?? payload.country,
    ip_address: ipAddress,
    region: region ?? null,
    bot_score: botScore ?? null,
    is_likely_bot: isLikelyBot ?? false,
  });
  if (error) return error.code === "23505" ? "duplicate" : "failed";

  let fraudEvaluation: { status: string } | null = null;
  if (ipAddress) {
    try {
      const evaluation = await evaluateImpressionFraud(supabaseAdmin as never, {
        ipAddress,
        userAgent: userAgent ?? "",
        campaignId: payload.campaignId,
        publisherId: payload.publisherId,
        websiteId: payload.websiteId,
        adZoneId: payload.zoneId,
        requestId: payload.rid,
      });
      fraudEvaluation = evaluation;
      await recordFraudEvent(supabaseAdmin as never, evaluation, {
        eventType: "impression_fraud",
        actorType: "ip",
        actorId: ipAddress,
        targetType: "campaign",
        targetId: payload.campaignId,
        ipAddress,
        userAgent: userAgent ?? "",
        country: payload.country ?? "",
      });
    } catch {
      // Fraud detection failure must not break impression recording
    }
  }

  const shouldBlockBilling =
    fraudEvaluation?.status === "blocked" || isLikelyBot === true;

  if (shouldBlockBilling) {
    if (fraudEvaluation?.status === "blocked") {
      try {
        await supabaseAdmin
          .from("impressions")
          .update({ is_likely_bot: true })
          .eq("request_id", payload.rid);
      } catch {
        // best-effort flagging
      }
    }
    return "recorded";
  }

  const { chargeAdEvent } = await import("@/lib/billing-charge.server");
  await chargeAdEvent({
    eventType: "impression",
    requestId: payload.rid,
    campaignId: payload.campaignId,
    adId: payload.adId,
    publisherId: payload.publisherId,
    websiteId: payload.websiteId,
    adZoneId: payload.zoneId,
  });

  return "recorded";
}

/**
 * Click handling. The destination is read from the ad row every time — never
 * from the request — and must still be an approved, active, http(s) URL.
 */
export async function recordClick(
  payload: ServedTokenPayload,
  ipAddress?: string,
  userAgent?: string,
  botScore?: number | null,
  isLikelyBot?: boolean,
  country?: string | null,
  region?: string | null,
): Promise<{ destination: string } | null> {
  const [{ data: ad }, { data: impression }] = await Promise.all([
    supabaseAdmin
      .from("ads")
      .select("destination_url, status, approval_status")
      .eq("id", payload.adId)
      .maybeSingle(),
    supabaseAdmin.from("impressions").select("id").eq("request_id", payload.rid).maybeSingle(),
  ]);

  if (!ad || ad.status !== "active" || ad.approval_status !== "approved") return null;
  if (!isSafeDestination(ad.destination_url)) return null;

  const impressionId = impression?.id ?? null;
  if (!impressionId) return null;

  const { error: clickError } = await supabaseAdmin.from("clicks").insert({
    request_id: payload.rid,
    impression_id: impressionId,
    ad_id: payload.adId,
    campaign_id: payload.campaignId,
    publisher_id: payload.publisherId,
    website_id: payload.websiteId,
    ad_zone_id: payload.zoneId,
    ip_address: ipAddress,
    country: country ?? null,
    region: region ?? null,
    bot_score: botScore ?? null,
    is_likely_bot: isLikelyBot ?? false,
  });

  if (clickError) {
    if (clickError.code === "23505") return { destination: ad.destination_url };
    return null;
  }

  let clickFraudEvaluation: { status: string } | null = null;
  if (!clickError && ipAddress) {
    try {
      const evaluation = await evaluateClickFraud(supabaseAdmin as never, {
        ipAddress,
        userAgent: userAgent ?? "",
        campaignId: payload.campaignId,
        publisherId: payload.publisherId,
        websiteId: payload.websiteId,
        adZoneId: payload.zoneId,
        requestId: payload.rid,
      });
      clickFraudEvaluation = evaluation;
      await recordFraudEvent(supabaseAdmin as never, evaluation, {
        eventType: "click_fraud",
        actorType: "ip",
        actorId: ipAddress,
        targetType: "campaign",
        targetId: payload.campaignId,
        ipAddress,
        userAgent: userAgent ?? "",
        country: payload.country ?? "",
      });
    } catch {
      // Fraud detection failure must not break click recording
    }
  }

  const shouldBlockClickBilling =
    clickFraudEvaluation?.status === "blocked" || isLikelyBot === true;

  if (shouldBlockClickBilling) {
    if (clickFraudEvaluation?.status === "blocked") {
      try {
        await supabaseAdmin
          .from("clicks")
          .update({ is_likely_bot: true })
          .eq("request_id", payload.rid);
      } catch {
        // best-effort flagging
      }
    }
    return { destination: ad.destination_url };
  }

  if (!clickError) {
    const { chargeAdEvent } = await import("@/lib/billing-charge.server");
    await chargeAdEvent({
      eventType: "click",
      requestId: payload.rid,
      campaignId: payload.campaignId,
      adId: payload.adId,
      publisherId: payload.publisherId,
      websiteId: payload.websiteId,
      adZoneId: payload.zoneId,
    });
  }

  return { destination: ad.destination_url };
}

/** Diagnostics for the in-app sandbox: per-candidate eligibility, staff/owner only. */
export type CandidateDiagnostic = {
  adId: string;
  adName: string;
  adFormat: string;
  campaignId: string;
  verdict: "eligible" | IneligibleReason;
  score: number | null;
};
