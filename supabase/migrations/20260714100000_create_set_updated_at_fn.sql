-- Shared trigger function that keeps updated_at current on every UPDATE.
-- Used by the clients and projects triggers (client_notes is append-only).
-- Idempotent: create or replace is safe to re-run.

-- search_path pinned to '' so the function always resolves now() from
-- pg_catalog and can never be hijacked by a caller-controlled search_path.
create or replace function public.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
