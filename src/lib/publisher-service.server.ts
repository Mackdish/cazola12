/**
 * Server-only publisher inventory service.
 *
 * Callers pass an authenticated Supabase client (RLS scoped to the signed-in
 * user). Ownership is therefore always established by RLS reads before any
 * privileged write is performed with the service-role client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type WebsiteUpdate = Database["public"]["Tables"]["websites"]["Update"];
type PublisherUpdate = Database["public"]["Tables"]["publishers"]["Update"];
import { normalizeDomain } from "@/lib/publisher-domain";
import type {
  AdFormat,
  ApprovalStatus,
  VerificationMethod,
  WebsiteCategory,
} from "@/lib/publisher-domain";
import { adFormatSpec } from "@/lib/publisher-domain";
import {
  createVerificationToken,
  verifyDomainOwnership,
} from "@/lib/publisher-verification.server";
import { cachedGetVersioned, cacheDelete, cacheBumpVersion, invalidateZoneContextCache } from "@/lib/cache.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string };

export class ServiceError extends Error {}

function fail(message: string): never {
  throw new ServiceError(message);
}

async function invalidateZoneContextForPublisher(publisherId: string) {
  const db = await admin();
  const { data } = await db
    .from("ad_zones")
    .select("zone_key")
    .eq("publisher_id", publisherId);
  const keys = (data ?? []).map((row: any) => row.zone_key).filter(Boolean);
  await invalidateZoneContextCache(keys);
}

async function invalidateZoneContextForWebsite(websiteId: string) {
  const db = await admin();
  const { data } = await db
    .from("ad_zones")
    .select("zone_key")
    .eq("website_id", websiteId);
  const keys = (data ?? []).map((row: any) => row.zone_key).filter(Boolean);
  await invalidateZoneContextCache(keys);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

// ---------------------------------------------------------------- publisher

/** Verifies the signed-in user belongs to the organization (trusted lookup). */
async function assertOrgMember(ctx: Ctx, organizationId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("organization_members")
    .select("id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) fail("We couldn't verify your organization access.");
  if (!data || data.status !== "active")
    fail("You don't have permission to manage this organization.");
  return data;
}

export async function requirePublisher(ctx: Ctx, organizationId: string) {
  const data = await getPublisherProfile(ctx, organizationId);
  if (!data) fail("Complete your publisher profile before continuing.");
  return data;
}

export async function savePublisherProfile(
  ctx: Ctx,
  input: {
    organizationId: string;
    businessName: string;
    contactEmail: string;
    contactPhone?: string | null | undefined;
    websiteUrl?: string | null | undefined;
  },
) {
  await assertOrgMember(ctx, input.organizationId);
  const db = await admin();
  const { data, error } = await db.rpc("ensure_publisher", {
    _organization_id: input.organizationId,
    _business_name: input.businessName,
    _contact_email: input.contactEmail,
    ...(input.contactPhone ? { _contact_phone: input.contactPhone } : {}),
    ...(input.websiteUrl ? { _website_url: input.websiteUrl } : {}),
  });
  if (error) {
    if (/not authorized/i.test(error.message))
      fail("You don't have permission to manage this organization.");
    if (/not a publisher/i.test(error.message))
      fail("This organization isn't a publisher organization.");
    fail("We couldn't save your publisher profile. Please try again.");
  }
  const publisher = Array.isArray(data) ? data[0]! : data!;
  if (publisher.approval_status === "pending") {
    const { error: approveError } = await db
      .from("publishers")
      .update({ approval_status: "approved" })
      .eq("id", publisher.id);
    if (approveError) {
      console.error("[publisher] failed to auto-approve new publisher", approveError);
    }
  }
  await cacheBumpVersion("publisher", input.organizationId);
  await cacheDelete(`publisher:${input.organizationId}:profile`);
  await invalidateZoneContextForPublisher(publisher.id);
  return publisher;
}

export async function getPublisherProfile(ctx: Ctx, organizationId: string) {
  await assertOrgMember(ctx, organizationId);
  const db = await admin();
  return cachedGetVersioned({
    prefix: "publisher",
    id: organizationId,
    ttlSeconds: 300,
    legacyKey: `publisher:${organizationId}:profile`,
    supplier: async () => {
      const { data, error } = await db
        .from("publishers")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) fail("We couldn't load your publisher profile.");
      return data ?? null;
    },
  });
}


// ----------------------------------------------------------------- websites

export async function listWebsites(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase
    .from("websites")
    .select("*, ad_zones(id, status)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your websites.");
  return (data ?? []).map((row) => {
    const { ad_zones, ...website } = row as typeof row & {
      ad_zones: Array<{ id: string; status: string }>;
    };
    return {
      ...website,
      zoneCount: ad_zones?.length ?? 0,
      activeZoneCount: (ad_zones ?? []).filter((zone) => zone.status === "active").length,
    };
  });
}

export async function getWebsiteDetail(ctx: Ctx, websiteId: string) {
  return cachedGetVersioned({
    prefix: "website",
    id: websiteId,
    ttlSeconds: 300,
    legacyKey: `website:${websiteId}:detail`,
    supplier: async () => {
      const { data: website, error } = await ctx.supabase
        .from("websites")
        .select("*")
        .eq("id", websiteId)
        .maybeSingle();
      if (error) fail("We couldn't load this website.");
      if (!website) fail("That website doesn't exist, or you don't have access to it.");

      const [zones, verifications] = await Promise.all([
        ctx.supabase
          .from("ad_zones")
          .select("*")
          .eq("website_id", websiteId)
          .order("created_at", { ascending: false }),
        ctx.supabase
          .from("domain_verifications")
          .select("*")
          .eq("website_id", websiteId)
          .order("created_at", { ascending: false }),
      ]);
      if (zones.error) fail("We couldn't load this website's ad zones.");
      if (verifications.error) fail("We couldn't load this website's verification records.");

      return { website, zones: zones.data ?? [], verifications: verifications.data ?? [] };
    },
  });
}

export async function createWebsite(
  ctx: Ctx,
  input: {
    organizationId: string;
    domain: string;
    name: string;
    description?: string | null | undefined;
    category: WebsiteCategory;
    monthlyPageviews?: number | undefined;
  },
) {
  const publisher = await requirePublisher(ctx, input.organizationId);
  if (publisher.approval_status !== "approved") {
    fail("Your publisher account is pending approval. You'll be able to add websites once it's reviewed.");
  }
  const domain = normalizeDomain(input.domain);
  if (!domain) fail("Enter a valid domain, for example example.com.");

  const { data, error } = await ctx.supabase
    .from("websites")
    .insert({
      publisher_id: publisher.id,
      organization_id: input.organizationId,
      domain,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      monthly_pageviews: Math.max(0, Math.trunc(input.monthlyPageviews ?? 0)),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      fail("That domain is already registered on the network. Contact support if you own it.");
    }
    if (error.code === "23514")
      fail("That domain doesn't look valid. Use a bare hostname such as example.com.");
    if (error.code === "42501")
      fail("You don't have permission to add websites for this organization.");
    fail("We couldn't add that website. Please try again.");
  }
  return data!;
}

export async function updateWebsite(
  ctx: Ctx,
  input: {
    websiteId: string;
    name?: string | undefined;
    description?: string | null | undefined;
    category?: WebsiteCategory | undefined;
    monthlyPageviews?: number | undefined;
  },
) {
  const patch: WebsiteUpdate = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.monthlyPageviews !== undefined) {
    patch.monthly_pageviews = Math.max(0, Math.trunc(input.monthlyPageviews));
  }
  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const { data, error } = await ctx.supabase
    .from("websites")
    .update(patch)
    .eq("id", input.websiteId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't save those website details.");
  if (!data) fail("That website doesn't exist, or you don't have access to it.");
  await cacheBumpVersion("website", input.websiteId);
  await cacheDelete(`website:${input.websiteId}:detail`);
  await invalidateZoneContextForWebsite(input.websiteId);
  return data;
}

// ------------------------------------------------------------ verifications

export async function startVerification(
  ctx: Ctx,
  input: { websiteId: string; method: VerificationMethod; regenerate?: boolean | undefined },
) {
  const { checkRateLimit, getRateLimitConfig } = await import("@/lib/rate-limit.server");
  const rateLimitConfig = getRateLimitConfig("verification");

  try {
    await checkRateLimit(
      ctx.supabase as unknown as Parameters<typeof checkRateLimit>[0],
      rateLimitConfig,
      ctx.userId,
      undefined,
      ctx.userId,
    );
  } catch {
    fail("Too many verification attempts. Please wait before trying again.");
  }

  // RLS read establishes ownership before any privileged write.
  const { data: website, error } = await ctx.supabase
    .from("websites")
    .select("id, domain, organization_id, verification_status, verification_token")
    .eq("id", input.websiteId)
    .maybeSingle();
  if (error) fail("We couldn't load this website.");
  if (!website) fail("That website doesn't exist, or you don't have access to it.");

  const db = await admin();
  const token = website.verification_token || createVerificationToken();
  if (!website.verification_token) {
    await db.from("websites").update({ verification_token: token }).eq("id", website.id);
  }
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const existing = await db
    .from("domain_verifications")
    .select("*")
    .eq("website_id", website.id)
    .eq("method", input.method)
    .neq("status", "failed")
    .maybeSingle();

  if (existing.data && !input.regenerate && new Date(existing.data.expires_at) > new Date()) {
    return existing.data;
  }

  if (existing.data) {
    await db.from("domain_verifications").delete().eq("id", existing.data.id);
  }

  const inserted = await db
    .from("domain_verifications")
    .insert({
      website_id: website.id,
      organization_id: website.organization_id,
      method: input.method,
      verification_token: token,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (inserted.error) fail("We couldn't start verification. Please try again.");

  if (website.verification_status === "unverified") {
    await db.from("websites").update({ verification_status: "pending" }).eq("id", website.id);
  }
  await cacheBumpVersion("website", website.id);
  await cacheDelete(`website:${website.id}:detail`);
  await invalidateZoneContextForWebsite(website.id);
  return inserted.data;
}

export async function runVerification(
  ctx: Ctx,
  input: { websiteId: string; method: VerificationMethod },
) {
  const { data: website, error } = await ctx.supabase
    .from("websites")
    .select("id, domain, verification_status, verification_token")
    .eq("id", input.websiteId)
    .maybeSingle();
  if (error) fail("We couldn't load this website.");
  if (!website) fail("That website doesn't exist, or you don't have access to it.");

  const db = await admin();
  const record = await db
    .from("domain_verifications")
    .select("*")
    .eq("website_id", website.id)
    .eq("method", input.method)
    .neq("status", "failed")
    .maybeSingle();
  if (record.error || !record.data) fail("Start verification for this method first.");

  const verification = record.data;
  if (verification.status === "verified") {
    return { verified: true as const, message: "This domain is already verified." };
  }
  if (new Date(verification.expires_at) < new Date()) {
    fail("This verification token has expired. Generate a new one and try again.");
  }

  const token = website.verification_token || verification.verification_token;
  if (!token) fail("No verification token found. Generate a new one and try again.");

  // The check itself is a real network lookup — the client never reports it.
  const outcome = await verifyDomainOwnership(
    input.method,
    website.domain,
    token,
  );

  if (outcome.ok) {
    const now = new Date().toISOString();
    await db
      .from("domain_verifications")
      .update({
        status: "verified",
        verified_at: now,
        last_error: null,
        attempts: verification.attempts + 1,
      })
      .eq("id", verification.id);
    await db
      .from("websites")
      .update({ verification_status: "verified", verified_at: now, status: "active" })
      .eq("id", website.id);
    await cacheBumpVersion("website", website.id);
    await cacheDelete(`website:${website.id}:detail`);
    await invalidateZoneContextForWebsite(website.id);
    return { verified: true as const, message: "Domain ownership confirmed." };
  }

  await db
    .from("domain_verifications")
    .update({ status: "pending", last_error: outcome.reason, attempts: verification.attempts + 1 })
    .eq("id", verification.id);
  if (website.verification_status !== "verified") {
    await db.from("websites").update({ verification_status: "pending" }).eq("id", website.id);
  }
  return { verified: false as const, message: outcome.reason };
}

// ----------------------------------------------------------------- ad zones

export async function listAdZones(ctx: Ctx, organizationId: string) {
  return cachedGetVersioned({
    prefix: "org",
    id: organizationId,
    ttlSeconds: 120,
    legacyKey: `org:${organizationId}:ad_zones`,
    supplier: async () => {
      const { data, error } = await ctx.supabase
        .from("ad_zones")
        .select("*, websites(id, domain, name, verification_status, approval_status)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) fail("We couldn't load your ad zones.");
      return data ?? [];
    },
  });
}

export async function createAdZone(
  ctx: Ctx,
  input: { websiteId: string; name: string; format: AdFormat },
) {
  const { data: website, error } = await ctx.supabase
    .from("websites")
    .select("id, publisher_id, organization_id")
    .eq("id", input.websiteId)
    .maybeSingle();
  if (error) fail("We couldn't load this website.");
  if (!website) fail("That website doesn't exist, or you don't have access to it.");

  const spec = adFormatSpec(input.format);
  const responsive = input.format === "responsive";

  const keyResult = await ctx.supabase.rpc("generate_zone_key");
  if (keyResult.error || !keyResult.data)
    fail("We couldn't allocate a zone key. Please try again.");

  const { data, error: insertError } = await ctx.supabase
    .from("ad_zones")
    .insert({
      website_id: website.id,
      publisher_id: website.publisher_id,
      organization_id: website.organization_id,
      name: input.name.trim(),
      zone_key: keyResult.data,
      format: input.format,
      width: responsive ? null : spec.width,
      height: responsive ? null : spec.height,
      responsive,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      fail("You already have an ad zone with that name on this website. Choose another name.");
    }
    if (insertError.code === "42501") fail("You don't have permission to create ad zones here.");
    fail("We couldn't create that ad zone. Please try again.");
  }
  await cacheBumpVersion("org", website.organization_id);
  await cacheDelete(`org:${website.organization_id}:ad_zones`);
  await invalidateZoneContextForWebsite(website.id);
  return data!;
}

export async function setAdZoneStatus(
  ctx: Ctx,
  input: { zoneId: string; status: "active" | "suspended" },
) {
  const { data, error } = await ctx.supabase
    .from("ad_zones")
    .update({ status: input.status })
    .eq("id", input.zoneId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that ad zone.");
  if (!data) fail("That ad zone doesn't exist, or you don't have access to it.");
  await cacheBumpVersion("org", data.organization_id);
  await cacheDelete(`org:${data.organization_id}:ad_zones`);
  await invalidateZoneContextForWebsite(data.website_id);
  return data;
}

// -------------------------------------------------------------------- admin

export async function assertPlatformAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_admin", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This action requires platform admin access.");
}

export async function assertPlatformStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_platform_staff", { _user_id: ctx.userId });
  if (error) fail("We couldn't verify your permissions.");
  if (!data) fail("This area requires platform staff access.");
}

export async function adminListPublishers(ctx: Ctx) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const { data, error } = await db
    .from("publishers")
    .select(
      "*, organizations(id, name, slug, status), websites(id, status, approval_status, verification_status)",
    )
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load publishers.");
  return data ?? [];
}

export async function adminListWebsites(ctx: Ctx) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const { data, error } = await db
    .from("websites")
    .select("*, publishers(id, business_name, approval_status), ad_zones(*)")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load websites.");
  return data ?? [];
}

export async function adminGetPublisherDetail(ctx: Ctx, publisherId: string) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const publisher = await db
    .from("publishers")
    .select("*, organizations(id, name, slug, status)")
    .eq("id", publisherId)
    .maybeSingle();
  if (publisher.error) fail("We couldn't load that publisher.");
  if (!publisher.data) fail("That publisher doesn't exist.");

  const websites = await db
    .from("websites")
    .select("*, ad_zones(*)")
    .eq("publisher_id", publisherId)
    .order("created_at", { ascending: false });
  if (websites.error) fail("We couldn't load that publisher's websites.");

  return { publisher: publisher.data, websites: websites.data ?? [] };
}

export async function adminSetPublisherReview(
  ctx: Ctx,
  input: {
    publisherId: string;
    approvalStatus?: ApprovalStatus | undefined;
    status?: "active" | "suspended" | "pending" | undefined;
    reason?: string | null | undefined;
  },
) {
  await assertPlatformAdmin(ctx);
  const patch: PublisherUpdate = {};
  if (input.approvalStatus) patch.approval_status = input.approvalStatus;
  if (input.status) patch.status = input.status;
  if (input.reason !== undefined) patch.rejection_reason = input.reason?.trim() || null;
  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const db = await admin();
  const { data, error } = await db
    .from("publishers")
    .update(patch)
    .eq("id", input.publisherId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that publisher.");
  if (!data) fail("That publisher doesn't exist.");

  await cacheBumpVersion("publisher", data.organization_id);
  await cacheDelete(`publisher:${data.organization_id}:profile`);
  await invalidateZoneContextForPublisher(data.id);

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `publisher.${input.approvalStatus ?? input.status ?? "update"}`,
    targetType: "publisher",
    targetId: input.publisherId,
    metadata: { patch, reason: input.reason ?? null },
  });

  return data;
}

export async function adminSetWebsiteReview(
  ctx: Ctx,
  input: {
    websiteId: string;
    approvalStatus?: ApprovalStatus | undefined;
    status?: "active" | "suspended" | "pending" | undefined;
    reason?: string | null | undefined;
  },
) {
  await assertPlatformAdmin(ctx);
  const patch: WebsiteUpdate = {};
  if (input.approvalStatus) patch.approval_status = input.approvalStatus;
  if (input.status) patch.status = input.status;
  if (input.reason !== undefined) patch.rejection_reason = input.reason?.trim() || null;
  if (Object.keys(patch).length === 0) fail("Nothing to update.");

  const db = await admin();
  const { data, error } = await db
    .from("websites")
    .update(patch)
    .eq("id", input.websiteId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that website.");
  if (!data) fail("That website doesn't exist.");

  await cacheBumpVersion("website", input.websiteId);
  await cacheDelete(`website:${input.websiteId}:detail`);
  await invalidateZoneContextForWebsite(input.websiteId);

  if (input.approvalStatus === "approved") {
    try {
      const { sendWebsiteApprovedEmail } = await import("@/lib/email.server");
      const publisher = await db
        .from("publishers")
        .select("contact_email, business_name")
        .eq("id", data.publisher_id)
        .maybeSingle();

      if (publisher.data?.contact_email) {
        await sendWebsiteApprovedEmail({
          to: publisher.data.contact_email,
          publisherName: publisher.data.business_name,
          websiteName: data.name,
          domain: data.domain,
        });
      }
    } catch (error) {
      console.error("[email] website approval email failed", {
        websiteId: input.websiteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (input.approvalStatus === "rejected") {
    try {
      const { sendWebsiteRejectedEmail } = await import("@/lib/email.server");
      const publisher = await db
        .from("publishers")
        .select("contact_email, business_name")
        .eq("id", data.publisher_id)
        .maybeSingle();

      if (publisher.data?.contact_email) {
        await sendWebsiteRejectedEmail({
          to: publisher.data.contact_email,
          publisherName: publisher.data.business_name,
          websiteName: data.name,
          domain: data.domain,
          reason: input.reason,
          websiteId: data.id,
        });
      }
    } catch (error) {
      console.error("[email] website rejection email failed", {
        websiteId: input.websiteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `website.${input.approvalStatus ?? input.status ?? "update"}`,
    targetType: "website",
    targetId: input.websiteId,
    metadata: { patch, reason: input.reason ?? null },
  });

  return data;
}

export async function adminListAdZones(
  ctx: Ctx,
  filters: {
    websiteId?: string;
    publisherId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  let query = db
    .from("ad_zones")
    .select(
      "*, websites(name, domain, verification_status, approval_status), publishers(business_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.websiteId) query = query.eq("website_id", filters.websiteId);
  if (filters.publisherId) query = query.eq("publisher_id", filters.publisherId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status as any);

  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [dataRes, countRes] = await Promise.all([
    (query as any).range(from, to),
    (query as any).select("*", { count: "exact", head: true }),
  ]);

  if (dataRes.error) fail("We couldn't load ad zones.");
  return {
    zones: dataRes.data ?? [],
    total: countRes.count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((countRes.count ?? 0) / pageSize)),
  };
}

export async function adminGetAdZoneDetail(ctx: Ctx, zoneId: string) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const zone = await db
    .from("ad_zones")
    .select("*, websites(*), publishers(*), organizations(id, name)")
    .eq("id", zoneId)
    .maybeSingle();
  if (zone.error) fail("We couldn't load that ad zone.");
  if (!zone.data) fail("That ad zone doesn't exist.");

  const stats = await (db as any)
    .from("website_daily_stats")
    .select("*")
    .eq("ad_zone_id", zoneId)
    .order("date", { ascending: false })
    .limit(30);

  return { zone: zone.data, stats: stats.data ?? [] };
}

export async function adminSetAdZoneStatus(
  ctx: Ctx,
  input: { zoneId: string; status: "active" | "suspended" | "pending" },
) {
  await assertPlatformAdmin(ctx);
  const db = await admin();
  const { data, error } = await (db as any)
    .from("ad_zones")
    .update({ status: input.status })
    .eq("id", input.zoneId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't update that ad zone.");
  if (!data) fail("That ad zone doesn't exist.");

  await cacheBumpVersion("org", data.organization_id);
  await cacheDelete(`org:${data.organization_id}:ad_zones`);
  await invalidateZoneContextForWebsite(data.website_id);

  const { logAuditEvent } = await import("@/lib/audit-log.server");
  await logAuditEvent(ctx, {
    action: `ad_zone.${input.status}`,
    targetType: "ad_zone",
    targetId: input.zoneId,
  });

  return data;
}

export async function adminGetWebsiteDetail(ctx: Ctx, websiteId: string) {
  await assertPlatformStaff(ctx);
  const db = await admin();
  const website = await db
    .from("websites")
    .select("*, publishers(id, business_name, approval_status), ad_zones(*)")
    .eq("id", websiteId)
    .maybeSingle();
  if (website.error) fail("We couldn't load that website.");
  if (!website.data) fail("That website doesn't exist.");

  const stats = await db
    .from("website_daily_stats")
    .select("*")
    .eq("website_id", websiteId)
    .order("date", { ascending: false })
    .limit(30);

  return { website: website.data, stats: stats.data ?? [] };
}

/**
 * Origin the embed snippet points at. Configured ad domain wins; the request
 * origin is only a fallback so previews stay usable.
 */
export function resolveAdServerOrigin(_requestUrl?: string): string {
  // Production ad traffic must use the dedicated ad origin. Do not fall back
  // to PUBLIC_SITE_ORIGIN/SITE_URL because those normally point to the main
  // TradeMall application and would make publisher SDK requests hit the wrong
  // origin.
  const configured = process.env["AD_SERVER_ORIGIN"];
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return "https://ads.trademall.co.ke";
}
