import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createPolicy,
  deletePolicy,
  getPolicyById,
  getPolicyBySlug,
  listAllPolicies,
  listPublishedPolicies,
  searchPolicies,
  updatePolicy,
} from "@/lib/policy-service.server";

const uuid = z.string().uuid();
const categoryEnum = z.enum([
  "ad_policies",
  "publisher_guidelines",
  "traffic_quality",
  "prohibited_content",
  "data_privacy",
  "compliance",
  "advertiser_policies",
  "publisher_policies",
]);

export const fetchPublishedPolicies = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return listPublishedPolicies({ supabase: supabaseAdmin as any });
});

export const fetchPolicyBySlug = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getPolicyBySlug({ supabase: supabaseAdmin as any }, data.slug);
  });

export const fetchPolicyBySlugPublic = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getPolicyBySlug({ supabase: supabaseAdmin as any }, data.slug);
  });

export const fetchAllPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listAllPolicies({ supabase: supabaseAdmin as any });
  });

export const fetchPolicyById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ policyId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getPolicyById({ supabase: supabaseAdmin as any }, data.policyId);
  });

export const adminCreatePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        category: categoryEnum,
        slug: z.string().trim().min(2).max(120),
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().min(10).max(1000),
        sections: z.array(z.any()).optional().default([]),
        relatedPolicies: z.array(z.string()).optional().default([]),
        isPublished: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return createPolicy(
      { supabase: context.supabase, userId: context.userId },
      {
        category: data.category,
        slug: data.slug,
        title: data.title,
        description: data.description,
        sections: data.sections,
        relatedPolicies: data.relatedPolicies,
        isPublished: data.isPublished,
      },
    );
  });

export const adminUpdatePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        policyId: uuid,
        category: categoryEnum.optional(),
        slug: z.string().trim().min(2).max(120).optional(),
        title: z.string().trim().min(2).max(200).optional(),
        description: z.string().trim().min(10).max(1000).optional(),
        sections: z.array(z.any()).optional(),
        relatedPolicies: z.array(z.string()).optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { policyId, ...input } = data;
    return updatePolicy({ supabase: context.supabase, userId: context.userId }, policyId, {
      category: input.category,
      slug: input.slug,
      title: input.title,
      description: input.description,
      sections: input.sections,
      relatedPolicies: input.relatedPolicies,
      isPublished: input.isPublished,
    });
  });

export const adminDeletePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ policyId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    return deletePolicy({ supabase: context.supabase, userId: context.userId }, data.policyId);
  });

export const searchPoliciesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ query: z.string().trim().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return searchPolicies({ supabase: supabaseAdmin as any }, data.query);
  });

export const searchPoliciesPublicFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ query: z.string().trim().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return searchPolicies({ supabase: supabaseAdmin as any }, data.query);
  });
