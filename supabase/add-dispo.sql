-- Dispositions: your cash buyers and every touch with them on each deal.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.buyers (
  id bigint generated always as identity primary key,
  name text not null,
  company text,
  phone text,
  email text,
  buyer_type text,
  markets text[] not null default '{}',
  property_types text[] not null default '{}',
  min_price numeric,
  max_price numeric,
  rehab text[] not null default '{}',
  financing text,
  pof boolean not null default false,
  pof_date date,
  tags text[] not null default '{}',
  notes text,
  status text not null default 'active',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_activity (
  id bigint generated always as identity primary key,
  buyer_id bigint not null references public.buyers(id) on delete cascade,
  lead_id text not null,
  kind text not null,          -- sent | interested | showing | offer | passed | assigned
  amount numeric,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists buyer_activity_lead_idx on public.buyer_activity (lead_id);
create index if not exists buyer_activity_buyer_idx on public.buyer_activity (buyer_id);

-- Same open access as the rest of the app (no login right now).
alter table public.buyers enable row level security;
alter table public.buyer_activity enable row level security;
drop policy if exists "open_access" on public.buyers;
drop policy if exists "open_access" on public.buyer_activity;
create policy "open_access" on public.buyers for all to anon, authenticated using (true) with check (true);
create policy "open_access" on public.buyer_activity for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
