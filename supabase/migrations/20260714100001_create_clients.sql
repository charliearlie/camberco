-- CRM clients: a person/business Camber Co does (or may do) paid work for.
-- Part of the Enquiry -> Client -> Project pipeline. No user_id column:
-- this is a single-admin CRM, access is service-role only via API routes.
-- Idempotent, forward-only. Depends on public.set_updated_at().

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  website text,
  status text not null default 'lead' check (status in ('lead', 'active', 'past', 'archived')),
  source text not null default 'direct' check (source in ('enquiry', 'referral', 'direct')),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_status_idx on public.clients (status);

-- Case-insensitive unique email so conversion from an enquiry can never
-- create a duplicate client; NULL emails are allowed and not deduplicated.
create unique index if not exists clients_email_unique
  on public.clients (lower(email)) where email is not null;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- RLS: service role only (API routes use the service role key, which bypasses RLS).
alter table public.clients enable row level security;
