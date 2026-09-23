import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const blogInput = z.object({
  slug: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(240),
  excerpt: z.string().trim().max(1000).default(""),
  category: z.string().trim().min(2).max(80),
  author: z.string().trim().min(2).max(120).default("TradeMall"),
  readTime: z.string().trim().max(40).default("5 min read"),
  content: z.string().trim().min(20).max(100000),
  isPublished: z.boolean().default(false),
});

const uuid = z.string().uuid();

export const fetchPublishedBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) throw new Error("We couldn't load blog posts.");
  return data ?? [];
});

export const fetchBlogPostBySlug = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ slug: z.string().trim().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw new Error("We couldn't load that blog post.");
    return post ?? null;
  });

export const fetchAllBlogPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error("We couldn't load blog posts.");
    return data ?? [];
  });

export const adminCreateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => blogInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .insert({
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        author: data.author,
        read_time: data.readTime,
        content: data.content,
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.code === "23505" ? "That slug is already in use." : "We couldn't create the blog post.");
    return post;
  });

export const adminUpdateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    blogInput.partial().extend({ blogPostId: uuid }).parse(data),
  )
  .handler(async ({ data }) => {
    const { blogPostId, readTime, isPublished, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      ...rest,
      ...(readTime !== undefined ? { read_time: readTime } : {}),
      ...(isPublished !== undefined ? { is_published: isPublished } : {}),
    };

    if (isPublished === true) patch.published_at = new Date().toISOString();
    if (isPublished === false) patch.published_at = null;

    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .update(patch)
      .eq("id", blogPostId)
      .select("*")
      .single();

    if (error) throw new Error(error.code === "23505" ? "That slug is already in use." : "We couldn't update the blog post.");
    return post;
  });

export const adminDeleteBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ blogPostId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.blogPostId);
    if (error) throw new Error("We couldn't delete the blog post.");
    return { ok: true };
  });
