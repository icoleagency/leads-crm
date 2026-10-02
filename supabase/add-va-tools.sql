-- VA tools: end-of-day reports and coaching notes.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.va_reports (
  id bigint generated always as identity primary key,
  member_id text not null,
  member_name text,
  report_date date not null,
  stats jsonb not null default '{}'::jsonb,
  wins text,
  blockers text,
  tomorrow text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, report_date)
);

create table if not exists public.va_notes (
  id bigint generated always as identity primary key,
  member_id text,            -- null = every VA
  body text not null,
  pinned boolean not null default false,
  read_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Same open access as the rest of the app (no login right now).
alter table public.va_reports enable row level security;
alter table public.va_notes enable row level security;
drop policy if exists "open_access" on public.va_reports;
drop policy if exists "open_access" on public.va_notes;
create policy "open_access" on public.va_reports for all to anon, authenticated using (true) with check (true);
create policy "open_access" on public.va_notes for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
