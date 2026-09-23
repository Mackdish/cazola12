-- Restrict direct blog CMS mutations to platform administrators.
-- Server-side blog functions also enforce this boundary before using the admin client.

drop policy if exists "Authenticated users can manage blog posts" on public.blog_posts;

drop policy if exists "Platform staff can manage blog posts" on public.blog_posts;
create policy "Platform staff can manage blog posts"
  on public.blog_posts for all to authenticated
  using (public.is_platform_staff(auth.uid()))
  with check (public.is_platform_staff(auth.uid()));

notify pgrst, 'reload schema';
