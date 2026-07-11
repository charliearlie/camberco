-- Blog drafts + published posts. Matches every column the code reads/writes:
-- admin editor CRUD (src/pages/api/admin/drafts.ts), publish flow
-- (src/pages/api/admin/publish.ts) and public reads (src/lib/blog.ts).
-- Idempotent: safe on the live database where the table already exists.

create table if not exists public.blog_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'Untitled',
  slug text not null default '',
  description text not null default '',
  author text not null default 'Charlie',
  category text not null default 'ai-strategy',
  tags jsonb not null default '[]'::jsonb,
  cover_image text,
  cover_image_alt text,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_drafts_status_published_at_idx
  on public.blog_drafts (status, published_at desc);

-- RLS: service role only (API routes use the service role key, which bypasses RLS)
alter table public.blog_drafts enable row level security;
