create table enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  service text not null,
  message text not null,
  source text not null check (source in ('form', 'bot')),
  chat_transcript jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: service role only (API routes use service role key)
alter table enquiries enable row level security;
