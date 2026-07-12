-- Storage bucket for blog images. Public read (published posts embed public
-- URLs); the admin editor uploads client-side with the admin's auth session,
-- so authenticated needs an insert policy. Service-role uploads bypass RLS.

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "blog_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'blog-images');

create policy "blog_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images');

-- Hardening: getPostBySlug() uses .single() on slug, so published slugs must
-- be unique. Partial index only. Drafts share the default '' slug.
create unique index if not exists blog_drafts_published_slug_key
  on public.blog_drafts (slug)
  where status = 'published';
