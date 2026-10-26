import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { builtInBlogSlugs } from "@/lib/blog";

const blogInput = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, numbers and single hyphens.",
    ),
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
  const db = supabaseAdmin as any;
  const { data, error } = await db
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
    const db = supabaseAdmin as any;
    const { data: post, error } = await db
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw new Error("We couldn't load that blog post.");
    return post ?? null;
  });

async function assertBlogAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  // A user can hold several platform roles; maybeSingle() would error on that and
  // wrongly lock them out, so just ask whether ANY admin-level role exists.
  const { data: roles, error } = await db
    .from("platform_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .limit(1);

  if (error || !roles?.length) {
    throw new Error("Forbidden: administrator access is required.");
  }
}

/** Built-in articles own their URLs; a database post must not shadow them. */
function assertSlugNotReserved(slug: string | undefined) {
  if (slug && builtInBlogSlugs.includes(slug)) {
    throw new Error("That slug is reserved by a built-in article. Choose a different one.");
  }
}

export const fetchAllBlogPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBlogAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error("We couldn't load blog posts.");
    return data ?? [];
  });

export const adminCreateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => blogInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertBlogAdmin(context.userId);
    assertSlugNotReserved(data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: post, error } = await db
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
  .handler(async ({ data, context }) => {
    await assertBlogAdmin(context.userId);
    assertSlugNotReserved(data.slug);
    const { blogPostId, readTime, isPublished, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const patch: Record<string, unknown> = {
      ...rest,
      ...(readTime !== undefined ? { read_time: readTime } : {}),
      ...(isPublished !== undefined ? { is_published: isPublished } : {}),
    };

    // Let the database trigger set published_at only on the draft -> published transition.
    // This preserves the original publication date when an already-published post is edited.
    if (isPublished === false) patch["published_at"] = null;

    const { data: post, error } = await db
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
  .handler(async ({ data, context }) => {
    await assertBlogAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("blog_posts").delete().eq("id", data.blogPostId);
    if (error) throw new Error("We couldn't delete the blog post.");
    return { ok: true };
  });
