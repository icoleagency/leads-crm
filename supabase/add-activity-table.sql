-- Creates the lead_activity table that powers call logging and the KPIs page.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

create table if not exists public.lead_activity (
  id bigint generated always as identity primary key,
  lead_id text,
  lead_name text,
  lead_state text,
  lead_type text,
  outcome text not null,
  caller text,
  note text,
  amount numeric,
  created_at timestamptz not null default now()
);

create index if not exists lead_activity_created_at_idx on public.lead_activity (created_at desc);
create index if not exists lead_activity_lead_id_idx on public.lead_activity (lead_id);

-- Same open access as the rest of the app (no login right now).
alter table public.lead_activity enable row level security;
drop policy if exists "open_access" on public.lead_activity;
create policy "open_access" on public.lead_activity
  for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
