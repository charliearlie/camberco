-- Link an enquiry to the client it was converted into. Nullable: deleting a
-- client nulls this (on delete set null), it never deletes enquiries.
-- client_id IS NOT NULL is the "converted" marker (no new enquiry status).
-- Idempotent, forward-only. Depends on public.clients.

alter table public.enquiries
  add column if not exists client_id uuid references public.clients (id) on delete set null;

create index if not exists enquiries_client_id_idx on public.enquiries (client_id);
