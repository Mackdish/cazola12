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
  weekdayOf,
  zoneIsServeable,
  type IneligibleReason,
  type ServingCandidate,
  type ZoneContext,
} from "@/lib/ad-serving-domain";
import { CREATIVE_BUCKET } from "@/lib/media-service.server";
import { normalizeDomain } from "@/lib/publisher-domain";
import { issueServedToken, type ServedTokenPayload } from "@/lib/ad-token.server";
import { checkRateLimit, extractIpAddress, getRateLimitConfig } from "@/lib/rate-limit.server";
import {
  evaluateClickFraud,
  evaluateImpressionFraud,
  recordFraudEvent,
} from "@/lib/fraud-detection.server";
import { cachedServePathGet } from "@/lib/cache.server";
import { redis } from "@/lib/redis.server";
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
const AD_CANDIDATE_BATCH_SIZE = 100;
const AD_CANDIDATE_MAX = 300;

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
        `id, status, format, website_id, publisher_id, websites!inner(status, approval_status, verification_status, category, domain), publishers!inner(status, approval_status)`,
      )
      .eq("zone_key", zoneKey)
      .maybeSingle();

    console.debug("[ad] zone_lookup_ms", Date.now() - t0);

    if (error) {
      console.error("[ad] zone_lookup_failed", {
        zone: zoneKey,
        error: error.message,
      });
      throw error;
    }
    if (!data) return null;
    const website = data.websites as unknown as {
      status: ZoneContext["websiteStatus"];
      approval_status: ZoneContext["websiteApproval"];
      verification_status: ZoneContext["websiteVerification"];
      category: ZoneContext["websiteCategory"];
      domain: string;
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
      websiteDomain: website.domain,
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
async function loadCandidatesUncached(zone: ZoneContext): Promise<ServingCandidate[]> {
  const t0 = Date.now();
  const formats =
    zone.zoneFormat === "responsive" ? null : ([zone.zoneFormat, "responsive"] as const);

  const rows: any[] = [];
  let offset = 0;
  let lastBatchSize = 0;

  while (offset < AD_CANDIDATE_MAX) {
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
      // Keep pagination deterministic without relying on PostgREST foreign-table
      // ordering. Auction priority is applied by rankCandidates() after the
      // rows are loaded, so ordering campaigns here adds no serving value and
      // can make the hot-path query fail on some PostgREST versions.
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + AD_CANDIDATE_BATCH_SIZE - 1);

    if (formats) query = query.in("format", formats);

    const { data, error } = await query;
    if (error) {
      console.error("[ad] candidates_lookup_failed", error.message);
      throw error;
    }
    if (!data) {
      console.error("[ad] candidates_lookup_failed", "no data");
      throw new Error("candidate_lookup_no_data");
    }

    rows.push(...data);
    lastBatchSize = data.length;
    if (lastBatchSize < AD_CANDIDATE_BATCH_SIZE) break;
    offset += AD_CANDIDATE_BATCH_SIZE;
  }

  console.debug(
    "[ad] candidates_lookup_ms",
    Date.now() - t0,
    "candidates",
    rows.length,
    "max",
    AD_CANDIDATE_MAX,
  );

  return rows.map((row) => {
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

// Candidate inventory is identical for zones with the same format. Reuse a
// short-lived in-process snapshot and coalesce concurrent cold misses so each
// request does not repeat the same 2–3 Supabase queries. Billing remains
// authoritative and rejects stale/paused/exhausted campaigns at charge time.
const CANDIDATE_CACHE_TTL_MS = 3_000;
const CANDIDATE_CACHE_MAX_ENTRIES = 12;
type CandidateCacheEntry = {
  expiresAt: number;
  promise: Promise<ServingCandidate[]>;
};
const CANDIDATE_CACHE = new Map<string, CandidateCacheEntry>();

export async function loadCandidates(zone: ZoneContext): Promise<ServingCandidate[]> {
  const key = zone.zoneFormat;
  const now = Date.now();
  const cached = CANDIDATE_CACHE.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) CANDIDATE_CACHE.delete(key);

  // Keep this small, bounded cache fresh without allowing unbounded growth.
  for (const [cacheKey, entry] of CANDIDATE_CACHE) {
    if (entry.expiresAt <= now) CANDIDATE_CACHE.delete(cacheKey);
  }
  while (CANDIDATE_CACHE.size >= CANDIDATE_CACHE_MAX_ENTRIES) {
    const oldestKey = CANDIDATE_CACHE.keys().next().value;
    if (oldestKey === undefined) break;
    CANDIDATE_CACHE.delete(oldestKey);
  }

  const promise = loadCandidatesUncached(zone);
  CANDIDATE_CACHE.set(key, { expiresAt: now + CANDIDATE_CACHE_TTL_MS, promise });
  try {
    return await promise;
  } catch (error) {
    CANDIDATE_CACHE.delete(key);
    throw error;
  }
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
    // Creatives are uploaded through signed storage URLs and the bucket may be
    // private. getPublicUrl() only constructs a URL; it does not prove that the
    // object is publicly readable. Prefer a signed URL so a private bucket
    // cannot silently produce an image URL that the publisher browser cannot
    // load. Keep a public-URL fallback for installations that intentionally use
    // a public bucket.
    const signed = await supabaseAdmin.storage
      .from(CREATIVE_BUCKET)
      .createSignedUrl(asset.storage_path, CREATIVE_URL_TTL_SECONDS);
    if (signed.data?.signedUrl) {
      url = signed.data.signedUrl;
    } else {
      const publicUrl = supabaseAdmin.storage
        .from(CREATIVE_BUCKET)
        .getPublicUrl(asset.storage_path).data.publicUrl;
      if (!publicUrl) return null;
      url = publicUrl;
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
  /** Browser origin of the publisher page, when the public endpoint supplies it. */
  origin?: string | null;
  /** Optional API-v1 ownership assertion for legacy callers. */
  expectedWebsiteId?: string | null;
};

/** Exactly what the browser is allowed to see. No campaign or bid data. */
export type AdResponse =
  | {
      ok: true;
      requestId: string;
      token?: string;
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

  if (input.expectedWebsiteId && input.expectedWebsiteId !== zone.websiteId) {
    console.warn("[ad] website_zone_mismatch", {
      zone: input.zoneKey,
      expectedWebsiteId: input.expectedWebsiteId,
      actualWebsiteId: zone.websiteId,
    });
    return { ok: false, reason: "zone_unavailable" };
  }

  // Bind browser-side public serving to the registered publisher domain.
  // The placement discovery endpoint already performs this check; the manual
  // zone endpoint must enforce it too so a copied zone key cannot be embedded
  // on an unrelated site.
  if (input.origin) {
    try {
      const originHost = normalizeDomain(new URL(input.origin).hostname);
      const registeredHost = normalizeDomain(zone.websiteDomain);
      if (!originHost || !registeredHost || originHost !== registeredHost) {
        console.warn("[ad] origin_mismatch", {
          zone: input.zoneKey,
          originHost,
          registeredHost,
        });
        return { ok: false, reason: "zone_unavailable" };
      }
    } catch {
      return { ok: false, reason: "zone_unavailable" };
    }
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

  const { checkFrequencyCap } = await import("@/lib/frequency-cap.server");

  // Check ranked candidates in small parallel batches. Frequency caps are
  // side-effect free, so we can safely skip capped candidates and continue
  // looking for the first candidate whose creative is actually deliverable.
  // Previously, a top-ranked ad with a missing/unready/private creative caused
  // an immediate no-fill even when a lower-ranked valid ad was available.
  const rankedCandidates = rankCandidates(fundedCandidates, zone, { now, signals });
  let winner: ServingCandidate | null = null;
  let creative: { url: string; width: number | null; height: number | null } | null = null;
  const frequencyCheckBatchSize = 8;
  const maxCreativeFallbacks = 12;

  for (let i = 0; i < rankedCandidates.length && !winner; i += frequencyCheckBatchSize) {
    const batch = rankedCandidates.slice(i, i + frequencyCheckBatchSize);
    const capResults = await Promise.all(
      batch.map(({ candidate }) =>
        checkFrequencyCap(sessionId, candidate.campaignId, candidate.frequencyCap),
      ),
    );

    for (let j = 0; j < batch.length; j += 1) {
      if (capResults[j]?.capped) continue;

      const candidate = batch[j].candidate;
      if (!candidate.mediaAssetId) continue;

      const candidateCreative = await creativeUrl(candidate.mediaAssetId);
      if (!candidateCreative) {
        console.warn("[ad] candidate_creative_unavailable", {
          adId: candidate.adId,
          campaignId: candidate.campaignId,
        });
        continue;
      }

      winner = candidate;
      creative = candidateCreative;
      break;
    }

    // Avoid turning a single bad creative into a storage/DB fan-out under load.
    if (i + frequencyCheckBatchSize >= maxCreativeFallbacks) break;
  }

  if (!winner || !creative) {
    console.debug("[ad] serve_total_ms", Date.now() - t0);
    return { ok: false, reason: "no_ad" };
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

  // Frequency caps are consumed only after a billable impression has
  // actually been accepted. Buffering alone is not proof that billing succeeded.
  const recordDeliveredFrequencyCap = async () => {
    if (!payload.campaignId) return;
    const { recordFrequencyCap } = await import("@/lib/frequency-cap.server");
    const sessionId = deriveSessionId({
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      device: payload.device,
      os: payload.os,
      browser: payload.browser,
    });
    // The token intentionally does not expose the advertiser's cap settings.
    // Read the campaign targeting row here so the serving path remains the
    // source of truth for cap configuration while the cap is consumed only by
    // a real impression.
    const { data: targeting } = await supabaseAdmin
      .from("campaign_targeting")
      .select("frequency_cap")
      .eq("campaign_id", payload.campaignId)
      .maybeSingle();
    const cap = targeting?.frequency_cap as { impressions: number; periodHours: number } | null;
    if (!cap) return;
    try {
      await recordFrequencyCap(sessionId, payload.campaignId, cap);
    } catch (error) {
      console.warn("[ad] frequency_cap_record_failed", {
        campaignId: payload.campaignId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

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
      // The flush worker owns billing for buffered events. Do not consume the
      // visitor's frequency cap until that billing step succeeds.
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
  const charge = await chargeAdEvent({
    eventType: "impression",
    requestId: payload.rid,
    campaignId: payload.campaignId,
    adId: payload.adId,
    publisherId: payload.publisherId,
    websiteId: payload.websiteId,
    adZoneId: payload.zoneId,
  });

  if (charge.ok) await recordDeliveredFrequencyCap();

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

  let impressionId = impression?.id ?? null;

  // With buffered impressions enabled, the impression beacon can arrive before
  // the flush worker has materialized the impression row. A click can happen
  // in that short window and must not be rejected just because the async
  // impression write has not caught up yet. Materialize the same signed event
  // synchronously; the stream flush uses request_id idempotency and will ignore
  // the duplicate row while still completing its billing/fraud processing.
  if (!impressionId) {
    const { data: ensured, error: ensureError } = await supabaseAdmin
      .from("impressions")
      .insert({
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
      })
      .select("id")
      .maybeSingle();

    if (ensured?.id) {
      impressionId = ensured.id;
    } else if (ensureError?.code !== "23505") {
      console.warn("[ad] click_impression_materialization_failed", {
        requestId: payload.rid,
        error: ensureError?.message ?? "unknown",
      });
      return null;
    } else {
      const { data: existing } = await supabaseAdmin
        .from("impressions")
        .select("id")
        .eq("request_id", payload.rid)
        .maybeSingle();
      impressionId = existing?.id ?? null;
    }
  }

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
