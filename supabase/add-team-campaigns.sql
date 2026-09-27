-- Creates the campaigns (markets/counties) and team_members (VAs) tables
-- that power the VA Workspace. Run ONCE in Supabase:
-- Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.campaigns (
  id bigint generated always as identity primary key,
  name text not null,
  state text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id bigint generated always as identity primary key,
  name text not null,
  role text not null default 'VA',
  campaigns text[] not null default '{}',
  dial_goal int not null default 60,
  offer_goal int not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Same open access as the rest of the app (no login right now).
alter table public.campaigns enable row level security;
alter table public.team_members enable row level security;
drop policy if exists "open_access" on public.campaigns;
drop policy if exists "open_access" on public.team_members;
create policy "open_access" on public.campaigns for all to anon, authenticated using (true) with check (true);
create policy "open_access" on public.team_members for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
