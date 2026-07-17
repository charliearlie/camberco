-- CRM projects: a client engagement (a piece of paid work). This is NOT the
-- marketing portfolio in src/data/projects.ts. Belongs to a client; deleting
-- the client cascades its projects. value_pence stores money as integer pence
-- to avoid floats. completed_at is set server-side when status becomes
-- 'completed'. Idempotent, forward-only. Depends on public.clients and
-- public.set_updated_at().

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'lead'
    check (status in ('lead', 'proposal', 'active', 'on_hold', 'completed', 'cancelled')),
  value_pence integer check (value_pence is null or value_pence >= 0),
  currency text not null default 'GBP',
  start_date date,
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_client_id_idx on public.projects (client_id);
create index if not exists projects_status_idx on public.projects (status);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- RLS: service role only (API routes use the service role key, which bypasses RLS).
alter table public.projects enable row level security;
