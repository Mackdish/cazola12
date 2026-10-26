-- Blog CMS: make the blog work end-to-end and lock writes to platform admins.
--
-- Idempotent on purpose. Migrations 20260923000000 / 20260923010000 define the
-- blog_posts table but were never applied to production, so every blog query
-- (public and admin) failed. This restates the whole schema so it is created
-- when missing and corrected when it already exists.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  category text not null default 'How To',
  author text not null default 'TradeMall',
  read_time text not null default '5 min read',
  content text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (is_published, published_at desc);

-- Slugs become public URLs (and sitemap entries): keep them URL-safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'blog_posts_slug_format' and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts
      add constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
end $$;

alter table public.blog_posts enable row level security;

-- Anyone may read published posts.
drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (is_published = true);

-- Only platform ADMINS (admin / super_admin) may write. The earlier policy used
-- is_platform_staff(), which is true for every platform role including read-only
-- analysts, so they could have edited the blog by calling the API directly.
drop policy if exists "Authenticated users can manage blog posts" on public.blog_posts;
drop policy if exists "Platform staff can manage blog posts" on public.blog_posts;
drop policy if exists "Platform admins can manage blog posts" on public.blog_posts;
create policy "Platform admins can manage blog posts"
  on public.blog_posts for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- Keep updated_at fresh and published_at consistent on both INSERT and UPDATE:
--  * published with no date  -> stamp now (draft -> published, or direct publish)
--  * unpublished             -> clear the date
--  * editing a published post keeps its original publication date
create or replace function public.set_blog_posts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.is_published then
    if new.published_at is null then
      new.published_at = now();
    end if;
  else
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
  before insert or update on public.blog_posts
  for each row execute function public.set_blog_posts_updated_at();

notify pgrst, 'reload schema';
