-- Durable rate limiting, replacing per-instance in-memory maps that reset on
-- every cold start. One row per key (e.g. 'enquiries:1.2.3.4'). The
-- bump_rate_limit function is atomic: insert-or-increment in one statement.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_started_at timestamptz not null default now()
);

-- RLS: service role only (API routes use the service role key, which bypasses RLS)
alter table public.rate_limits enable row level security;

create or replace function public.bump_rate_limit(
  p_key text,
  p_limit integer,
  p_window_minutes integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into rate_limits as rl (key, count, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rl.window_started_at < now() - make_interval(mins => p_window_minutes)
            then 1
          else rl.count + 1
        end,
        window_started_at = case
          when rl.window_started_at < now() - make_interval(mins => p_window_minutes)
            then now()
          else rl.window_started_at
        end
  returning rl.count <= p_limit into allowed;
  return allowed;
end;
$$;

revoke execute on function public.bump_rate_limit(text, integer, integer) from public;
revoke execute on function public.bump_rate_limit(text, integer, integer) from anon;
revoke execute on function public.bump_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.bump_rate_limit(text, integer, integer) to service_role;
