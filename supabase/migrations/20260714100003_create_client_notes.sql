-- CRM activity timeline. Named client_notes (not "notes") to avoid confusion
-- with the freeform clients.summary / projects.notes columns. Append-only, so
-- no updated_at trigger. A note may optionally be scoped to a project; if that
-- project is deleted the note is kept on the client timeline (set null).
-- Idempotent, forward-only. Depends on public.clients and public.projects.

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_notes_client_id_idx on public.client_notes (client_id);
create index if not exists client_notes_project_id_idx on public.client_notes (project_id);
create index if not exists client_notes_created_at_idx on public.client_notes (created_at desc);

-- RLS: service role only (API routes use the service role key, which bypasses RLS).
alter table public.client_notes enable row level security;
