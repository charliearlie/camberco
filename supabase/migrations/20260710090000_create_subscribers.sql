-- Subscribers: newsletter list. Matches every column the code reads/writes,
-- plus soft-delete + digest-tracking columns added by the elevation work.
-- Idempotent: safe on the live database where the base table already exists.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  confirmed boolean not null default false,
  unsubscribe_token text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

alter table public.subscribers add column if not exists status text not null default 'active';
alter table public.subscribers add column if not exists unsubscribed_at timestamptz;
alter table public.subscribers add column if not exists last_sent_at timestamptz;

create unique index if not exists subscribers_email_key on public.subscribers (email);
create unique index if not exists subscribers_unsubscribe_token_key on public.subscribers (unsubscribe_token);

-- RLS: service role only (API routes use the service role key, which bypasses RLS)
alter table public.subscribers enable row level security;
