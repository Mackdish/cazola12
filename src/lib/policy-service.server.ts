import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type Policy = Database["public"]["Tables"]["policies"]["Row"];
export type PolicySection = {
  id: string;
  title: string;
  content: string;
  examples?: string[];
  requirements?: string[];
  violations?: string[];
  enforcement?: string;
};

export class PolicyError extends Error {}

function fail(message: string): never {
  throw new PolicyError(message);
}

export async function listPublishedPolicies(ctx: { supabase: Client }) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .select("*")
    .eq("is_published", true)
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) fail("We couldn't load policies.");
  return (data ?? []) as Policy[];
}

export async function listAllPolicies(ctx: { supabase: Client }) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .select("*")
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) fail("We couldn't load policies.");
  return (data ?? []) as Policy[];
}

export async function getPolicyBySlug(ctx: { supabase: Client }, slug: string) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) fail("We couldn't load that policy.");
  return (data as Policy | null) ?? null;
}

export async function getPolicyById(ctx: { supabase: Client }, id: string) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail("We couldn't load that policy.");
  return (data as Policy | null) ?? null;
}

export async function createPolicy(
  ctx: { supabase: Client; userId: string },
  input: {
    category: Policy["category"];
    slug: string;
    title: string;
    description: string;
    sections?: unknown;
    relatedPolicies?: string[];
    isPublished?: boolean;
  },
) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .insert({
      category: input.category,
      slug: input.slug,
      title: input.title,
      description: input.description,
      sections: (input.sections ?? []) as Policy["sections"],
      related_policies: (input.relatedPolicies ?? []) as Policy["related_policies"],
      is_published: input.isPublished ?? false,
      last_updated: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) fail("We couldn't create that policy.");
  return data as Policy;
}

export async function updatePolicy(
  ctx: { supabase: Client; userId: string },
  id: string,
  input: {
    category?: Policy["category"] | undefined;
    slug?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    sections?: unknown;
    relatedPolicies?: string[] | undefined;
    isPublished?: boolean | undefined;
  },
) {
  const patch: Record<string, unknown> = {
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.sections !== undefined ? { sections: input.sections } : {}),
    ...(input.relatedPolicies !== undefined ? { related_policies: input.relatedPolicies } : {}),
    ...(input.isPublished !== undefined ? { is_published: input.isPublished } : {}),
    updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  const { data, error } = await ctx.supabase
    .from("policies")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) fail("We couldn't update that policy.");
  return data as Policy;
}

export async function deletePolicy(ctx: { supabase: Client; userId: string }, id: string) {
  const { error } = await ctx.supabase.from("policies").delete().eq("id", id);

  if (error) fail("We couldn't delete that policy.");
  return { ok: true };
}

export async function searchPolicies(ctx: { supabase: Client }, query: string) {
  const { data, error } = await ctx.supabase
    .from("policies")
    .select("*")
    .eq("is_published", true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,sections::text.ilike.%${query}%`)
    .order("title", { ascending: true });

  if (error) fail("We couldn't search policies.");
  return (data ?? []) as Policy[];
}
